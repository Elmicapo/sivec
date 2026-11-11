# Especificación técnica D1: validación y oficialización del semáforo

**Estado:** las migraciones 001–003 y el backend de validación/oficialización se probaron en `sivec_restore_test_20261104_484fe0eb` (MySQL 8.0.45), con filas sintéticas revertidas. La base original `deportes` permanece sin migrar y la API falla de forma cerrada allí hasta que un destino autorizado tenga las migraciones aplicadas.  
**Decisiones de negocio D1 aplicadas:** aprobadas por el responsable del proyecto según la solicitud de Fase 2 – Bloque D1.2.  
**Contraste de esquema y código:** consultas de solo lectura a la base original `deportes` y revisión del backend, `2026-11-03 22:06 -05:00`.  
**Alcance de este documento:** especificar el diseño D1, la API, transacción, interfaz y pruebas; registrar el resultado real de las migraciones aisladas. El SQL de referencia de este documento no se ejecutó directamente: la migración versionada es `BACKEND/migrations/001_d1_independent_officialization.js`.

## 1. Decisiones aprobadas y regla resultante

Se consideran decisiones aprobadas, no pendientes:

1. Solo el rol `CMJ` puede oficializar.
2. El actor de oficialización se identifica mediante `cmj_consejero`.
3. Si el estado propuesto ya coincide con el estado oficial vigente, la oficialización se registra igualmente.
4. El estado aplicado es el `estado_propuesto` del reporte previamente validado; el cliente no envía un estado alternativo.
5. Los registros históricos existentes se conservan como legado. No se inventan ni completan responsables o fechas de oficialización.

También se incorporan las orientaciones operativas aprobadas para este bloque: conservar las rutas GET/POST indicadas, identificar y revisar candidatos sin historial antes de activar la cola productiva, mostrar en la cola solo el escenario y los dos estados necesarios, usar UTC para nuevas marcas de tiempo, preparar y probar D7 antes de generar la migración ejecutable, y exigir observación de rechazo también en backend.

Por tanto, el flujo tiene dos operaciones independientes:

1. CMJ valida o rechaza un reporte pendiente. La operación no modifica el escenario ni crea historial de oficialización.
2. En una acción posterior, CMJ oficializa un reporte validado y aún no oficializado. Se aplica el estado propuesto y se registra una fila auditable aunque el estado anterior y el nuevo sean iguales.

### Requisitos aprobados de fotografías del formulario Reportar

Estos límites son requisitos aprobados del formulario ciudadano y son independientes de la operación D1 de validación/oficialización:

- Cada reporte requiere de 1 a 5 fotografías; máximo 5 MB por archivo y 20 MB acumulados.
- Resolución máxima: 1920 × 1920 píxeles. Formatos permitidos: JPG/JPEG, PNG y WebP.
- Rechazar SVG, ejecutables, archivos dañados o formatos falsificados. Validar el contenido real, no solo extensión o MIME declarado.
- Eliminar EXIF antes del almacenamiento, optimizar conservando legibilidad y usar almacenamiento privado sin acceso público directo.
- Antes del envío, la interfaz permite previsualizar, quitar y reemplazar fotografías. Sin conexión, las cargas quedan claramente pendientes y pueden reintentarse; el reporte no se confirma hasta que al menos una y no más de cinco fotos válidas hayan sido aceptadas por el servidor.
- La ubicación GPS pertenece al escenario y se captura por separado; no se obtiene de EXIF ni se conserva EXIF para determinarla. Si los archivos se conservan localmente después de cerrar/recargar, esa persistencia requiere aprobación de privacidad y política explícita.

La selección del almacenamiento privado y el diseño de persistencia offline entre sesiones permanecen fuera de las decisiones D1 y requieren aprobación técnica propia. Este apartado documenta los requisitos, no implementa carga ni modifica el esquema propuesto para D1.

## 2. Contraste con el sistema actual

### Hechos observados

- La base conectada fue la original `deportes`; las consultas leyeron metadatos y agregados, sin mostrar datos personales y sin ejecutar escrituras.
- `reporte_veeduria`, `escenario` e `historial_estado_escenario` usan InnoDB.
- `reporte_veeduria` contiene `estado_propuesto`, `estado_reporte`, `id_cmj_valida` y `fecha_validacion`, pero no datos para marcar una oficialización independiente.
- `historial_estado_escenario` ya tiene `id_reporte` nullable y `id_cmj` con FK a `cmj_consejero.id_persona`. `id_reporte` tiene actualmente un índice no único.
- El trigger `trg_oficializar_semaforo` sigue presente. Al cambiar un reporte de `PENDIENTE` a `VALIDADO`, registra historial y cambia el escenario solo cuando el estado propuesto difiere del actual. Al coincidir, no registra oficialización.
- La lectura agregada actual encontró 2 reportes validados, 1 rechazado, 2 filas de historial y ningún grupo duplicado por `historial_estado_escenario.id_reporte`. Los dos reportes validados observados tienen historial asociado. Estos conteos son una fotografía, no deben codificarse como constantes ni asumirse válidos al momento de migrar.
- La ruta backend existente de validación solo admite `CMJ`. No existe una ruta de oficialización. El panel CMJ muestra validación/rechazo, pero no una cola de oficialización separada y su texto actual afirma que validar cambia el semáforo.
- En `auth.controller.js`, el login consulta `usuario.id_persona` junto con `rol.nombre` y firma en el JWT las propiedades `id_usuario`, `id_persona`, `nombre` y `rol`. `verificarToken` asigna a `req.usuario` el payload decodificado por `jwt.verify`; el controlador de validación existente lee `req.usuario.id_persona`.
- El esquema vincula tanto `usuario.id_persona` como `cmj_consejero.id_persona` a `persona.id_persona`, pero esas FKs por sí solas no garantizan que toda cuenta con rol CMJ tenga un perfil CMJ. En la consulta agregada de solo lectura realizada para esta revisión había 1 cuenta CMJ y 1 con perfil asociado; el endpoint nuevo deberá comprobar explícitamente la existencia de `cmj_consejero.id_persona = req.usuario.id_persona` en cada operación.
- El middleware actual responde `401` cuando no hay token, pero responde `403` cuando el token es inválido o venció. El contrato de este documento corrige la clasificación a `401`; esa discrepancia deberá corregirse en el middleware al implementar, sin afirmar que el código actual ya cumple.
- El controlador actual exige estado `VALIDADO` o `RECHAZADO`, pero no comprueba que la observación de rechazo tenga contenido. El frontend sí la exige; el backend deberá validarla también.
- `BACKEND/src/config/db.js` usa `mysql2/promise`; el backend ya tiene ejemplos de transacciones en otros controladores. La inspección anterior no encontró un ejecutor propio de migraciones implementado; D7 requiere que se use uno.

