const conexiones = new Set();

function escucharCambios(_req, res) {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write(': conectado\n\n');
    conexiones.add(res);
    const latido = setInterval(() => res.write(': latido\n\n'), 25_000);
    res.on('close', () => {
        clearInterval(latido);
        conexiones.delete(res);
    });
}

function publicarCambioDisciplina() {
    for (const res of conexiones) {
        if (!res.destroyed) res.write('event: disciplinas\ndata: actualizado\n\n');
    }
}

module.exports = { escucharCambios, publicarCambioDisciplina };
