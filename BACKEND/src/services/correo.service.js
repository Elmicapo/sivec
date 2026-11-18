const { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } = require('node:crypto');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INTENTOS = 7;

const versionarSesiones = () => /^[a-f\d]{64}$/i.test(process.env.SIVEC_MAIL_QUEUE_KEY || '');

function configuracionCorreo() {
    const { RESEND_API_KEY, SIVEC_MAIL_FROM, SIVEC_PUBLIC_URL, SIVEC_MAIL_QUEUE_KEY } = process.env;
    const proveedor = process.env.SIVEC_MAIL_PROVIDER || 'resend';
    const gmail = {
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
    };
    if (!SIVEC_MAIL_FROM || !SIVEC_PUBLIC_URL || !versionarSesiones()) return null;
    if (proveedor === 'gmail') {
        if (!correoValido(SIVEC_MAIL_FROM) || !Object.values(gmail).every(Boolean)) return null;
    } else if (proveedor !== 'resend' || !RESEND_API_KEY) {
        return null;
    }
    try {
        const web = new URL(SIVEC_PUBLIC_URL);
        if (web.protocol !== 'https:' && !(web.protocol === 'http:' && web.hostname === 'localhost')) return null;
        return { proveedor, gmail, apiKey: RESEND_API_KEY, remitente: SIVEC_MAIL_FROM, web: web.origin, llave: Buffer.from(SIVEC_MAIL_QUEUE_KEY, 'hex') };
    } catch {
        return null;
    }
}

const correoValido = correo => typeof correo === 'string' && correo.length <= 254 && EMAIL.test(correo);

function cifrar(mensaje, llave) {
    const iv = randomBytes(12);
    const cifrador = createCipheriv('aes-256-gcm', llave, iv);
    const datos = Buffer.concat([cifrador.update(JSON.stringify(mensaje), 'utf8'), cifrador.final()]);
    return Buffer.concat([iv, cifrador.getAuthTag(), datos]).toString('base64');
}

function descifrar(contenido, llave) {
    const bytes = Buffer.from(contenido, 'base64');
    const lector = createDecipheriv('aes-256-gcm', llave, bytes.subarray(0, 12));
    lector.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([lector.update(bytes.subarray(28)), lector.final()]).toString('utf8'));
}

async function encolarCorreo(database, { para, asunto, texto, vigenciaMinutos = 1440, limitePublico = false }) {
    const config = configuracionCorreo();
    if (!config || !correoValido(para)) return;
    const destino = para.toLowerCase();
    const hash = createHmac('sha256', config.llave).update(destino).digest();
    await database.query(
        `INSERT INTO salida_correo (destino_hash, contenido, expira_en, creado_en, disponible_en)
         SELECT ?, ?, TIMESTAMPADD(MINUTE, ?, UTC_TIMESTAMP()), UTC_TIMESTAMP(), UTC_TIMESTAMP()
          WHERE ? = 0 OR (
              SELECT COUNT(*) FROM salida_correo
               WHERE destino_hash = ? AND creado_en >= UTC_TIMESTAMP() - INTERVAL 1 HOUR
          ) < 5`,
        [hash, cifrar({ to: destino, subject: asunto, text: texto }, config.llave), vigenciaMinutos, limitePublico ? 1 : 0, hash]
    );
}

async function enviarPorGmail(enviar, config, mensaje, idMensaje) {
    const token = await enviar('https://oauth2.googleapis.com/token', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({ ...config.gmail, grant_type: 'refresh_token' })
    });
    if (!token.ok) throw new Error(`Google OAuth HTTP ${token.status}`);
    const { access_token: acceso } = await token.json();
    if (!acceso) throw new Error('Google OAuth no devolvió un token de acceso.');

    const asunto = Buffer.from(mensaje.subject, 'utf8').toString('base64');
    const cuerpo = Buffer.from(mensaje.text, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
    const mime = [
        `From: SIVEC <${config.remitente}>`,
        `To: ${mensaje.to}`,
        `Subject: =?UTF-8?B?${asunto}?=`,
        `Message-ID: <${idMensaje}@${config.remitente.split('@')[1]}>`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        cuerpo
    ].join('\r\n');
    const respuesta = await enviar('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: Buffer.from(mime, 'utf8').toString('base64url') })
    });
    if (!respuesta.ok) throw new Error(`Gmail HTTP ${respuesta.status}`);
}

