// El catálogo sin filtros es público e idéntico para todos los visitantes.
const VIGENCIA_MS = 2000;
let entrada;

async function obtenerCatalogo(cargar) {
    if (entrada && (entrada.pendiente || entrada.expira > Date.now())) {
        return entrada.pendiente || entrada.datos;
    }

    const actual = {};
    entrada = actual;
    actual.pendiente = Promise.resolve().then(cargar);
    try {
        actual.datos = await actual.pendiente;
        actual.expira = Date.now() + VIGENCIA_MS;
        return actual.datos;
    } catch (error) {
        if (entrada === actual) entrada = undefined;
        throw error;
    } finally {
        actual.pendiente = undefined;
    }
}

function invalidarCatalogo() {
    entrada = undefined;
}

module.exports = { obtenerCatalogo, invalidarCatalogo };