### Fuentes contrastadas

- [Plan de corrección D1](./PLAN-CORRECCION-D1-OFICIALIZACION-SEMAFORO.md).
- Esquema original consultado mediante `information_schema`.
- `BACKEND/src/controllers/escenarios.controller.js`, `BACKEND/src/routes/escenarios.routes.js`, `BACKEND/src/middlewares/authMiddleware.js`, `BACKEND/src/config/db.js`.
- `frontend/src/pages/PanelCMJ.jsx`, `frontend/src/services/veeduriaService.js` y `frontend/src/App.jsx`.
- Documentación previa: [Auditoría MySQL](./AUDITORIA-MYSQL.md), [Inventario de objetos MySQL](./INVENTARIO-OBJETOS-MYSQL.md), [Relaciones de la base de datos](./RELACIONES-BASE-DATOS.md) y [Plan de migraciones MySQL](./PLAN-MIGRACIONES-MYSQL.md).

## 3. Modelo de datos propuesto

### 3.1 Campos y significado

Agregar a `reporte_veeduria`:

| Campo propuesto | Tipo propuesto | Significado |
|---|---|---|
| `id_cmj_oficializa` | `INT NULL` | Persona CMJ que realizó la oficialización; FK a `cmj_consejero(id_persona)`. |
| `fecha_oficializacion` | `DATETIME NULL` | Instante de oficialización almacenado como UTC. Nulo mientras no se oficialice. |

La pareja debe estar completamente nula antes de oficializar y completamente informada después. No se debe cambiar el significado de `id_cmj_valida`/`fecha_validacion`: siguen describiendo la operación 1.

Reutilizar los campos existentes de `historial_estado_escenario` para cada nueva oficialización:

- `id_escenario`: escenario del reporte.
- `estado_anterior`: estado del escenario bloqueado al inicio de la operación.
- `estado_nuevo`: `reporte_veeduria.estado_propuesto`.
- `id_reporte`: reporte oficializado.
- `id_cmj`: `id_cmj_oficializa`, no el validador.
- `fecha_cambio`: misma marca temporal de `fecha_oficializacion`.

Agregar una restricción `UNIQUE` sobre `historial_estado_escenario(id_reporte)`. Así un reporte puede tener como máximo un historial de oficialización. Como el campo es nullable, la unicidad no impide conservar múltiples filas históricas cuyo `id_reporte` sea `NULL`. Debe verificarse en el preflight que no existan duplicados antes de crearla.

Conservar los registros históricos existentes sin editar sus columnas. Las filas legadas en el historial no se vuelven a etiquetar como oficializaciones nuevas; no tienen `fecha_oficializacion` ni `id_cmj_oficializa` asociado en el reporte. Las nuevas filas se identifican por la marca nueva en el reporte y guardan el oficializador en `historial.id_cmj`.

### 3.2 Restricciones e invariantes

- Agregar FK `reporte_veeduria.id_cmj_oficializa → cmj_consejero.id_persona`.
- Agregar `CHECK` que exija `id_cmj_oficializa` y `fecha_oficializacion` ambos nulos o ambos informados.
- Mantener `ck_reporte_validacion` y las FKs actuales.
- El estado de oficialización se considera realizado si los dos campos nuevos están informados y existe el historial único con ese `id_reporte`. Una inconsistencia entre estas evidencias es un error de integridad; el endpoint no la debe autocorregir silenciosamente.
- Para nuevas operaciones exitosas, el actor y la fecha guardados en el reporte y en la fila de historial deben coincidir.
- `estado_anterior = estado_nuevo` es válido y obligatorio como registro cuando el estado propuesto ya es el vigente.

## 4. Diseño DDL y aplicación aislada

El SQL siguiente conserva la forma del cambio D1 como referencia. La migración ejecutable ya fue adaptada al ejecutor D7 y se aplicó solamente sobre la copia restaurada y aislada `sivec_restore_test_20261104_484fe0eb`, no sobre `deportes`.

La migración `001_d1_independent_officialization.js` verifica previamente motores, tipos, restricciones, nombres y ausencia de duplicados en `historial_estado_escenario.id_reporte`; agrega las columnas/relaciones D1, impone la unicidad de historial y retira `trg_oficializar_semaforo`. No rellena datos históricos.

