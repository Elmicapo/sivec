# Plan de integración del nuevo formulario Reportar con D1

**Estado:** el esquema 001–003 y el backend de recepción sin sesión, consultas CMJ, validación e independiente oficialización se probaron en una copia MySQL aislada. Las filas sintéticas se revirtieron. La base original `deportes` no se modificó. Evidencias/fotos, seguimiento público, correo y solicitudes de escenario nuevo siguen pendientes.  
**Alcance:** flujo ciudadano de cuatro etapas, revisión de escenarios nuevos, evidencias, seguimiento e integración con validación/oficialización D1.  
**Alcance del ensayo posterior:** se añadieron el ejecutor D7 y migraciones de esquema; DDL se aplicó solo en `sivec_restore_test_20261104_484fe0eb`. `deportes` se consultó en modo lectura y no se modificó.

## 1. Resumen ejecutivo

El formulario visual de `Reportar` ya es un asistente de cuatro etapas, pero aún no está conectado al backend. El backend recibe reportes JSON para escenarios existentes, exige nombre completo y correo, no consulta ni guarda identificación y devuelve un código aleatorio cuyo hash queda almacenado. No se implementaron cargas de fotografías, consulta ciudadana mediante código ni notificaciones por correo.

En la base original `deportes`, `reporte_veeduria` aún exige `id_escenario` e `id_reportante`, carece de snapshots de contacto, código de seguimiento y relación con fotografías; su trigger todavía oficializa automáticamente al validar. La copia aislada de ensayo ya tiene el esquema de recepción y D1, y allí el trigger fue retirado. El endpoint de oficialización no está implementado.

La implementación separa la **recepción ciudadana** del **reporte operativo que CMJ valida**. Un registro de recepción conserva el snapshot obligatorio de nombre completo/correo y el hash de seguimiento, enlazado al reporte operativo del escenario oficial. La solicitud de escenario nuevo y la evidencia fotográfica siguen pendientes. La validación y la oficialización son dos operaciones explícitas distintas.

Los límites fotográficos aprobados son **1–5 fotografías por reporte**, **5 MB por archivo**, **20 MB acumulados por reporte**, resolución máxima de **1920 × 1920 píxeles** y formatos **JPG/JPEG, PNG y WebP**. Se rechazan SVG, ejecutables, archivos dañados o formatos falsificados; se valida el contenido real, se elimina EXIF, se optimiza conservando legibilidad y el almacenamiento debe ser privado, sin acceso público directo. La ubicación GPS del escenario es independiente y no se obtiene de metadatos de las fotografías. La elección del almacenamiento privado sigue pendiente; aquí no se propone proveedor ni costo.

## 2. Fuentes revisadas y funcionamiento actual

### Fuentes

- `frontend/src/pages/Reportar.jsx`, `frontend/src/pages/Escenarios.jsx`, `frontend/src/pages/PanelCMJ.jsx`, `frontend/src/App.jsx`, `frontend/src/context/AuthContext.jsx` y `frontend/src/services/veeduriaService.js`.
- `BACKEND/src/controllers/escenarios.controller.js`, `BACKEND/src/routes/escenarios.routes.js`, `BACKEND/src/middlewares/authMiddleware.js`, `BACKEND/src/app.js`, `BACKEND/src/config/db.js` y `BACKEND/package.json`.
- [Especificación técnica D1](./PLAN-IMPLEMENTACION-D1.md).
- [Catálogo territorial de Apartadó](./CATALOGO-TERRITORIAL-APARTADO.md): comunas/barrios, corregimientos/localidades, disciplina disponible y limitaciones.
- [Auditoría MySQL](./AUDITORIA-MYSQL.md), [Relaciones de la base de datos](./RELACIONES-BASE-DATOS.md), [Inventario de objetos MySQL](./INVENTARIO-OBJETOS-MYSQL.md), [Contraste de Fase 2](./FASE-2-BLOQUE-1-CONTRASTE.md) y [Plan de migraciones MySQL](./PLAN-MIGRACIONES-MYSQL.md).

### Hallazgos comprobados antes de esta implementación

- `/reportar` es una ruta pública, sin `RutaProtegida`.
- `Reportar.jsx` consulta escenarios existentes con `getEscenarios`, ofrece escenario, estado propuesto, descripción, URL opcional y datos personales de contacto. No implementa wizard, búsqueda, alta provisional de escenario, geolocalización, selección de fotografías, vista previa ni pantalla de revisión.
- `veeduriaService.js` tiene `getEscenarios` y `crearReporte` para este flujo. El envío es JSON; no hay operación para subir archivos ni consultar seguimiento.
- El endpoint de creación usa autenticación opcional. Con token toma `req.usuario.id_persona`. Sin token exige nombre completo, número de identificación y correo, busca una fila `persona` por identificación y reutiliza esa persona si existe; si no, crea una fila nueva. El diseño nuevo debe exigir nombre o apodo y correo en cualquier envío, eliminar la captura/uso de identificación y definir un snapshot de contacto protegido.
- El endpoint responde el `id_reporte`, no un código opaco de seguimiento. No se encontró servicio de correo ni dependencia de envío de correo en el `package.json` del backend.
- `app.js` registra `express.json()` y las rutas de escenarios; no registra middleware de carga multipart ni servicio de almacenamiento de evidencias.
- `reporte_veeduria.evidencia_url` es una URL opcional; la tabla carece de relación de medios, snapshot de nombre/apodo y correo, y código de seguimiento.
- `id_escenario` e `id_reportante` son obligatorios en el esquema documentado. `escenario` tiene `nombre`, `ubicacion`, `latitud`, `longitud`, `tipo` y `estado_semaforo`, pero no los campos estructurados de zona urbana/rural.
- El catálogo público de escenarios se obtiene de `v_rep_escenarios_semaforo` (escenarios activos). No se encontró en la interfaz actual un mapa ni un componente de ubicación cartográfica.
- La relación `disciplina_escenario` permite asociar disciplinas existentes a escenarios. `escenario.tipo` es un texto de tipo de escenario; no se comprobó que sea equivalente al catálogo de disciplinas o a “tipo de deporte”.
- El panel CMJ muestra pendientes y permite validar/rechazar. La cola de reportes validados pendientes de oficialización y el endpoint D1 siguen siendo diseño documentado, no funcionalidad implementada. El trigger `trg_oficializar_semaforo` sigue activo en la base original `deportes`; se retiró solo de la copia aislada de migración.
- El contexto de autenticación conserva `usuario` del login; el formulario actual no asegura captura explícita de nombre o apodo y correo para todos los reportes.
- En el cliente Axios de este proyecto la URL base está configurada como localhost. El nuevo flujo deberá reutilizar el servicio Axios existente, pero la preparación para despliegue público requiere resolver esa configuración en la etapa de despliegue, fuera del alcance de este bloque.