async function enviarPorResend(enviar, config, mensaje, idMensaje) {
    const respuesta = await enviar('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idMensaje
        },
        body: JSON.stringify({ from: config.remitente, ...mensaje })
    });
    if (!respuesta.ok) throw new Error(`Resend HTTP ${respuesta.status}`);
}

async function procesarCorreo(database, enviar = fetch) {
    const config = configuracionCorreo();
    if (!config) return false;
    await database.query(
        `DELETE FROM salida_correo
          WHERE creado_en < UTC_TIMESTAMP() - INTERVAL 2 DAY
            AND (contenido IS NULL OR expira_en <= UTC_TIMESTAMP())`
    );
    await database.query(
        `UPDATE salida_correo SET contenido = NULL, reserva = NULL
          WHERE expira_en <= UTC_TIMESTAMP() AND contenido IS NOT NULL AND disponible_en <= UTC_TIMESTAMP()`
    );
    const [[pendiente]] = await database.query(
        `SELECT id, contenido, intento
           FROM salida_correo
          WHERE contenido IS NOT NULL AND disponible_en <= UTC_TIMESTAMP()
            AND expira_en > UTC_TIMESTAMP() AND intento < ?
          ORDER BY disponible_en, id LIMIT 1`,
        [MAX_INTENTOS]
    );
    if (!pendiente) return false;

    const reserva = randomUUID();
    const [tomado] = await database.query(
        `UPDATE salida_correo SET reserva = ?, intento = intento + 1,
                disponible_en = UTC_TIMESTAMP() + INTERVAL 1 MINUTE
          WHERE id = ? AND intento = ? AND contenido IS NOT NULL AND disponible_en <= UTC_TIMESTAMP()
            AND expira_en > UTC_TIMESTAMP()`,
        [reserva, pendiente.id, pendiente.intento]
    );
    if (!tomado.affectedRows) return false;

    try {
        const mensaje = descifrar(pendiente.contenido, config.llave);
        const idMensaje = `sivec-correo-${pendiente.id}-${pendiente.contenido.slice(0, 16)}`;
        if (config.proveedor === 'gmail') {
            await enviarPorGmail(enviar, config, mensaje, idMensaje);
        } else {
            await enviarPorResend(enviar, config, mensaje, idMensaje);
        }
        await database.query(
            'UPDATE salida_correo SET enviado_en = UTC_TIMESTAMP(), contenido = NULL, reserva = NULL WHERE id = ? AND reserva = ?',
            [pendiente.id, reserva]
        );
    } catch {
        const agoto = pendiente.intento + 1 >= MAX_INTENTOS;
        await database.query(
            `UPDATE salida_correo SET contenido = IF(?, NULL, contenido), reserva = NULL,
                    disponible_en = TIMESTAMPADD(MINUTE, ?, UTC_TIMESTAMP())
              WHERE id = ? AND reserva = ?`,
            [agoto, 2 ** pendiente.intento, pendiente.id, reserva]
        );
        console.error(agoto ? 'Correo SIVEC agotó sus reintentos.' : 'Correo SIVEC pendiente de reintento.');
    }
    return true;
}

function iniciarColaCorreo(database) {
    if (!configuracionCorreo()) return () => {};
    let procesando = false;
    const timer = setInterval(async () => {
        if (procesando) return;
        procesando = true;
        try {
            for (let n = 0; n < 5; n += 1) {
                if (!await procesarCorreo(database)) break;
            }
        } catch (error) {
            console.error('Cola de correo SIVEC:', error.code || 'ERROR');
        } finally {
            procesando = false;
        }
    }, 10_000);
    timer.unref();
    return () => clearInterval(timer);
}

module.exports = { configuracionCorreo, versionarSesiones, correoValido, encolarCorreo, procesarCorreo, iniciarColaCorreo };