```sql
-- Migración D1 — propuesta para MySQL 8.
-- Preflight obligatorio:
--   1. Confirmar esquema/base objetivo y respaldo restaurado.
--   2. Confirmar tipos, signedness, nullability y engines descritos abajo.
--   3. Confirmar nombres libres para FK/CHECK/índices.
--   4. Confirmar cero grupos duplicados de id_reporte no nulo
--      en historial_estado_escenario.
--   5. Confirmar FKs/CHECKs vigentes y pausar escrituras de veeduría.

-- Retirar el acoplamiento antes de habilitar la nueva operación.
DROP TRIGGER IF EXISTS trg_oficializar_semaforo;

ALTER TABLE reporte_veeduria
    ADD COLUMN id_cmj_oficializa INT NULL,
    ADD COLUMN fecha_oficializacion DATETIME NULL,
    ADD INDEX ix_reporte_cmj_oficializa (id_cmj_oficializa),
    ADD CONSTRAINT fk_reporte_cmj_oficializa
        FOREIGN KEY (id_cmj_oficializa)
        REFERENCES cmj_consejero (id_persona)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    ADD CONSTRAINT ck_reporte_oficializacion
        CHECK (
            (id_cmj_oficializa IS NULL AND fecha_oficializacion IS NULL)
            OR
            (id_cmj_oficializa IS NOT NULL AND fecha_oficializacion IS NOT NULL)
        );

ALTER TABLE historial_estado_escenario
    ADD CONSTRAINT uq_historial_reporte_oficializacion UNIQUE (id_reporte);
```

### Preflight estructural obligatorio antes de una instancia integrada o productiva

El ejecutor D7 se preparó y probó primero. Las siguientes comprobaciones se realizaron sobre el respaldo restaurado para la migración aislada; deben repetirse contra una copia verificada de la instancia objetivo antes de cualquier despliegue. El borrador anterior no reemplaza estas comprobaciones:

1. **Motor y versión:** confirmar que las cinco tablas involucradas (`usuario`, `cmj_consejero`, `reporte_veeduria`, `escenario`, `historial_estado_escenario`) son InnoDB y confirmar la versión exacta de MySQL 8 y el soporte/enforcement efectivo de `CHECK`.
2. **Tipos y signo:** obtener `SHOW CREATE TABLE` y metadatos de columnas. Confirmar que `usuario.id_persona`, `cmj_consejero.id_persona`, `reporte_veeduria.id_cmj_valida`, `historial_estado_escenario.id_cmj` y las nuevas FK sean del mismo tipo entero y signedness que `cmj_consejero.id_persona` (el esquema consultado mostraba `INT` firmado). Confirmar que el `INT` propuesto no se cambie a `BIGINT` ni `UNSIGNED` sin migrar coherentemente las referencias.
3. **Fechas:** confirmar precisión, nullability y defaults de las columnas `DATETIME` involucradas. `DATETIME` no almacena zona horaria; el valor se escribirá en UTC conforme a la sección 5.3.
4. **Índices:** confirmar PKs, índice existente `reporte_veeduria.ix_reporte_estado`, índice actual no único de `historial_estado_escenario.id_reporte` y ausencia de otro índice que choque por nombre. Confirmar duplicados con `GROUP BY id_reporte HAVING COUNT(*) > 1` excluyendo `NULL` antes de agregar `UNIQUE`. Evaluar el plan de la consulta candidata con `EXPLAIN`; no agregar un índice compuesto adicional sin justificarlo con esa consulta.
5. **Claves foráneas:** comprobar columnas referenciadas, tipo/signo, índices soporte, nombres y acciones `ON UPDATE`/`ON DELETE`. Verificar `usuario.id_persona → persona.id_persona`, `cmj_consejero.id_persona → persona.id_persona`, `historial.id_cmj → cmj_consejero.id_persona` y FKs existentes de reporte/historial. La nueva FK debe tener columna hija indexada, FK a `cmj_consejero.id_persona` y no permitir borrar el perfil de un oficializador referenciado.
6. **Restricciones:** confirmar `ck_reporte_validacion`, `CHECK` activos/enforced, ausencia de filas incompatibles y disponibilidad del nombre `ck_reporte_oficializacion`. Confirmar que la regla de pares nulos aplica a todos los datos preexistentes.
7. **Compatibilidad y datos:** confirmar que los nuevos nombres de columnas/índices/constraints no existan ya, que no haya diferencias de esquema frente al DDL versionado, y que reportes/historiales hayan sido clasificados según la sección 10.
8. **Precondiciones operativas:** respaldo restaurado y verificado, ejecutor D7 probado, checksum revisado, exclusión de ejecuciones concurrentes y ventana de escrituras pausadas. Si una verificación falla, detenerse; no corregir datos automáticamente.

La copia aislada verificó cero grupos duplicados de historial y aplicó los nuevos campos, FK, `CHECK`, índice único y retirada del trigger. La migración no clasificó candidatos históricos, no atribuyó responsables/fechas ni probó el procedimiento de oficialización, que aún no existe en backend.

### Consideraciones de migración