### Estado del backend implementado

- `POST /api/escenarios/reportes` es público, exige nombre completo y correo, no consulta ni guarda número de identificación, registra el reporte como `PENDIENTE` y devuelve el código de seguimiento una sola vez. La base guarda su SHA-256.
- El backend implementa la cola CMJ, detalle protegido, historial por escenario, cola D1 de validados pendientes de oficialización, validación/rechazo con actor, fecha y observación, historial de decisiones, y oficialización en una acción independiente.
- La validación no cambia el semáforo oficial. Solo la ruta de oficialización, protegida para CMJ y con perfil `cmj_consejero`, actualiza el escenario y `historial_estado_escenario`.
- Las rutas fallan de forma cerrada hasta que el ejecutor registre como aplicadas las migraciones 001–003. En la copia aislada, la integración MySQL verificó registro, validación sin cambio del semáforo y oficialización separada; no se habilitó el backend sobre `deportes`.
- No se implementaron carga/validación/almacenamiento de fotos, creación de solicitudes de nuevos escenarios, consulta ciudadana mediante código ni notificaciones de correo. No se contrató ni inventó proveedor de almacenamiento.

## 3. Reutilización y límites del frontend actual

### Reutilizable

- Mantener la ruta pública `/reportar` y el servicio Axios configurado existente.
- Reutilizar `getEscenarios()` para buscar y seleccionar escenarios oficiales, además de los estados de carga/error que ya se usan en las páginas.
- Reutilizar el catálogo y las etiquetas de semáforo `VERDE`, `AMARILLO` y `ROJO` de la interfaz existente.
- Reutilizar `useAuth()` solo para ofrecer una ayuda de captura/autorrelleno opcional después de aprobar el tratamiento de datos. No convertir la autenticación en requisito del reporte.
- Reutilizar patrones de formulario, mensajes de error y estados visuales del frontend; `Reportar.jsx` requiere una reestructuración sustancial para cuatro pasos.

### No reutilizable como solución completa

- El campo `evidencia_url` no carga ni valida fotografías; no debe convertirse en una URL pública suministrada por el navegador.
- El `id_reporte` numérico no debe presentarse como código de seguimiento ni usarse como secreto.
- El flujo actual que busca/crea `persona` por número de identificación debe dejar de hacerlo al crear reportes: no se solicitará ni usará ese número. Todos los reportes conservarán el snapshot obligatorio de nombre/apodo y correo, con acceso restringido.
- La pantalla actual del panel CMJ no separa revisión de escenario, validación de reporte y oficialización del semáforo.

## 4. Diseño funcional de cuatro etapas

### Etapa 1 — Selección del escenario

**Escenario existente**

- Cargar únicamente escenarios oficiales/activos desde la API.
- Ofrecer búsqueda por nombre y datos de ubicación que realmente devuelva el endpoint.
- Mostrar el estado oficial actual como referencia, sin modificarlo ni tratarlo como estado reportado.
- Tratar explícitamente carga, error y cero resultados; no completar datos faltantes con valores inventados.

**Proponer un escenario nuevo**

- Capturar nombre del escenario/cancha, disciplina, zona urbana/rural y ubicación GPS o manual.
- En zona urbana, seleccionar comuna y luego solo un barrio de esa comuna; en zona rural, seleccionar corregimiento y luego solo una localidad vinculada. El catálogo está en [CATALOGO-TERRITORIAL-APARTADO](./CATALOGO-TERRITORIAL-APARTADO.md). No mostrar una lista general desordenada.
- La ubicación manual consiste exclusivamente en seleccionar los campos territoriales jerárquicos; no permite ingresar latitud ni longitud.
- GPS solo se obtiene después de una acción explícita del ciudadano y de conceder permiso al navegador. No solicitar permiso al abrir el formulario. Guardar la coordenada del escenario separada de las fotos; no usar EXIF.
- Seleccionar la disciplina desde el catálogo MySQL `disciplina`, no desde texto libre. La consulta de filas falló con `ER_ACCESS_DENIED_ERROR` antes de confirmar la base de destino; la auditoría documenta los ENUM de categoría/estado, pero no una lista comprobada de disciplinas actuales. Antes de implementar, consultar en modo lectura con acceso autorizado a la instancia correcta. Se propone filtrar por categoría `DEPORTIVA` y estado `ACTIVA`, sujeto a confirmación; véase el documento de catálogo.
- El registro se crea en una bandeja de **solicitudes de escenario**, no en `escenario` ni en el mapa oficial.
- El escenario nuevo requiere revisión explícita del CMJ. No se publica ni se vuelve seleccionable como escenario oficial antes de aprobación.

