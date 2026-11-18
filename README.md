# SIVEC

Sistema de Información, Veeduría y Espacios para el Deporte y la Cultura de Apartadó. Proyecto académico con React, Express y MySQL.

## Preparar la demostración

Usa Node.js 24 y MySQL 8. Restaura un respaldo autorizado del esquema base en un esquema aislado, como `sivec_isolated_demo`. Para compartir la demostración, usa datos ficticios. El repositorio requiere el esquema base y las migraciones amplían ese esquema. El respaldo y las imágenes de veeduría se mantienen fuera de Git.

1. Copia `BACKEND/.env.example` a `BACKEND/.env` y configura el esquema restaurado, el usuario de MySQL y su contraseña. Configura `VEEDURIA_STORAGE_DIR` con una ruta privada y persistente fuera del repositorio.
2. Genera una clave JWT local con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guárdala como `JWT_SECRET` en `BACKEND/.env`.
3. Desde `BACKEND`, instala dependencias y consulta las migraciones de la copia. Si el respaldo es el esquema base sin migraciones, aplica las migraciones con el último comando. Para una copia ya migrada, verifica su estado y sigue la [guía de migraciones](BACKEND/migrations/README.md).

   ```sh
   npm ci
   node scripts/migrate.js --database=sivec_isolated_demo --status
   node scripts/migrate.js --database=sivec_isolated_demo
   ```

4. Desde `BACKEND`, ejecuta `npm test` y `npm run dev`. En otra terminal, desde `frontend`, ejecuta `npm ci` y `npm run dev`. Abre la URL que imprime Vite.
5. Si la API se ejecuta en otro host o puerto, copia `frontend/.env.example` a `frontend/.env.local` y ajusta `VITE_API_URL`, incluida la ruta `/api`.

La base original `deportes` tiene su propio procedimiento de migración, descrito en la guía. Usa la copia aislada para la demostración.

## Recorridos de entrega

- **Deportista:** inscríbete en una disciplina y verifica que aparezca en el historial.
- **Entrenador y administración:** envía una solicitud de vinculación, apruébala, registra un horario con una disciplina y un escenario asociados, y comprueba que aparezca en la agenda.
- **Administración:** crea, edita y da de baja una disciplina de prueba. Recarga la pantalla después de cada acción para comprobar la persistencia.
- **Ciudadano y CMJ:** envía una veeduría con una fotografía, guarda el código, valida el reporte en CMJ, oficializa el semáforo y consulta el resultado en Seguimiento. Envía una propuesta de escenario y comprueba que su aprobación la añade al catálogo.

Usa cuentas de demostración distintas para cada rol y un perfil CMJ en el esquema aislado. Conserva las claves de esas cuentas fuera del repositorio.

Desde `frontend`, `npm run build` verifica la compilación y `npm run lint` revisa el código. Las pruebas de integración con MySQL requieren la copia aislada documentada en [Migraciones](BACKEND/migrations/README.md).

[Documentación del proyecto](docs/README.md)

## PWA y despliegue en Railway

La compilación genera el manifiesto, los iconos y el *service worker* de SIVEC. En un sitio HTTPS, el navegador puede instalarlo como aplicación. Tras una primera visita en línea, puedes abrir la interfaz sin conexión. El *service worker* también guarda hasta 60 consultas públicas recientes de disciplinas, escenarios y cronogramas durante un máximo de siete días. Se intenta obtener la versión de la red primero. Cada filtro solo está disponible sin conexión si se consultó antes.

El deportista puede leer su último historial visto durante la misma sesión del navegador. Se guarda por cuenta en `sessionStorage` y se borra al cerrar sesión o al iniciar otra. Las evidencias, el seguimiento de reportes y los datos privados del CMJ están fuera de la caché. Se necesita conexión para autenticarse, consultar información que no esté guardada, inscribirse, reportar u oficializar cambios.