- `DROP TRIGGER` y los `ALTER TABLE` son DDL; MySQL puede confirmar DDL implícitamente. No prometer que el bloque SQL sea transaccional ni que un `ROLLBACK` restaure automáticamente la definición anterior.
- El orden operativo de cambio, pausa de escrituras y despliegue de API debe acordarse con la versión que dejará de depender del trigger. La nueva API no se habilita hasta que el trigger haya sido retirado y el esquema nuevo esté verificado.
- Si existen duplicados de `id_reporte`, la creación de la unicidad fallará. La migración debe detenerse para revisión; no debe borrar ni fusionar filas automáticamente.
- Los campos nuevos nulos conservan los datos históricos. No se deben rellenar mediante `id_cmj`, `id_cmj_valida` ni fechas de validación: eso inventaría evidencia de un acto independiente que el sistema anterior no registró.
- Los nombres y tipos propuestos deben cotejarse con el DDL exacto y el historial de migraciones justo antes de preparar el archivo ejecutable.
- La cuenta de migración debe tener solo los privilegios DDL necesarios; la aplicación no debe recibir permisos DDL.

## 5. Contrato de API propuesto

Las rutas aprobadas para esta especificación conservan el prefijo existente `/api/escenarios`:

### 5.1 Consultar reportes listos para oficializar

`GET /api/escenarios/reportes/validados-pendientes-oficializacion`

- **Autenticación:** JWT obligatorio.
- **Rol:** solo `CMJ`.
- **Perfil:** además del rol JWT, verificar que `req.usuario.id_persona` corresponde a una fila de `cmj_consejero`.
- **Elegibilidad:** `estado_reporte = 'VALIDADO'`, marca de oficialización ausente y sin historial asociado por `id_reporte`.
- **Respuesta 200:**

```json
{
  "success": true,
  "data": [
    {
      "id_reporte": 123,
      "id_escenario": 7,
      "escenario": "Nombre del escenario",
      "estado_actual": "VERDE",
      "estado_propuesto": "AMARILLO",
      "fecha_reporte": "2026-11-04T01:00:00Z",
      "fecha_validacion": "2026-11-04T02:00:00Z"
    }
  ]
}
```

La consulta debe seleccionar columnas explícitas y exponer únicamente la información necesaria para que CMJ tome la decisión. No debe usar `SELECT *` ni incluir datos personales del reportante salvo que una necesidad aprobada lo requiera. Los valores del siguiente ejemplo son ilustrativos.

### 5.2 Oficializar reporte validado

`POST /api/escenarios/reportes/:id_reporte/oficializar`

- **Autenticación:** JWT obligatorio.
- **Rol:** solo `CMJ`.
- **Perfil:** verificar que `req.usuario.id_persona` existe en `cmj_consejero`.
- **Cuerpo:** vacío. El estado destino se obtiene exclusivamente del `estado_propuesto` del reporte validado.
- **Actor:** `req.usuario.id_persona`, verificado contra `cmj_consejero`; nunca se acepta el actor en el cuerpo.
- **Respuesta 200:** incluye `id_reporte`, estado anterior, estado aplicado, fecha y confirmación de que quedó oficializado. Si el estado anterior ya coincide con el propuesto, la respuesta debe aclarar que se registró la oficialización sin cambio de color.

```json
{
  "success": true,
  "message": "Reporte oficializado.",
  "data": {
    "id_reporte": 123,
    "estado_anterior": "AMARILLO",
    "estado_oficial": "AMARILLO",
    "fecha_oficializacion": "2026-11-04T02:30:00Z",
    "estado_sin_cambio": true
  }
}
```

### 5.3 Respuestas y errores

| HTTP | Uso propuesto |
|---|---|
| `200` | Oficialización completada, incluido el caso de estado sin cambio. |
| `400` | Identificador malformado o solicitud inválida. El endpoint no acepta estado alternativo en el cuerpo. En el endpoint existente de validar/rechazar, una observación de rechazo ausente o vacía tras `trim` también debe responder `400`. |
| `401` | Token ausente, inválido o vencido. El middleware actual devuelve `403` para token inválido/vencido; deberá alinearse con este contrato durante la implementación. |
| `403` | Usuario autenticado sin permisos CMJ, o identidad cuyo `id_persona` no tiene perfil en `cmj_consejero`. |
| `404` | No existe el reporte solicitado. |
| `409` | Reporte no validado, ya oficializado o conflicto de integridad/estado. Incluye historial legado que impida reoficializar y desajustes entre marcas e historial. El cuerpo debe indicar un código estable, por ejemplo `REPORT_NOT_VALIDATED`, `ALREADY_OFFICIALIZED`, `LEGACY_HISTORY_EXISTS` o `OFFICIALIZATION_INTEGRITY_CONFLICT`. |
| `500` | Error inesperado; se revierte la transacción y no se devuelve éxito parcial. La respuesta no expone SQL, credenciales ni datos personales. |

La lista debe responder vacío para cero candidatos; los errores de consulta deben ser explícitos y no convertirse en una lista vacía con apariencia de éxito.

### 5.4 UTC y presentación de fechas

- Almacenar como UTC las nuevas marcas de tiempo de reportes y del flujo D1 (`fecha_reporte`, `fecha_validacion`, `fecha_oficializacion`, `fecha_cambio` y `escenario.fecha_ultima_actualizacion`). Las columnas actuales son `DATETIME` y no guardan zona horaria por sí mismas.
- Dentro de la transacción, obtener una única marca de tiempo UTC con `UTC_TIMESTAMP()` de MySQL y utilizar el mismo valor en el reporte, historial y escenario. La precisión debe corresponder al `DATETIME` validado en el preflight.
- Serializar la respuesta API como fecha ISO 8601 UTC con sufijo `Z` (por ejemplo, `2026-11-04T02:30:00Z`). No devolver un `DATETIME` sin offset como si tuviera zona implícita.
- En el navegador, parsear el instante UTC y presentarlo en la zona horaria local del navegador, indicando claramente que la presentación está localizada; conservar disponibilidad del instante UTC para auditoría. No fijar una zona geográfica no aprobada.
- Revisar la configuración de zona horaria de la sesión MySQL antes de desplegar para que defaults `CURRENT_TIMESTAMP` en nuevas filas sigan la convención UTC; los endpoints D1 que escriben fechas explícitamente deben usar `UTC_TIMESTAMP()`.
- La conversión de fechas históricas a UTC no se infiere ni se realiza en esta migración: su zona horaria original no está demostrada y permanecen como legado. La interfaz no debe presentar esas fechas como UTC sin evidencia; debe identificarlas como fecha histórica con zona no verificada.