**Regla de integración:** una solicitud de reporte asociada a un escenario nuevo puede recibir su código de seguimiento de inmediato, pero no se expone en la cola de validación de reportes hasta que el CMJ revise la propuesta y, si la aprueba, el escenario se incorpore al inventario oficial. La revisión/incorporación del escenario no valida el reporte ni cambia el semáforo; después se ejecuta la operación D1 de validación y, en otra acción, la oficialización. Son tres etapas independientes: revisión/incorporación, validación y oficialización.

### Etapa 2 — Estado y descripción

- Elegir `VERDE` (buen estado), `AMARILLO` (mantenimiento) o `ROJO` (deteriorado).
- Capturar descripción de daños, fallas o necesidades.
- Validar que el estado pertenezca a la enumeración; validar descripción no vacía, límites de longitud y normalización tanto en frontend como en servidor. La longitud máxima requiere alineación con la columna `TEXT` y límites HTTP aprobados.
- Para nuevos escenarios, el color propuesto queda asociado al reporte, nunca al registro provisional de ubicación ni al semáforo oficial.

### Etapa 3 — Fotografías y contacto

**Fotografías**

- Exigir de 1 a 5 fotografías válidas; no permitir confirmar con cero fotografías ni más de cinco.
- Limitar cada archivo a 5 MB y el total a 20 MB por reporte. Cliente y servidor deben compartir una única conversión de MB a bytes, declarada en el contrato de carga, y verificar los bytes realmente recibidos.
- Aceptar únicamente JPG/JPEG, PNG y WebP. Rechazar SVG, ejecutables, archivos dañados y contenido que no corresponda con el formato declarado o su extensión.
- En el backend validar firma/magic bytes y decodificar el contenido real; nombre, extensión y MIME declarado no son validación suficiente. Revalidar cantidad y límites individuales y acumulados.
- No aceptar dimensiones mayores a 1920 × 1920 píxeles. Considerar la orientación antes de comprobar dimensiones efectivas y conservar la proporción al redimensionar.
- Eliminar todos los metadatos EXIF antes de almacenar, incluidos GPS. La ubicación del escenario solo procede de la alternativa GPS o de la entrada manual de la etapa 1; nunca se extrae de las fotos ni se conserva EXIF para obtenerla.
- Optimizar/re-encodear en un formato permitido, preservando la legibilidad necesaria para identificar daños. La implementación debe probar calidad y dimensiones con imágenes de referencia.
- Mostrar vista previa y nombre/tamaño/estado por archivo. Permitir quitar o reemplazar una foto antes del envío; recalcular cantidad y tamaño acumulado, validar el reemplazo y liberar previews temporales.
- Mantener estados por archivo: pendiente de carga, cargando, cargada, error o cancelada. Marcar como cargada solo tras confirmación del servidor. Reintentar sin duplicar, asociar cargas a un borrador y no aceptar archivos de otro reporte.
- Sin conexión, pausar las cargas, mantenerlas como pendientes y conservar la selección mientras la página permanezca abierta. Al recuperar conexión, permitir reintentos controlados; el envío final exige confirmación explícita y todas las fotografías aceptadas por el servidor. No presentar éxito por una carga local pendiente.
- No afirmar que los archivos persisten al cerrar o recargar si solo están en memoria. Si se propone persistencia local entre sesiones, requiere aprobación de privacidad y diseño; deberá explicitar consentimiento, almacenamiento del origen (por ejemplo IndexedDB, no `localStorage`), cuota, caducidad y eliminación tras envío/cancelación. La opción de no persistir debe advertir que cerrar/recargar puede perder el borrador y las fotos no cargadas.
- Almacenar las imágenes fuera de MySQL en un destino privado aprobado. MySQL conserva metadatos verificados y claves opacas, nunca blobs ni URLs públicas. El acceso CMJ debe ser autorizado o mediante URL firmada temporal, no pública.
- La selección del destino, backups, análisis antimalware adicional y retención siguen pendientes. Los límites de tamaño, cantidad, resolución, formatos, eliminación de EXIF y optimización ya están aprobados; no contratar ni configurar almacenamiento en este bloque.

**Datos de contacto obligatorios para todos los reportes**

- Solicitar nombre o apodo y correo electrónico en todos los envíos, con o sin sesión iniciada. No solicitar número de identificación.
- Guardar un snapshot del nombre/apodo y correo en la recepción del reporte, con acceso limitado a los roles autorizados que lo necesiten. No buscar ni crear filas `persona` por número de identificación para asociar reportes.
- Todos los reportes reciben código único de seguimiento. Las notificaciones pueden enviarse al correo capturado para cualquier reporte, una vez que se aprueben proveedor, eventos, consentimiento y políticas de reintento.
- No extraer destinatarios de metadatos de imagen ni de asociaciones automáticas en `persona`. No mostrar el correo en la consulta pública de seguimiento ni incluirlo en logs, telemetría o nombres de archivo.
- La confirmación de consentimiento, verificación del correo y retención de los datos de contacto requieren definirse antes del despliegue.

### Etapa 4 — Revisión, confirmación y envío

- Presentar resumen de escenario existente o datos del escenario propuesto, ubicación, estado, descripción, fotos, nombre/apodo y correo.
- Mostrar las fotografías aceptadas y su estado; permitir volver a la etapa 3 para quitarlas o reemplazarlas. Mostrar GPS como atributo del escenario, no como ubicación deducida de una fotografía.
- Permitir volver a etapas previas sin perder la selección temporal.
- Antes de crear el reporte, validar de nuevo en el servidor las reglas de escenario, estado, contacto y fotografías.
- Crear solicitud, snapshot de contacto, metadatos de evidencia, código de seguimiento y —cuando el escenario ya es oficial— reporte pendiente en una operación coordinada.
- Mostrar el código solo después de confirmación exitosa; indicar que debe guardarse. No mostrar éxito si el almacenamiento o la persistencia esencial falló.
- Para escenario nuevo, mostrar que la ubicación está pendiente de revisión CMJ y que la revisión del escenario no equivale a validar el reporte ni oficializar el semáforo.