1. En Railway, crea un proyecto con un servicio MySQL 8 y otro para la aplicación. Conecta el servicio de la aplicación al repositorio y selecciona la rama de entrega. El `Dockerfile` raíz compila el frontend y lo sirve desde Express en el mismo dominio que `/api`. Railway puede verificar el proceso en `/api/health`.
2. En el servicio de aplicación, configura `DB_HOST` con el host privado de MySQL, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y un `JWT_SECRET` generado para ese entorno. Configura las credenciales en Railway. Usa una copia de demostración aislada y un usuario de aplicación con los permisos necesarios sobre ese esquema.
3. Restaura un respaldo base autorizado con datos ficticios. Desde un proceso con acceso al MySQL privado, verifica o aplica las migraciones de la copia siguiendo la [guía](BACKEND/migrations/README.md). Usa una cuenta de migración separada si la cuenta de aplicación carece de permisos DDL.
4. Monta un volumen persistente para las evidencias en `/app/data`. Verifica que el usuario del contenedor pueda escribir en el volumen. El Dockerfile usa el usuario `node` (UID 1000) y define `VEEDURIA_STORAGE_DIR=/app/data`.
5. Genera un dominio HTTPS para la aplicación. Abre Inicio y una ruta directa, como `/seguimiento`. Instala SIVEC desde el menú del navegador, comprueba que abra sin conexión después de la primera carga y vuelve a conectar para ejecutar los recorridos de entrega. Reinicia el servicio y comprueba que las fotos ya guardadas sigan disponibles.

## Correos de SIVEC

Después de respaldar la base y aplicar la migración `007` en el esquema de demostración, configura en el servicio SIVEC de Railway:

| Variable | Uso |
| --- | --- |
| `RESEND_API_KEY` | Clave de envío de Resend. |
| `SIVEC_MAIL_FROM` | Remitente autorizado en Resend, por ejemplo `SIVEC <notificaciones@tu-dominio>`. |
| `SIVEC_PUBLIC_URL` | Origen HTTPS de la aplicación, sin rutas. |
| `SIVEC_MAIL_QUEUE_KEY` | Clave de 32 bytes en hexadecimal. Genera una nueva con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guárdala en Railway. Mantén la misma clave mientras haya mensajes en cola y para conservar el control de sesiones después de un restablecimiento. |

Con la configuración completa se envían confirmaciones de cuenta, inscripciones, vinculación, recepción y decisiones de veeduría, y avisos de propuestas con correo voluntario. El restablecimiento vence a los 30 minutos, se usa una sola vez e invalida los tokens de sesión anteriores de la cuenta. Los mensajes pendientes se cifran en MySQL, se reintentan ante fallos del proveedor y se purgan tras su vencimiento. Conserva las claves fuera del repositorio.

Antes de habilitar los envíos generales, prueba el remitente con una cuenta de demostración en línea. Verifica que el enlace de recuperación expire y que la bandeja reciba la confirmación de una inscripción y la de una veeduría.

#### Gmail para una demo sin dominio

1. En Google Cloud, habilita Gmail API. Configura la pantalla de consentimiento y, si la aplicación está en pruebas, agrega la cuenta de SIVEC como usuario de prueba.
2. Crea un cliente OAuth de tipo Aplicación web con la URI de redirección autorizada `https://developers.google.com/oauthplayground`. En OAuth Playground activa **Use your own OAuth credentials**, usa ese cliente y autoriza el alcance `https://www.googleapis.com/auth/gmail.send` con la cuenta remitente. Intercambia el código de autorización por un token de actualización.
3. En Railway configura `SIVEC_MAIL_PROVIDER=gmail`, `SIVEC_MAIL_FROM` con la dirección Gmail sola, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` y `GMAIL_REFRESH_TOKEN`. Conserva `SIVEC_PUBLIC_URL` y `SIVEC_MAIL_QUEUE_KEY`. Aplica la migración 007 antes de activar el envío.

Para aplicaciones OAuth externas en modo de prueba, Google suele caducar el token de actualización al cabo de siete días. Gmail admite un volumen limitado y no ofrece la misma garantía de idempotencia que Resend si se pierde la respuesta a un envío ya procesado.