## 6. Flujo transaccional y concurrencia

Implementar la operación con una conexión dedicada del pool `mysql2/promise`. Usar una única transacción InnoDB para escenario, reporte e historial:

1. Validar formato del identificador y el rol JWT con middleware `verificarToken` + `permitirRoles('CMJ')`.
2. Obtener `req.usuario.id_persona` y confirmar que existe en `cmj_consejero`. Un token con rol CMJ sin perfil correspondiente no puede oficializar.
3. Iniciar transacción.
4. Leer la fila del reporte por PK con `SELECT ... FOR UPDATE`, obteniendo solo id, escenario, estados y marcas de validación/oficialización.
5. Si no existe: rollback y `404`.
6. Exigir `estado_reporte = 'VALIDADO'`, `id_cmj_valida` y `fecha_validacion` presentes. Si no se cumple: rollback y `409`.
7. Exigir que `id_cmj_oficializa` y `fecha_oficializacion` estén ambos nulos. Si ambos están informados: rollback y `409 ALREADY_OFFICIALIZED`. Si están inconsistentes: rollback y error de integridad, no autocorregir.
8. Consultar si ya existe fila de historial para `id_reporte`. Si existe mientras el reporte aún no está marcado con los campos nuevos, clasificar como historial legado y rechazar la nueva operación con conflicto. No duplicar ni reescribir esa fila.
9. Bloquear el escenario indicado por el reporte con `SELECT ... FOR UPDATE`. Si no existe o no puede leerse de forma consistente, rollback y error.
10. Capturar `estado_anterior = escenario.estado_semaforo`, `estado_nuevo = reporte.estado_propuesto` y una única marca UTC obtenida con `UTC_TIMESTAMP()` para toda la operación.
11. Actualizar `escenario.estado_semaforo = estado_nuevo` y `fecha_ultima_actualizacion = fecha_oficializacion`. Ejecutar la actualización incluso si los estados son iguales; la marca de tiempo refleja el acto de oficializar.
12. Insertar en `historial_estado_escenario` el reporte, escenario, estados, `id_cmj = req.usuario.id_persona` y la misma fecha.
13. Actualizar `reporte_veeduria.id_cmj_oficializa` y `fecha_oficializacion` con el actor y fecha.
14. Confirmar la transacción. Si cualquier lectura, validación o escritura falla, ejecutar `ROLLBACK`; liberar la conexión en `finally`.

### Prevención de doble ejecución

- El `FOR UPDATE` de la fila del reporte serializa solicitudes concurrentes para el mismo reporte.
- La marca de oficialización en el reporte evita repetir una operación completada.
- La restricción única de `historial.id_reporte` es una defensa final ante carreras o errores de aplicación.
- El escenario se bloquea después del reporte y todos los caminos de esta operación deben respetar ese orden para reducir interbloqueos.
- Si una solicitud pierde la carrera, responde `409` y no crea ni modifica nada.
- No se debe implementar reintento automático de la operación completa tras una respuesta incierta de red. El cliente primero debe refrescar el estado; el endpoint posterior responderá conflicto si ya se completó.

### Estado propuesto igual al vigente

No se rechaza ni se omite la operación. Se ejecutan la actualización de fecha, la inserción de historial con `estado_anterior = estado_nuevo` y la marca del reporte con actor/fecha. El reporte queda fuera de la cola de candidatos y no puede oficializarse otra vez.

## 7. Matriz de permisos

| Operación | Público sin cuenta | Usuario autenticado distinto de CMJ | CMJ |
|---|---:|---:|---:|
| Crear reporte ciudadano | Sí, según ruta actual | Sí, según ruta actual | Sí |
| Consultar reportes pendientes de validación | No | No | Sí |
| Validar/rechazar reporte pendiente | No | No | Sí |
| Consultar validados pendientes de oficialización | No | No | Sí |
| Oficializar reporte validado | No | No | Sí, con perfil existente en `cmj_consejero` |
| Consultar historial CMJ | No | No | Sí, sujeto al endpoint existente |

La matriz de esta especificación aplica el límite aprobado para oficialización. La autorización se verifica en backend aunque la interfaz oculte acciones. No se amplían roles de lectura/validación preexistentes.

## 8. Diseño de interfaz CMJ

La página `/cmj` conserva sus acciones actuales de revisión, pero las separa visual y funcionalmente:

### A. Reportes pendientes de validación

- Mostrar acciones separadas `Validar` y `Rechazar`.
- Al validar, actualizar únicamente el estado de reporte y sus datos de validación.
- No cambiar el semáforo del escenario ni mostrar mensaje de oficialización.
- En rechazo, exigir en backend una observación no vacía tras aplicar `trim`; si falta, responder `400` y no modificar el reporte. Mantener la misma validación en el frontend.