## 5. Arquitectura propuesta de recepción y flujo CMJ

Se recomienda mantener una entidad de recepción ciudadana independiente del reporte que el CMJ valida, para conservar `reporte_veeduria.id_escenario NOT NULL` y evitar que reportes sin escenario oficial entren accidentalmente en la operación D1.

### Modelo de datos preparado en la migración 002

1. **`solicitud_escenario`**: nombre, disciplina FK, jerarquía urbana/rural, clasificación de localidad (incluye `PENDIENTE_VERIFICACION`), fuente GPS/manual, coordenadas solo para GPS, revisión CMJ y escenario oficial resultante. Sus checks impiden coordenadas con ubicación manual y exigen revisor/fecha y escenario al aprobar.
2. **`solicitud_escenario_historial`**: cambios de estado con actor CMJ, fecha y observación; las FKs impiden registrar perfiles inexistentes.
3. **`solicitud_veeduria`**: digest binario único del código de seguimiento, nombre/apodo y correo obligatorios, estado propuesto, descripción, fecha de recepción, vínculo exclusivo a escenario oficial o propuesta nueva y vínculo único nullable a `reporte_veeduria`. No contiene ni solicita número de identificación.
4. **`evidencia_veeduria`**: referencia privada (clave de objeto, no URL pública), MIME real permitido, bytes, dimensiones, SHA-256, orden y confirmación de EXIF eliminado. El máximo de cinco posiciones, 5 MB por archivo y dimensiones hasta 1920 × 1920 se restringen en MySQL.
5. **`reporte_veeduria.id_reportante`**: ahora nullable para conservar las filas históricas y permitir que los nuevos reportes usen el snapshot obligatorio de contacto en `solicitud_veeduria`, sin crear/reutilizar `persona` mediante identificación. `v_historico_veedurias` usa `LEFT JOIN` para no ocultar esos reportes y no expone el snapshot.

Estos cambios están implementados por migración y verificados únicamente en `sivec_restore_test_20261104_484fe0eb`, no en `deportes`. No se creó outbox: los eventos, proveedor, consentimiento, costos y reintentos de correo siguen pendientes. Las operaciones de escenario, reporte y oficialización tampoco se habilitan por el DDL; requieren backend autorizado.

El límite de una fotografía y el máximo acumulado de 20 MB no se pueden garantizar con los checks por fila implementados: deben imponerse en el servicio de recepción antes de confirmar. MySQL tampoco valida el contenido real, elimina EXIF ni almacena archivos. No se asigna estado de aprobación/inventario mediante triggers.

### Secuencia de estados y colas

```text
Envío ciudadano
  ├─ Escenario oficial existente
  │    └─ crear reporte_veeduria PENDIENTE
  │          └─ Cola 1: CMJ valida o rechaza (sin tocar semáforo)
  │                └─ Si VALIDADO: Cola 2 de D1
  │                      └─ CMJ oficializa por separado; crea historial
  │
  └─ Escenario nuevo
       └─ solicitud_escenario PENDIENTE + solicitud_veeduria con tracking
             ├─ CMJ rechaza solicitud de escenario: no inventariar ni mapear
             └─ CMJ aprueba solicitud de escenario:
                   crear escenario oficial y relacionarlo
                   crear/enlazar reporte_veeduria PENDIENTE
                     └─ Cola 1 de validación, luego Cola 2 de D1
```

La bandeja de solicitudes de escenario es distinta de las colas de reporte. La aprobación de una ubicación no cambia el estado de reporte y la validación del reporte no cambia el semáforo. La oficialización conserva D1 y exige CMJ. El trigger actual debe retirarse solo mediante la migración D1 autorizada después de preparar y probar D7; no se modifica en este bloque.

### Endpoint y servicios a diseñar

Las rutas aprobadas en D1 permanecen:

- `GET /api/escenarios/reportes/validados-pendientes-oficializacion`
- `POST /api/escenarios/reportes/:id_reporte/oficializar`

No implementadas a la fecha de esta planificación.

Se requiere además definir contratos para:

- Búsqueda/consulta de escenarios oficiales.
- Envío de solicitud de reporte con escenario existente o nuevo, snapshot obligatorio de contacto y referencias de evidencia.
- Consulta de seguimiento usando código enviado en el cuerpo de una solicitud HTTPS, no en la ruta/query string que suele quedar en logs.
- Bandeja CMJ de solicitudes de escenarios y operación protegida de aprobación/rechazo.
- Consulta protegida de evidencia solo para roles autorizados.

Los nombres/métodos definitivos de estas rutas complementarias requieren aprobación técnica. El endpoint de seguimiento no debe exponer descripción, correo ni fotografías sin que exista una necesidad y autorización explícitas.

## 6. Fotografía, seguridad y privacidad

### Controles obligatorios en diseño

- Cantidad: 1–5 fotografías por reporte; validar simultáneamente en cliente y servidor.
- Límites aprobados: 5 MB por archivo, 20 MB acumulados, resolución máxima 1920 × 1920 y 1–5 fotografías por reporte; formatos JPG/JPEG, PNG y WebP.
- Comprobar firma/magic bytes y decodificar el contenido real; no confiar solo en extensión o `Content-Type`.
- Rechazar SVG, ejecutables, archivos dañados o formatos falsificados; reencodear/optimizar conservando legibilidad y eliminar completamente EXIF antes de almacenar.
- Generar claves de almacenamiento aleatorias; mantener buckets/contenedores privados y separar staging de producción. No usar nombres originales como ruta de objeto.
- Limitar tiempo de carga, tamaño de request, cantidad de solicitudes y concurrencia. La API actual no tiene parser multipart ni límites específicos de archivos.
- Aplicar autorización en backend para evidencia. No servir directorios de carga como estáticos. Auditar que enlaces temporales no se registren ni persistan como URL permanente.
- No extraer la ubicación del escenario desde EXIF: las coordenadas del escenario son datos independientes capturados mediante GPS/manual.
- Limpiar objetos huérfanos solo por proceso explícito y con retención aprobada; no borrarlos durante una transacción de base sin poder restaurarlos.
- Proteger el endpoint de tracking con código opaco de alta entropía, digest almacenado, comparación segura, rate limit, respuesta uniforme y `Cache-Control: no-store`. No usar `id_reporte` como secreto.
- El código se devuelve en la confirmación una vez. La recuperación posterior, caducidad y rotación/reemisión dependen de D6 y requieren aprobación; podría estudiarse recuperación por el correo registrado, pero no se debe asumir implementada.
- Proteger nombre/apodo y correo en cada reporte con permisos mínimos, campos separados y retención definida. El personal del CMJ solo debe recibir lo necesario para revisión.

### Arquitectura de almacenamiento

MySQL guarda referencias y metadatos, no archivos binarios. La selección de almacenamiento (local privado, servidor u objeto administrado) queda pendiente: debe considerar despliegue público, backup, disponibilidad, costos y URL firmada. No seleccionar ni contratar proveedor en este bloque. Sin almacenamiento privado aprobado y control de acceso no se debe habilitar la etapa de fotos.

La disponibilidad del sistema de correo también está por definir. Se recomienda un patrón outbox: crear evento de notificación en la misma transacción de base que confirma una transición; un trabajador separado intenta entregar al correo registrado y registra resultado sin revertir el reporte si el proveedor está temporalmente indisponible. No se encontró actualmente servicio SMTP ni biblioteca de correo. El remitente, proveedor, costos, eventos a notificar, consentimiento, reintentos, retención y plantillas requieren aprobación. El correo se limita a los propósitos y eventos aprobados y no se revela en la consulta pública.

## 7. Cambios propuestos por capa y relación con D1/D7

### Frontend

- Reestructurar `Reportar.jsx` en cuatro pasos con progreso accesible, validación por etapa, resumen, navegación atrás y persistencia temporal en memoria mientras se completa el envío; cualquier persistencia offline tras cerrar/recargar requiere decisión de privacidad previa.
- Reutilizar Axios y `getEscenarios`; agregar funciones de servicio para recepción, carga de evidencia/estado de carga, seguimiento y consulta/bandeja CMJ cuando sus contratos estén aprobados.
- Agregar selector de escenario existente/nuevo, zona urbana/rural, geolocalización iniciada por usuario, opción manual y vista previa/gestión de 1–5 imágenes con límites de 5 MB por archivo, 20 MB acumulados, 1920 × 1920 y formatos JPG/JPEG, PNG o WebP. La ubicación GPS pertenece al escenario y no a la foto/EXIF.
- Exponer por archivo el estado de carga, errores y reintento; al perder conectividad, mantener las fotos como pendientes y bloquear el envío hasta que vuelvan a estar cargadas y validadas por el servidor. Permitir quitar/reemplazar antes de confirmar.
- Pedir nombre o apodo y correo obligatorios para todos los reportes, sin campo de número de identificación. La sesión no omite los campos requeridos ni sustituye el consentimiento aplicable.
- En confirmación, mostrar código de seguimiento y estados distintos de solicitud de escenario, revisión del reporte y oficialización.
- Actualizar `PanelCMJ.jsx` con una bandeja separada de escenarios propuestos, la cola de reportes pendientes y la cola D1 de validados por oficializar. Nunca combinar aprobar escenario, validar reporte y oficializar en un botón.
- Mostrar a CMJ nombre del escenario y estado actual/propuesto; datos de contacto únicamente si la política aprobada y el propósito de revisión lo requieren. No exponer datos personales a vistas públicas.
- No crear un mapa oficial con escenarios provisionales.

### Backend y API

- Separar responsabilidades en controladores/servicios: recepción de reporte, carga y lectura de evidencia, seguimiento, aprobación de escenario, validación D1 y oficialización D1.
- Eliminar del flujo nuevo la captura/consulta/creación de `persona` por número de identificación. Conservar en la recepción el snapshot obligatorio de nombre/apodo y correo. Mantener compatibilidad de lectura de registros históricos.
- Validar escenario de destino, campos obligatorios de contacto, estado permitido, descripción, cantidad de archivos, límite individual/acumulado en bytes, resolución, firma y contenido decodificado, formato permitido, EXIF eliminado, optimización, propiedad de cargas temporales y estado completo de carga antes de confirmar.
- Crear la recepción, snapshot de contacto y código; los reportes de escenarios oficiales llegan a la cola de validación. Los escenarios nuevos esperan revisión separada.
- Asegurar acceso solo CMJ para revisión de escenario, validación, oficialización y lectura interna de evidencia; mantener validación y oficialización transaccionalmente separadas.
- La validación de reportes rechazados debe exigir en el backend `observacion_cmj` no vacía después de `trim` (requisito D1).
- La oficialización debe cumplir la especificación [PLAN-IMPLEMENTACION-D1](./PLAN-IMPLEMENTACION-D1.md): actor CMJ, estado propuesto, transacción, historial obligatorio incluso cuando anterior = nuevo, idempotencia y protección concurrente.
- Enviar correo al contacto registrado solo para los eventos aprobados; no hacer que la entrega defina el éxito de persistencia del reporte.
- Enmascarar secretos/códigos en logs y no incluir información personal en mensajes de error.

### MySQL

Preparar migraciones nuevas y versionadas mediante el ejecutor propio D7. Este documento no contiene SQL ejecutable. El diseño requiere, como mínimo, evaluar:

1. Tabla de recepción/seguimiento para código hash, snapshot obligatorio de nombre/apodo y correo, detalles de reporte, escenario seleccionado o solicitud provisional y referencia al reporte D1 operativo.
2. Tabla staging de escenario propuesto con jerarquía zona/comuna/barrio o zona/corregimiento/localidad, `id_disciplina` del catálogo existente, fuente de ubicación, coordenadas únicamente para GPS autorizado, estado de revisión, CMJ revisor/fecha y enlace al escenario oficial cuando se apruebe. La ubicación manual no acepta latitud/longitud.
3. Relación de medios con referencias privadas y metadatos de cada fotografía.
4. Outbox de correo para destinatarios de todos los reportes, si se aprueba el patrón asíncrono.
5. Relación desde `reporte_veeduria` a recepción cuando se materializa un reporte operativo, preservando `id_escenario NOT NULL` para reportes que entran a D1.
6. Campos separados de contacto necesarios para conservar el snapshot D6 sin usar `persona` como almacenamiento accidental. Decidir qué entidad es la fuente canónica para no duplicar PII innecesariamente.
7. Constraints/FKs/índices: código/hash único, relación de solicitud a reporte, uno de los destinos escenario existente/provisional, estados y actor CMJ; coherencia jerárquica territorial y referencia a una disciplina existente. Coordenadas solo para GPS autorizado; la entrada manual no incluye coordenadas. Validar filas existentes, tipos/signos y nombres antes de ejecutar.
8. Revisar vistas `v_rep_escenarios_semaforo`, `v_historico_veedurias` y `v_reportes_pendientes` para que incluyan solo escenarios aprobados y las nuevas colas sin exponer contacto o seguimiento en vistas públicas.
9. Conservar filas antiguas, FKs, `CHECK`, reportes e historial; no backfillear nuevos estados/contactos/códigos con datos inventados.

**Orden D7/D1:** el ejecutor y las migraciones 001–003 se aplicaron en una copia restaurada aislada; el servicio se verificó allí con transacción y rollback. No se han aplicado en `deportes`. La secuencia de despliegue debe coordinar API y esquema e impedir que una versión de aplicación dependa del trigger ya retirado.

## 8. Riesgos y dependencias

| Riesgo o dependencia | Consecuencia | Tratamiento recomendado |
|---|---|---|
| Una ubicación nueva no tiene `id_escenario` oficial | No puede cumplir la FK actual ni entrar a la cola D1 | Mantenerla en staging y materializar `reporte_veeduria` solo tras aprobación del escenario. |
| Selección territorial sin jerarquía | Comuna/barrio o corregimiento/localidad podrían quedar asociados incorrectamente | Usar selectores encadenados desde el catálogo suministrado; conservar la relación y validarla en backend. |
| Catálogo territorial no verificado oficialmente | Una lista local podría presentarse como certificación institucional | Identificarlo como relación proporcionada y pendiente de verificación; registrar diferencias para revisión sin corregir la fuente silenciosamente. |
| No se pudieron consultar filas de `disciplina` | No puede prepararse una lista verificada ni confirmarse las disciplinas habilitadas | La consulta de solo lectura falló con `ER_ACCESS_DENIED_ERROR` antes de confirmar la base de destino; obtener acceso autorizado a la instancia correcta antes de integrar, sin crear una lista fija ni usar texto libre. |
| Trigger actual D1 sigue activo | Validar puede cambiar semáforo automáticamente | D7 + migración D1 y despliegue coordinado antes de habilitar el nuevo flujo CMJ. |
| Cambio de esquema de reporte/vistas | Puede romper consultas actuales y panel CMJ | Mantener compatibilidad temporal; probar todas las vistas, rutas y colas en copia aislada. |
| El flujo actual vincula la recepción a `persona` mediante identificación | Asociación y almacenamiento de datos personales distintos del flujo aprobado | Eliminar esa dependencia; verificar que el snapshot obligatorio de contacto se conserva sin solicitar ni usar número de identificación. |
| Código de seguimiento es credencial de acceso | Filtración permite consultar reportes | Token aleatorio, guardar hash, endpoint rate-limited, no log, respuestas minimizadas y decisión de retención. |
| Fotografías públicas o con EXIF | Divulgación de imágenes/localización y PII | Almacenamiento privado, verificación/reencode, retirar EXIF y entrega autorizada. |
| Selección del destino privado/offline pendiente | No puede habilitarse carga real o persistencia del borrador entre sesiones de forma segura | Aprobar almacenamiento privado, backups y retención; definir explícitamente si se permite persistencia local offline y sus salvaguardas. Los límites de archivo/foto aprobados no se deben reabrir. |
| Servicio de correo no existe | Notificaciones no pueden probarse ni operar | Aprobar proveedor/costo y eventos; implementar outbox y monitoreo en etapa autorizada. |
| Solicitud de escenario rechazada | Reporte asociado queda sin escenario oficial | Definir estado visible al ciudadano, posibilidad de corregir/re-enviar y tratamiento del reporte/evidencias; no convertir rechazo de escenario en rechazo de reporte sin decisión. |
| Disciplina deportiva se toma de catálogo que también admite categoría cultural | Podrían ofrecerse opciones que no correspondan a una disciplina deportiva | Propuesta de filtro `categoria=DEPORTIVA` y `estado=ACTIVA`, sujeta a confirmación y a consultar las filas reales; mantener `id_disciplina` como referencia, no texto libre. |
| Categoría territorial mal vinculada o fuente geográfica ambigua | La jerarquía y el origen geográfico podrían ser inconsistentes | Las listas encadenadas validan la pertenencia territorial; manual solo usa los campos territoriales, GPS requiere acción/permiso y EXIF nunca reemplaza GPS. |
| Fechas históricas tienen zona no demostrada | Presentación o migración UTC incorrecta | Mantener historia como legado; nuevas fechas UTC, no convertir datos históricos sin evidencia. |
| No hay suite backend configurada | Regressions en transacciones, cargas y permisos | Incorporar pruebas de API/DB aislada antes de declarar listo; el script `test` actual es marcador sin suite. |
| API client base local | Frontend no desplegable públicamente sin ajuste | Resolver configuración de entorno como trabajo de despliegue separado, sin hardcode nuevo. |