### B. Reportes validados pendientes de oficialización

- Cargar desde el endpoint nuevo protegido para CMJ.
- Mostrar escenario, fecha, estado oficial actual y estado propuesto.
- No incluir nombre, identificación, correo ni otros datos personales del reportante en esta cola.
- Acción explícita `Oficializar estado propuesto`; no permitir elegir otro color.
- Pedir confirmación con estado que se aplicará. Si ya coincide con el vigente, explicar que se registrará igualmente la oficialización y el historial.
- Tras éxito, refrescar candidatos, estado del escenario e historial; el botón debe quedar deshabilitado mientras la solicitud está en curso.
- Mostrar conflictos o fallos de red con mensaje y permitir refrescar para consultar el estado real. No reintentar escritura automáticamente.

### C. Historial y accesibilidad

- Mostrar por separado quién validó/cuándo y quién oficializó/cuándo para los registros nuevos.
- Para registros antiguos, presentar una etiqueta explícita como `Legado: oficialización no registrada por separado`; no atribuir `id_cmj` a un oficializador.
- Mantener estados de carga, error y vacío; controles accesibles por teclado y etiquetas visibles.
- Corregir el texto actual del panel que comunica que validar cambia el semáforo.

## 9. Tratamiento de registros históricos y validados existentes

1. No actualizar ni borrar filas de `historial_estado_escenario` previas.
2. No poblar `id_cmj_oficializa` ni `fecha_oficializacion` desde `id_cmj_valida`, `historial.id_cmj` o `fecha_validacion`. El trigger anterior mezcló acciones y no ofrece prueba del actor/fecha de una operación independiente.
3. Historial existente relacionado a un reporte es legado y no se vuelve a crear. La consulta de candidatos lo excluye aunque las nuevas marcas permanezcan nulas.
4. Reportes validados sin historial asociado ni marcas nuevas pueden aparecer como candidatos a una oficialización nueva. Antes de habilitar la cola en producción, se deben identificar y revisar estos candidatos con el responsable autorizado y registrar el resultado de esa revisión. La operación posterior usa el estado propuesto actual, registra el actor/fecha real del acto nuevo y crea historial desde el estado vigente al momento de la transacción.
5. Reportes pendientes y rechazados no son candidatos.
6. La auditoría previa encontró que, en el corte consultado, los 2 reportes validados tenían historial. Es indispensable repetir los conteos y revisar los candidatos sin historial en la copia restaurada/instancia objetivo antes de migrar y antes de habilitar la cola en producción.
7. Si la nueva marca reporta oficialización pero falta el historial, o si existe historial nuevo pero faltan marcas, la API debe registrar el error operativo, no corregirlo silenciosamente. La intervención requiere diagnóstico y procedimiento autorizado.

### 9.1 Procedimiento de detección de inconsistencias

Ejecutar como consulta de solo lectura en el esquema objetivo, antes de habilitar la cola y durante las verificaciones posteriores. La consulta siguiente devuelve solo categorías y conteos: no muestra nombres, correos, identificaciones ni descripciones.

```sql
WITH history_check AS (
    SELECT
        r.id_reporte,
        COUNT(h.id_historial) AS history_rows,
        SUM(CASE WHEN h.id_escenario <> r.id_escenario THEN 1 ELSE 0 END) AS scenario_mismatches,
        SUM(CASE WHEN r.id_cmj_oficializa IS NOT NULL
                      AND h.id_cmj <> r.id_cmj_oficializa THEN 1 ELSE 0 END) AS actor_mismatches,
        SUM(CASE WHEN r.fecha_oficializacion IS NOT NULL
                      AND h.fecha_cambio <> r.fecha_oficializacion THEN 1 ELSE 0 END) AS date_mismatches,
        SUM(CASE WHEN h.estado_nuevo <> r.estado_propuesto THEN 1 ELSE 0 END) AS state_mismatches
    FROM reporte_veeduria r
    LEFT JOIN historial_estado_escenario h ON h.id_reporte = r.id_reporte
    GROUP BY r.id_reporte
),
classified AS (
    SELECT
        CASE
            WHEN (r.id_cmj_oficializa IS NULL) <> (r.fecha_oficializacion IS NULL)
                THEN 'PARTIAL_OFFICIALIZATION_MARK'
            WHEN r.id_cmj_oficializa IS NOT NULL
                 AND hc.history_rows <> 1
                THEN 'MARKED_WITHOUT_EXACTLY_ONE_HISTORY'
            WHEN r.id_cmj_oficializa IS NOT NULL
                 AND (hc.scenario_mismatches > 0 OR hc.actor_mismatches > 0
                      OR hc.date_mismatches > 0 OR hc.state_mismatches > 0)
                THEN 'MARKER_HISTORY_FIELDS_DIFFER'
            WHEN r.id_cmj_oficializa IS NULL
                 AND hc.history_rows > 0
                THEN 'HISTORY_WITHOUT_NEW_MARKERS_REVIEW_AS_LEGACY'
            WHEN r.estado_reporte = 'VALIDADO'
                 AND r.id_cmj_oficializa IS NULL
                 AND hc.history_rows = 0
                THEN 'VALIDATED_WITHOUT_HISTORY_CANDIDATE'
            ELSE 'OTHER_OR_NOT_APPLICABLE'
        END AS category
    FROM reporte_veeduria r
    JOIN history_check hc ON hc.id_reporte = r.id_reporte
)
SELECT category, COUNT(*) AS quantity
FROM classified
GROUP BY category
ORDER BY category;
```