## 9. Pruebas necesarias y criterios de aceptación

### Etapa ciudadana

- Escenario oficial: búsqueda, selección y envío; recibe código; queda reporte `PENDIENTE` elegible para validación.
- Escenario vacío, fallo API y reintento de lectura muestran estados explícitos; no se genera escenario falso.
- Escenario nuevo urbano/rural: probar GPS solicitado y permitido, GPS denegado/coordenada GPS inválida y ubicación manual mediante solo campos territoriales; no entra al inventario/mapa antes de aprobación.
- Selector territorial encadenado: cada comuna solo muestra sus barrios y cada corregimiento solo sus localidades; entradas `C.P.` conservan esa clasificación y no se mezclan en una lista desordenada.
- Ubicación manual no ofrece ni acepta latitud/longitud; GPS no se solicita al abrir el formulario y solo se usa tras petición expresa y permiso. No se toman coordenadas desde EXIF.
- La disciplina se carga del catálogo MySQL; probar carga/error, opciones según filtro aprobado y rechazo de disciplina inexistente/inactiva, sin texto libre como fuente principal.
- Revisar escenario propuesto: solo CMJ puede consultar/aprobar/rechazar; aprobación crea exactamente un escenario oficial y vincula la solicitud; no cambia el semáforo ni valida el reporte.
- Escenario nuevo rechazado: no se crea escenario oficial, no entra en colas D1 y su tracking refleja la revisión; el flujo de corrección/aviso sigue la decisión aprobada.
- Estado requerido y descripción; entradas vacías, demasiado largas y caracteres límite se validan en cliente y servidor.
- Selección de una, cinco, cero y seis fotografías; cero y seis se rechazan. Probar límites de 5 MB por archivo y 20 MB por reporte, tamaños justo por debajo/encima, resolución hasta 1920 × 1920 y por encima, formatos JPG/JPEG/PNG/WebP, SVG, ejecutable, contenido falsificado, archivo corrupto y MIME/extensión falsos.
- Verificar que se retiran todos los EXIF (incluido GPS), que la optimización conserva legibilidad, y que no existe acceso público directo ni se sirve URL suministrada por el cliente.
- Vista previa, eliminación y reemplazo antes de envío: actualizar totales/estados, liberar preview y rechazar un reemplazo que viole cantidad, tamaño, formato o resolución.
- Carga interrumpida por falta de conexión, retorno de red, reintento, cancelación, cierre/recarga y error del servidor: no presentar pendientes como cargadas, no perder selección mientras esté en memoria y no crear duplicados. Si se aprueba persistencia offline, probar consentimiento, expiración y borrado local.
- Confirmar que solo GPS autorizado produce coordenadas del escenario, la opción manual conserva únicamente campos territoriales y EXIF nunca aporta coordenadas.
- Confirmación duplicada, objeto huérfano, error de almacenamiento, error de MySQL y reintento: no entregar código de éxito para una recepción incompleta ni crear duplicados.
- Nombre/apodo y correo son obligatorios con y sin sesión; los datos se guardan en el snapshot autorizado, sin solicitar número de identificación.
- Rechazar nombre/apodo o correo ausente/malformado; comprobar que no se consulta, crea o reutiliza `persona` mediante número de identificación para recibir el reporte.
- Todos los reportes generan código único tras persistencia exitosa; el correo no aparece en la respuesta pública de seguimiento.
- Confirmación: resume exactamente lo enviado, permite volver atrás, genera/expone código solo tras commit y explica revisión de escenario separada de D1.

### Seguimiento, privacidad y notificaciones

- Código único, aleatorio, no secuencial; almacenamiento solo de digest; `id_reporte` no sirve como código.
- Código correcto/incorrecto, brute-force/rate limit, enumeración, code en URL/log/cache, respuesta no cacheable y campos devueltos mínimos.
- El seguimiento no filtra correo, nombre, número de identificación, descripción o fotos salvo el mínimo de estado aprobado.
- Notificación al correo registrado según los eventos aprobados; falla SMTP/outbox no revierte recepción y los reintentos no duplican correos. Probar cada evento solo después de aprobarlos.
- Retención/caducidad y recuperación se verifican contra política D6 aprobada; no asumir que un código es válido indefinidamente.

### D1 y regresión de CMJ

- Validar no modifica el estado oficial ni crea historial de oficialización.
- Rechazar con observación faltante/vacía devuelve `400` backend y no escribe; con observación valida, solo cambia estado del reporte.
- Reporte ligado a escenario nuevo no aparece en validación hasta que la solicitud de escenario esté aprobada y el reporte operativo materializado.
- Reporte validado existente entra a la cola de oficialización solo si no tiene historial legado ni marca; candidatos heredados sin historial se revisan antes de activar cola productiva.
- Oficialización por CMJ usa el estado propuesto, se registra incluso si el estado coincide, escribe actor/fecha/historial en una transacción e impide segunda ejecución y carreras.
- Perfil CMJ ausente, roles distintos, token ausente/inválido/vencido y reportes no elegibles generan respuestas HTTP aprobadas y cero escrituras no autorizadas.
- Falla de escritura de historial revierte escenario y marcas; se prueba solo en una copia aislada.
- Historial preexistente conserva filas, responsables/fechas originales y apariencia de legado; ninguna atribución retroactiva.
- Accesibilidad móvil/escritorio, teclado/lector, permisos de geolocalización, carga en red lenta, reduced motion y UX de errores/cancelación.

## 10. Decisiones y parámetros todavía pendientes

Las reglas de flujo y todos los límites fotográficos indicados por el responsable se consideran aprobados: 1–5 fotos, 5 MB por archivo, 20 MB acumulados, 1920 × 1920 píxeles, JPG/JPEG/PNG/WebP, rechazo de SVG/ejecutables/dañados/falsificados, validación real, eliminación EXIF, optimización legible y almacenamiento privado. No se deben inventar los detalles que siguen:

1. Proveedor/ubicación del almacenamiento privado, backups, costos, análisis antimalware adicional y política de retención/eliminación.
2. Convención exacta para convertir MB a bytes (decimal/binaria), común en cliente y servidor.
3. Si se autoriza persistencia offline de fotos entre recargas/cierres; definir consentimiento, privacidad, cuota, caducidad y eliminación local. El flujo en memoria debe distinguir lo pendiente y reintentar sin declarar éxito.
4. Verificación institucional del catálogo territorial y cualquier ajuste formal de nombres/clasificación; las discrepancias no cambian silenciosamente la relación proporcionada.
5. Consulta de solo lectura con permisos autorizados para enumerar disciplinas actuales, categorías por fila, estados y relaciones; esta revisión obtuvo `ER_ACCESS_DENIED_ERROR`.
6. Confirmar si el selector de disciplina filtra `categoria=DEPORTIVA` y `estado=ACTIVA`; no habilitar texto libre como reemplazo de la tabla.
7. Reglas de aprobación/rechazo del escenario nuevo, motivo requerido, edición/reenvío, detección de duplicados y notificación cuando no se incorpora al inventario.
8. Vida útil, recuperación/reemisión y alcance de consulta del código de seguimiento (D6).
9. Eventos de correo, remitente, proveedor, verificación del correo, reintentos, plantillas, retención y costos. No hay integración de correo actual.
10. Consentimiento, acceso interno, plazo de conservación y borrado de snapshots de contacto.
11. Estados públicos exactos del tracking y campos visibles, incluyendo cuánto detalle del rechazo de escenario o del reporte se revela.
12. Elección final entre entidad de recepción/staging recomendada y otra estructura compatible; DDL y diseño detallado se revisan después de preparar D7.
13. Política de transición entre solicitud de escenario aprobada y reporte operativo: transacción única, tratamiento de error parcial y momento exacto en que el ciudadano recibe estado `PENDIENTE` de validación.
14. URL base de frontend y despliegue: el cliente actual aún requiere preparación para ambiente público; queda fuera del alcance documental de este bloque.

## 11. Secuencia recomendada de implementación

1. Verificar institucionalmente el catálogo territorial y obtener consulta autorizada de solo lectura de las filas `disciplina`; aprobar el filtro de categoría/estado para el selector. Registrar discrepancias sin cambiar silenciosamente el catálogo suministrado.
2. Cerrar solo los detalles pendientes de fotos (convención MB/bytes y persistencia offline); la ubicación manual se limita a campos territoriales y no acepta coordenadas. Mantener los límites fotográficos aprobados como requisitos fijos.
3. Aprobar tratamiento de escenarios propuestos, rechazo, estados de seguimiento, privacidad/retención D6 y eventos de correo.
4. Seleccionar almacenamiento privado y definir permisos, backup, URL temporal, monitoreo y costos; no contratar antes de aprobación.
5. Cerrar el modelo de recepción/staging y contratos API; documentar clasificación D1 entre revisión de escenario, validación de reporte y oficialización.
6. El ejecutor D7 y las migraciones 001–003 se probaron en la copia restaurada aislada; conservar los checksums y evidencia en [`BACKEND/migrations/README.md`](../BACKEND/migrations/README.md).
7. Solicitar aprobación específica antes de aplicar a otra copia o instancia; repetir allí el preflight y el respaldo verificado. El original `deportes` permanece fuera de este ensayo.
8. Implementar backend para recepción, escenarios provisionales, carga segura, tracking, validación y oficialización D1; añadir límites, permisos y errores coherentes. No usar tablas nuevas desde el API hasta revisar el contrato.
9. Terminar wizard frontend y panel CMJ coordinados con las APIs; actualmente el formulario visual está, pero el envío está bloqueado por ausencia de backend.
10. Ejecutar pruebas de API, almacenamiento privado, correo, permisos, abuso, privacidad, concurrencia, integridad y responsive en entorno aislado.
11. Revisar individualmente candidatos validados sin historial y escenarios provisionales; documentar decisiones sin crear datos retroactivos.
12. Desplegar de forma coordinada, comprobar publicación solo de escenarios aprobados, eventos de correo aprobados, D1 independiente, seguimiento y recuperación del backup.

No se ejecutó DDL/DML sobre `deportes`. Los servicios, el acceso a almacenamiento privado, correo y las migraciones en cualquier otra base siguen sujetos a decisiones y autorización posteriores.

## 12. Criterio de aceptación del bloque de planificación

Este plan se considera completo cuando el responsable apruebe los parámetros pendientes y el modelo objetivo. El flujo no debe considerarse implementado hasta comprobar que:

- cada recepción tiene código de seguimiento seguro y conserva el snapshot obligatorio de nombre/apodo y correo;
- una solicitud de escenario nuevo no aparece en el inventario o mapa antes de revisión CMJ;
- las fotografías cumplen límites aprobados, permanecen privadas y no exponen metadatos personales;
- las fotos pendientes por falta de conexión no se confunden con cargas aceptadas, pueden reintentarse y el envío se bloquea hasta completar la carga; GPS del escenario permanece independiente de EXIF;
- los correos se entregan al contacto registrado únicamente para eventos aprobados y su entrega no altera el resultado transaccional del reporte;
- la operación de validación no cambia el semáforo y la oficialización CMJ sigue separada, transaccional, trazable e idempotente;
- historial anterior y datos existentes permanecen intactos;
- todas las pruebas de la sección 9 pasan en entornos aislados y los resultados se documentan.

Este archivo documenta una propuesta. No inicia ni autoriza la implementación.