Interpretación y actuación:

1. Ejecutar y archivar el resultado agregado antes de la migración y antes de habilitar la cola productiva.
2. `PARTIAL_OFFICIALIZATION_MARK`, `MARKED_WITHOUT_EXACTLY_ONE_HISTORY` y `MARKER_HISTORY_FIELDS_DIFFER` son inconsistencias: detener el habilitado y revisar con una consulta protegida y control de acceso; no actualizar, completar ni borrar filas automáticamente.
3. `HISTORY_WITHOUT_NEW_MARKERS_REVIEW_AS_LEGACY` incluye historiales existentes anteriores a la migración. Contrastarlos con el baseline protegido tomado durante el preflight/cutover. Los que ya estaban presentes se conservan como legado; los no explicados por ese baseline se investigan como inconsistencias. No atribuir automáticamente al `id_cmj` del historial un acto de oficialización.
4. `VALIDATED_WITHOUT_HISTORY_CANDIDATE` son candidatos, no confirmación de oficialización. Identificarlos y revisarlos individualmente antes de habilitar la cola en producción. Si la revisión no concluye o detecta información contradictoria, mantener el candidato fuera de la cola habilitada hasta resolverlo de forma autorizada.
5. Si la consulta devuelve cualquier categoría de inconsistencia, generar un reporte de diagnóstico sin datos personales y detener las escrituras relacionadas hasta contar con una decisión explícita. No corregir automáticamente ni inferir responsable/fecha.

## 10. Plan de pruebas y criterios de aceptación

Todas las pruebas de escritura y fallo se ejecutan en una base aislada restaurada o entorno de pruebas, nunca contra `deportes` original.

| Caso | Criterio de aceptación |
|---|---|
| Validar un pendiente | El reporte pasa a `VALIDADO`; actor/fecha de validación quedan registrados; estado y fecha del escenario e historial no cambian. |
| Rechazar un pendiente | Sin observación o con observación vacía tras `trim`, backend responde `400` y no escribe; con observación válida, el reporte pasa a `RECHAZADO` y escenario e historial no cambian. |
| Oficializar un reporte validado | `estado_propuesto` se aplica al escenario; historial registra estado anterior/nuevo, reporte, CMJ oficializador y fecha; reporte queda marcado. |
| Estado propuesto igual al vigente | La operación se completa; crea fila de historial con estados iguales, actualiza fecha oficial y marca actor/fecha en el reporte. |
| Intentar oficializar pendiente o rechazado | `409`; ninguna tabla queda modificada. |
| Repetir oficialización secuencialmente | Primera llamada `200`; segunda `409`; una sola fila nueva de historial y una sola marca de oficialización. |
| Dos solicitudes concurrentes mismo reporte | Exactamente una completa; la otra obtiene conflicto; no hay filas duplicadas ni cambio parcial. |
| Dos reportes concurrentes del mismo escenario | Las operaciones se serializan sobre el escenario; cada historial tiene el estado anterior realmente observado y no hay actualizaciones perdidas. |
| Token ausente, inválido o vencido | `401`; ajustar y comprobar el middleware, que actualmente devuelve `403` para token inválido/vencido. |
| Usuario no CMJ | `403`; reporte, escenario e historial sin cambios. |
| JWT CMJ sin perfil en `cmj_consejero` | `403`; no se registra oficialización. |
| Reporte legado con historial | No se ofrece como candidato y el endpoint responde conflicto sin modificar la fila antigua. |
| Reporte validado sin historial ni marca | Se identifica como candidato y requiere revisión individual antes de habilitar la cola de producción; tras revisión autorizada, puede oficializarse y genera trazabilidad nueva. |
| Error al insertar historial | La actualización del escenario y la marca del reporte se revierten; no queda cambio parcial. |
| Error al marcar reporte después de insertar historial | Toda la transacción se revierte, incluido escenario e historial. |
| Duplicados previos antes de migración | Preflight detecta duplicados y detiene migración sin eliminar/alterar filas. |
| CHECK y FK nuevos | MySQL 8 rechaza pares parciales de actor/fecha y CMJ inexistente; los históricos nulos permanecen válidos. |
| Migración y conservación histórica | Conteos y valores históricos antes/después coinciden; trigger se retira; índices y FKs previstos existen. |
| Consulta de cola | Solo devuelve validados sin marca y sin historial previo; no incluye datos personales innecesarios. |
| UI | Validar y oficializar requieren acciones separadas; cola muestra nombre de escenario y estados sin datos personales innecesarios; estado igual muestra confirmación; carga/error/conflicto no presentan éxito falso. |
| Evidencia fotográfica del formulario | Acepta únicamente 1–5 fotos dentro de 5 MB por foto y 20 MB por reporte, resolución y formatos aprobados; rechaza contenido falso/dañado/no permitido; EXIF ausente tras sanitización; previews, eliminación y reemplazo funcionan; las cargas pendientes offline no se confunden con recibidas y GPS del escenario permanece independiente. |

La prueba del fallo del historial debe provocarse mediante un mecanismo de prueba controlado en el esquema aislado. No se debe introducir un fallo deliberado en la base original.

## 11. Riesgos y estrategia de reversión

### Riesgos

- El trigger permanece activo hasta la migración; desplegar código nuevo sin coordinarlo puede producir cambios automáticos adicionales.
- La restricción única fallará si se encuentran asociaciones repetidas entre historial y reporte.
- MySQL puede confirmar implícitamente DDL; no hay rollback atómico garantizado para toda la migración.
- Quitar el trigger antes de habilitar la ruta nueva deja temporalmente sin oficialización; requiere detener escrituras o coordinar una ventana.
- El proyecto no tiene confirmado un ejecutor D7 implementado, aunque su uso está aprobado para migraciones.
- El historial antiguo no distingue validador y oficializador. La UI y consultas deben tratarlo como legado.
- Una respuesta de red perdida después del commit puede hacer que el cliente desconozca el resultado; debe refrescar y no repetir automáticamente.

### Respuesta ante falla / reversión

1. Probar primero en restauración aislada y conservar el respaldo de migración verificado.
2. Aplicar DDL con escrituras de veeduría pausadas; registrar por paso versión, checksum, salida y pre/postcondiciones.
3. Si falla después de retirar el trigger, mantener escrituras pausadas y preferir corregir hacia delante. No reactivar automáticamente el trigger antiguo, porque viola D1.
4. Si el esquema quedó parcial, inspeccionar metadatos y completar el estado aprobado o usar recuperación documentada; no suponer que un `ROLLBACK` revierte DDL.
5. Si se requiere restaurar respaldo, hacerlo primero en entorno aislado para validar la recuperación. Cualquier restauración sobre instancia objetivo requiere autorización expresa y tratamiento de escrituras posteriores al respaldo.
6. Los `ALTER TABLE` que agregan campos/FK/CHECK son estructuralmente aditivos. La unicidad y la eliminación del trigger tienen su propia reversión; no quitar restricciones ni recrear el comportamiento antiguo sin aprobación explícita.

## 12. Aspectos pendientes de aprobación técnica

Las cinco decisiones de negocio de la sección 1 y las orientaciones operativas D1.3 sobre rutas, revisión de candidatos, UTC, observación obligatoria y orden D7 están incorporadas y no se reabren. Antes de implementar, requieren revisión/aprobación técnica:

1. **Modelo de esquema:** validar los nombres/tipos propuestos `id_cmj_oficializa INT NULL` y `fecha_oficializacion DATETIME NULL`, el `CHECK` de pareja nula/informada, la FK a `cmj_consejero.id_persona` y la restricción única de `historial.id_reporte`.
2. **Índice de FK y cola:** revisar el índice explícito `ix_reporte_cmj_oficializa` y el resultado de `EXPLAIN`; no añadir índices compuestos sin evidencia de la consulta real.
3. **Baseline de legado:** aprobar el artefacto técnico protegido que documentará las asociaciones reporte–historial existentes en el cutover, para distinguirlas de inconsistencias posteriores sin completar marcas antiguas.
4. **Formato de errores/fechas:** revisar los códigos estables de conflicto y el formato ISO 8601 UTC propuestos, manteniendo las rutas GET y POST aprobadas y las reglas HTTP corregidas en la sección 5.3.
5. **Prerrequisitos:** D7 y la migración versionada D1 ya se probaron en la copia aislada; antes de cualquier otro objetivo se requiere autorización específica, respaldo restaurado y nueva validación de tipos, signos, índices, claves, restricciones y datos.

La revisión individual de reportes validados sin historial antes de habilitar la cola productiva es una condición operativa aprobada, no una decisión pendiente. La aplicación aislada no autoriza migrar otra instancia ni habilitar la operación productiva.

## 13. Lista ordenada de implementación

1. Revisar/aprobar la evidencia del ensayo aislado y acordar el baseline protegido del legado.
2. Obtener autorización específica para la base objetivo; restaurar y verificar su respaldo en una nueva copia aislada.
3. Repetir el preflight de esquema/datos: FKs, `CHECK`, motores, duplicados por `id_reporte`, reportes validados con/sin historial y nombres de restricciones.
4. D7 ya está implementado y probado en aislamiento. No ejecutar el CLI contra `deportes`; su guardia actual rechaza ese y otros destinos no aislados.
5. Revisar la migración versionada D1 y aplicar solo en la copia autorizada, después de validar checksum, compatibilidad MySQL 8 y recuperación. La aplicación a `deportes` no está autorizada en este bloque.
6. La validación y la oficialización transaccionales están implementadas en `BACKEND/src/services/veeduria.service.js`. La validación no altera escenario ni historial de oficialización; la oficialización independiente exige CMJ, aplica el estado propuesto, y conserva también la operación cuando el color coincide. El rechazo exige observación en backend.
7. Las rutas protegidas y las pruebas unitarias/migratorias están implementadas. El recorrido de servicio y la integridad del esquema se verificaron en la base aislada; aún debe probarse la concurrencia bajo solicitudes simultáneas antes de habilitar la integración en otra instancia.
8. Revisar individualmente los candidatos validados sin historial, documentar la revisión y obtener visto bueno antes de habilitar la cola productiva.
9. Actualizar el panel CMJ y el servicio Axios con dos acciones separadas, actor/fecha, presentación de fechas UTC localizada y manejo de estados legado; no exponer datos personales innecesarios.
10. Ejecutar regresión de permisos, datos históricos, transacciones, idempotencia, igualdad de estados y responsive.
11. Desplegar API/UI/migración de forma coordinada, verificar los criterios de aceptación y actualizar inventario/documentación con evidencia real.

## 14. Estado de este documento

Las migraciones 001–003 y las operaciones backend están implementadas y verificadas únicamente en la copia aislada. El trigger y las tablas de `deportes` permanecen sin modificar. El D1 no está habilitado para una instancia de aplicación hasta que las versiones 001–003 estén aplicadas y verificadas allí mediante autorización separada.
