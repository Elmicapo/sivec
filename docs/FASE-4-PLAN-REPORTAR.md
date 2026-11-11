# Fase 4 — Plan maestro de actualización de Reportar

**Estado:** el formulario visual está implementado en frontend. D7, las migraciones 001–003 y el backend de recepción, consultas CMJ, validación y oficialización se probaron en una restauración aislada; el flujo de servicio real completó rollback. Las rutas fallan de forma cerrada en una base que no tenga 001–003 aplicadas.  
**Alcance:** renovación del formulario público `/reportar`, recepción y seguimiento de veeduría, solicitudes de escenarios nuevos e integración con el proceso CMJ D1.  
**Límite de seguridad vigente:** `deportes` original y producción no fueron modificadas. El DDL solo se ejecutó sobre `sivec_restore_test_20261104_484fe0eb`; ninguna migración se ha autorizado para otra instancia.

## 1. Propósito y límites

Preparar la actualización de Reportar como un flujo moderno, accesible y adaptable a celulares, tabletas y computadores, conservando la identidad visual de SIVEC y la referencia de diseño compartida por el responsable. El formulario tendrá cuatro etapas: escenario/ubicación, estado y descripción, fotografías/contacto y confirmación.

Este plan organiza las propuestas previas, fija las decisiones ya aprobadas y distingue:

- **Aprobado:** reglas funcionales expresas del responsable; no se reabren en este documento.
- **Hecho técnico observado:** comportamiento que existe en el código o esquema revisado.
- **Propuesta de implementación:** diseño a aprobar antes de ejecutar.
- **Pendiente:** decisión que requiere validación técnica o aprobación del responsable.

El plan maestro no habilita producción: el frontend visual está implementado y el DDL/D7 solo se ensayaron en una copia aislada. No declara resueltos en una instancia de aplicación los flujos D1, la carga de fotografías, seguimiento ciudadano, gestión de disciplinas o revisión de escenarios.

## 2. Fuentes revisadas y estado de la auditoría

Documentación contrastada:

- [README de documentación](./README.md).
- [Plan de corrección D1](./PLAN-CORRECCION-D1-OFICIALIZACION-SEMAFORO.md) y [especificación técnica D1](./PLAN-IMPLEMENTACION-D1.md).
- [Plan de integración de Reportar con D1](./PLAN-INTEGRACION-REPORTAR-D1.md).
- [Catálogo territorial de Apartadó](./CATALOGO-TERRITORIAL-APARTADO.md).
- [Plan de migraciones MySQL](./PLAN-MIGRACIONES-MYSQL.md).
- [Auditoría MySQL](./AUDITORIA-MYSQL.md), [inventario de objetos MySQL](./INVENTARIO-OBJETOS-MYSQL.md) y [relaciones de la base de datos](./RELACIONES-BASE-DATOS.md).
- [Contraste de Fase 2](./FASE-2-BLOQUE-1-CONTRASTE.md) y el plan general de fases de Fase 1 enlazado desde el [índice](./README.md).

También se contrastaron, sin modificarlos, `frontend/src/pages/Reportar.jsx`, `frontend/src/services/veeduriaService.js`, `BACKEND/src/controllers/escenarios.controller.js` y `BACKEND/src/routes/escenarios.routes.js`.

**Límite documental:** no se encontró dentro de `docs/` un informe independiente de auditoría de Fase 4. Por eso este plan conserva los hallazgos funcionales documentados en el plan de integración y vuelve a comprobar los componentes actuales de Reportar y sus rutas; no atribuye resultados adicionales a un informe no localizado. Los hallazgos de otras áreas del proyecto se mantienen en sus documentos de auditoría y no se marcan como resueltos por esta planificación.

## 3. Diagnóstico técnico vigente

### Frontend

- `/reportar` es pública y cuenta con el asistente visual de cuatro etapas.
- La interfaz permite buscar escenarios oficiales, propone escenarios nuevos visualmente, captura la ubicación bajo las reglas aprobadas, muestra estados del semáforo y valida/previsualiza fotografías localmente.
- Las fotografías, la propuesta de escenario y el reporte aún no se envían desde la interfaz; no se ha conectado el formulario a estas nuevas rutas.
- El formulario exige nombre completo y correo y no solicita identificación. El código de seguimiento solo puede mostrarse una vez confirmado por backend.

### Backend y API

El backend de veeduría ahora implementa recepción pública con nombre completo/correo, consultas protegidas CMJ, detalle e historial, validación con historial de decisiones, y oficialización D1 independiente. La disponibilidad queda condicionada al registro de las migraciones 001–003 en cada destino. La base original `deportes` permanece intacta y no debe recibir operaciones hasta una autorización y migración posteriores.

- `POST /api/escenarios/reportes` no exige sesión, valida nombre completo/correo y devuelve código aleatorio; no guarda número de identificación.
- Consultas CMJ: pendientes, detalle y `/reportes/escenario/:id_escenario/historico`. `PUT /reportes/:id_reporte/validar` registra resolución y decisión sin modificar el semáforo.
- `POST /api/escenarios/reportes/:id_reporte/oficializar` es una operación CMJ separada y aplica exclusivamente el estado propuesto del reporte validado.
- Los errores internos de las nuevas rutas no exponen SQL. La base original sin migraciones devuelve un error de esquema no preparado y no acepta escrituras.
- No se implementaron carga multipart/almacenamiento privado, consulta ciudadana por código, notificaciones, ni la integración frontend.

### MySQL y D1

- MySQL 8 es el motor obligatorio. El esquema auditado tiene 15 tablas, 10 vistas, 1 procedimiento y 3 triggers.
- `reporte_veeduria` requiere actualmente `id_escenario` e `id_reportante`, conserva `evidencia_url` de texto y no contiene código de seguimiento ni relación de archivos.
- `escenario` no posee campos estructurados de zona/comuna/barrio/corregimiento/localidad.
- En la base original `deportes`, el trigger `trg_oficializar_semaforo` sigue oficializando automáticamente al validar cuando cambia el estado propuesto. En la copia aislada fue retirado por la migración 001; aún falta integrar la operación de oficialización.
- D1 tiene campos de oficializador/fecha, FK al perfil CMJ, `CHECK` de pareja y unicidad de historial en la copia aislada. No hay endpoint ni transacción funcional de oficialización.
- La evidencia histórica y los reportes validados preexistentes deben tratarse según el baseline y procedimiento de revisión de D1; no se inventan responsables ni fechas.

### Hallazgos vigentes que impactan Reportar

1. El flujo actual exige número de identificación a quien no tiene sesión y puede reutilizar/crear una fila `persona` por ese dato; el flujo aprobado no pide identificación y requiere nombre o apodo y correo para todo reporte.
2. No hay un código opaco de seguimiento; `id_reporte` no debe elevarse a secreto.
3. La recepción está acoplada al modelo de reporte operativo que exige escenario oficial, por lo que las propuestas de escenario requieren staging/recepción separada antes de entrar a D1.
4. El campo `evidencia_url` no satisface la carga, validación, privacidad ni gestión de fotografías aprobadas.
5. El trigger D1 permite que la validación afecte el semáforo oficial.
6. La consulta reciente de `disciplina` no pudo obtenerse: respondió `ER_ACCESS_DENIED_ERROR` antes de confirmar la base de destino. El esquema auditado sí describe categorías/estados y relaciones, pero no permite afirmar qué disciplinas están cargadas hoy.
7. El catálogo territorial se transcribió desde los datos suministrados por el responsable y no tiene verificación institucional. De 47 entradas rurales, 7 están explícitamente marcadas `C.P.`; la clasificación oficial de las 40 restantes no está certificada.
8. D7 ya cuenta con un ejecutor versionado y probado sobre la restauración aislada; la migración D1 no se ha aplicado a `deportes` ni a otra instancia.
9. Los planes previos documentan que la API usa una base URL local y que la suite backend no estaba configurada como suite integral. Son dependencias que deben verificarse al implementar y desplegar; no se cambian aquí.

## 4. Decisiones aprobadas que deben conservarse

### Flujo del formulario y ubicación

- Cuatro etapas conforme al objetivo de este plan.
- Escenario existente: buscar/seleccionar del inventario oficial. Escenario nuevo: enviar una propuesta, nunca insertar directamente en el inventario.
- Selección territorial encadenada:
  - Urbana → comuna → barrio.
  - Rural → corregimiento → vereda o centro poblado.
- La ubicación manual consiste únicamente en los campos territoriales; **no** se permiten coordenadas manuales.
- GPS se solicita solo después de una acción expresa del ciudadano y de conceder permiso al navegador; no se pide al abrir el formulario.
- GPS del escenario es independiente de las fotografías. EXIF no es fuente de coordenadas y se elimina antes de almacenar la evidencia.
- El escenario nuevo requiere revisión CMJ antes de incorporación al inventario. No debe modificar el semáforo.

El catálogo transcrito contiene 4 comunas y 49 barrios; 4 corregimientos y 47 entradas rurales (40 sin clasificación `C.P.` explícita y 7 centros poblados explícitos). Se usa la relación disponible sin presentarla como verificación oficial y sin convertir `C.P.` en vereda. Los detalles están en [CATALOGO-TERRITORIAL-APARTADO](./CATALOGO-TERRITORIAL-APARTADO.md).

### Fotografías

- De 1 a 5 fotografías por reporte.
- Máximo 5 MB por archivo y 20 MB acumulados.
- Dimensiones máximas de 1920 × 1920 píxeles.
- JPEG/JPG, PNG y WebP.
- Verificar contenido real; no confiar solo en extensión o MIME; rechazar SVG, ejecutables, archivos dañados o formatos falsificados.
- Eliminar metadatos EXIF, optimizar conservando legibilidad y almacenar en privado, sin acceso público directo.
- Permitir vista previa, eliminación y reemplazo antes de enviar.
- Distinguir cargas pendientes, confirmadas y fallidas; contemplar reintentos sin duplicar. No declarar enviado un reporte si las evidencias requeridas no han sido aceptadas por el servidor.

La persistencia de cargas offline a través de cierre/recarga todavía no está aprobada; no prometer continuidad entre sesiones hasta resolver esa decisión.

### Contacto y seguimiento

- Todos los ciudadanos deben registrar nombre o apodo y correo electrónico obligatorios. No se solicita número de identificación.
- Todos los reportes reciben un código único de seguimiento.
- Las notificaciones pueden enviarse al correo registrado para todos los reportes, sujeto a aprobación de eventos, proveedor, consentimiento, reintentos y política de privacidad.
- Proteger el correo mediante mínimo privilegio y exponerlo solo a los roles autorizados que lo necesiten para el trámite.
- El reporte no modifica el semáforo al recibirse; la respuesta final explica la etapa actual del trámite.

### Separación CMJ y D1

Son tres operaciones y colas distintas:

1. **Revisión de escenario:** CMJ aprueba o rechaza su incorporación al inventario. No valida el reporte ni oficializa el semáforo.
2. **Validación del reporte:** CMJ valida o rechaza. Rechazo exige observación no vacía desde el backend. Ninguna decisión modifica el semáforo.
3. **Oficialización D1:** solo CMJ oficializa, con actor derivado de `cmj_consejero`, aplicando `estado_propuesto` del reporte ya validado. Se registra aunque el nuevo estado sea igual al vigente. El historial anterior permanece como legado; no se inventan fechas ni responsables.

El trigger de `deportes` no debe seguir realizando la oficialización automática. Fue retirado solo en la copia aislada después de preparar y probar D7. Las rutas y transacciones backend de validación y oficialización independiente ya están implementadas y tienen pruebas unitarias; siguen bloqueadas hasta aplicar y verificar las migraciones 001–003 en una base autorizada. `deportes` permanece sin migrar.

## 5. Arquitectura propuesta

La propuesta separa la **recepción ciudadana** del **reporte operativo asociado a un escenario oficial**:

```text
Ciudadano
  └─ Recepción + evidencia + código de seguimiento
       ├─ Escenario oficial existente
       │    └─ Reporte operativo PENDIENTE
       │         └─ CMJ valida/rechaza (sin tocar el semáforo)
       │              └─ Si VALIDADO: cola D1 independiente
       │                   └─ CMJ oficializa y registra historial
       └─ Escenario nuevo
            └─ Solicitud de escenario en revisión CMJ
                 ├─ Rechazada: no incorporar al inventario
                 └─ Aprobada: incorporar y enlazar escenario
                      └─ materializar reporte PENDIENTE
                           └─ validación y, en su caso, oficialización D1
```

### Límites de componentes

- **Frontend React:** wizard público, validación para UX, selección jerárquica, interfaz de carga y seguimiento. El servidor sigue siendo autoritativo.
- **Backend Express:** catálogo de disciplinas y escenarios, recepción, solicitudes de escenario, carga y lectura privada de evidencias, validación CMJ, oficialización D1 y consulta de seguimiento. Autorización se comprueba en servidor.
- **MySQL 8:** catálogo existente y relaciones; staging/recepción, estados, metadatos, snapshots mínimos, tracking y campos D1 según modelo aprobado. No se guardan blobs fotográficos.
- **Almacenamiento de evidencia:** destino privado aún por seleccionar/aprobar; URLs públicas no se usan como autoridad de acceso.
- **Correo:** todos los reportes tienen correo registrado y pueden recibir notificaciones allí, una vez aprobados eventos/proveedor/consentimiento; se propone outbox para desacoplar envío y persistencia, sujeto a diseño y aprobación.

El esquema de staging y recepción se implementó en la migración 002 para la copia aislada: mantiene `reporte_veeduria.id_escenario` obligatorio, permite `id_reportante` nulo para nuevos reportes con snapshot y vincula la recepción a escenario oficial o a solicitud nueva. No existe aún integración backend.

## 6. Flujo funcional por etapa

### Etapa 1 — Escenario y ubicación

- Buscar un escenario activo/oficial existente. Mostrarlo como selección existente, sin permitir modificar sus coordenadas o semáforo.
- Si no aparece, elegir «Registrar un escenario nuevo».
- Seleccionar zona. Para urbana, encadenar comuna y barrio. Para rural, encadenar corregimiento y la entrada territorial correspondiente; conservar explícitamente `C.P.` para los siete centros poblados marcados.
- Nombre de cancha/escenario y disciplina tomada del catálogo MySQL. No usar texto libre como fuente principal.
- Elegir GPS o manual. GPS requiere acción/permiso; manual usa exclusivamente los campos territoriales, sin latitud/longitud.
- Una propuesta nueva queda pendiente de revisión CMJ y no aparece en inventario/mapa oficial antes de aprobación e incorporación.

### Etapa 2 — Estado y descripción

- Estado propuesto: verde (buen estado), amarillo (mantenimiento) o rojo (deteriorado).
- Descripción obligatoria de daños, fallas o necesidades.
- El estado es una observación ciudadana. Al enviar, al validar o al rechazar nunca se cambia el semáforo oficial.

### Etapa 3 — Fotografías y contacto

- Selección de 1–5 fotos, controles de tamaño/dimensiones/formato aprobado, validación real y privacidad.
- Vista previa individual; quitar/reemplazar antes del envío; totales y errores actualizados en interfaz.
- Cola con estados por archivo y reintentos; en ausencia de red no se muestra carga exitosa. El envío final requiere que el backend confirme las evidencias.
- Capturar nombre o apodo y correo obligatorios para cada reporte, con o sin sesión iniciada; no solicitar número de identificación.

### Etapa 4 — Confirmación

- Resumen de escenario existente o propuesta territorial, estado, descripción, fotos, nombre/apodo y correo.
- Navegar hacia atrás y corregir sin perder la selección de la sesión activa.
- Confirmar envío una sola vez. Mostrar el código solo tras persistencia exitosa y comunicar si está pendiente de revisión de escenario o validación del reporte.
- Explicar que validación no cambia el semáforo y que la oficialización, si corresponde, es una acción posterior e independiente del CMJ.

## 7. Cambios previstos por capa

### MySQL

El esquema documentado y probado en aislamiento incluye:

1. D1: marcas separadas de validador/oficializador, relación con `cmj_consejero`, historia única y retirada del trigger automático en la base aislada. La transacción backend de oficialización está implementada; cada instancia debe tener 001–003 aplicadas y verificadas antes de usarla.
2. Recepción obligatoria de nombre/apodo y correo, sin número de identificación; los datos se guardan en la solicitud y no se reutiliza `persona` por identificación.
3. Solicitud de escenario con jerarquía urbana/rural, disciplina FK, fuente de ubicación, coordenadas solo para GPS, revisión y enlace al inventario; se conserva `PENDIENTE_VERIFICACION` para localidades rurales no certificadas.
4. Código de seguimiento en digest binario único; la API genera un código aleatorio y conserva solo su hash. La consulta ciudadana mediante código sigue pendiente.
5. Metadatos de evidencias privadas, posiciones 1–5, límites individuales por fila y dimensión; archivos fuera de MySQL.
6. No se creó outbox de correo: eventos, proveedor, consentimiento y retención siguen pendientes.
7. FKs/CHECKs y vista histórica actualizada con `LEFT JOIN` para mantener reportes sin `id_reportante`; las consultas y permisos básicos de API están implementados. Queda pendiente su habilitación en otro destino.

Las migraciones 001–003 y sus pruebas están documentadas en [Plan de migraciones MySQL](./PLAN-MIGRACIONES-MYSQL.md). Antes de cualquier otra base, repetir preflight con respaldo verificado, preservar reportes/historial y clasificar candidatos sin corrección automática. DDL MySQL puede confirmar implícitamente; no asumir rollback de DDL.

### Backend

- D7 ya está preparado y probado en aislamiento; el ejecutor rechaza destinos no aislados.
- Implementado: recepción pública, pendientes de validación, detalle e historial por escenario, cola de validados pendientes de oficialización, validación/rechazo y oficialización independiente. El backend verifica los cambios de D1 y exige rol y perfil CMJ.
- Pendiente: consulta ciudadana por código, catálogo/búsqueda del flujo ampliado, revisión de escenarios nuevos, carga segura de fotos y notificaciones. No se contrató almacenamiento ni proveedor de correo.
- El panel CMJ aún requiere una cola/acción visual independiente para oficializaciones y actualización coordinada con estas rutas.
- Controlar autenticación, rol, perfil CMJ, identidad desde JWT validado, observación obligatoria al rechazar, validaciones de estado, rate limits, errores genéricos y logs protegidos.
- Carga: verificar límite real de request, firma/formato, decodificación, dimensiones, EXIF, re-encode/optimización, propiedad de cargas y tamaño acumulado. La verificación del navegador es solo UX.
- Oficialización: transacción, bloqueo/revisión de reporte y escenario, estado validado/no oficializado, actualización del escenario e historial, marca actor/fecha UTC y rechazo de duplicados/carreras, según contrato D1.
- Seguimiento: código en cuerpo HTTPS, no en ruta/query; respuesta mínima y uniforme, sin contacto/fotos/descripción no aprobados; no registrar códigos ni secretos.
- No devolver mensajes crudos de errores SQL al ciudadano.

### Frontend

- Rediseñar `Reportar.jsx` en cuatro pasos; conservar marca/estilo SIVEC y aplicar la referencia visual compartida, con diseño responsive, accesible, teclado, foco visible y movimiento reducido.
- Indicador de progreso, validación por etapa, estados de carga/error/vacío, navegación atrás y resumen antes de confirmar.
- Selectores dependientes de zona/comuna/barrio o zona/corregimiento/localidad; ninguna lista territorial plana.
- Selector dinámico de disciplinas desde backend/MySQL; manejar sin disciplinas/error sin fallback a texto libre.
- GPS explícito y a demanda; opción manual solo territorial.
- Carga de fotos con vista previa, reemplazo/eliminación, progreso, pendientes offline y reintentos.
- Nombre/apodo y correo son obligatorios en cada envío; no solicitar número de identificación.
- Confirmación con código y estado del trámite.
- Mantener tres colas/acciones separadas en el panel CMJ: revisar escenario, validar/rechazar reporte, oficializar semáforo. Una acción no debe encadenar las otras automáticamente.

## 8. Seguridad y privacidad

- Guardar únicamente el snapshot requerido de nombre/apodo y correo en cada reporte; no solicitar número de identificación ni inferir o completar datos por coincidencia de identificación, sesión o EXIF.
- Proteger el correo y el nombre/apodo con permisos mínimos; definir qué roles pueden consultarlos, su propósito, retención y eliminación.
- Mantener fotografías privadas; claves de objeto aleatorias, acceso autenticado/temporal autorizado, sin directorios estáticos ni URL pública directa.
- Limitar archivos por cantidad/tamaño/dimensiones y comprobar contenido real en backend antes de almacenarlos.
- Eliminar EXIF completamente; no confundir geolocalización autorizada del escenario con metadatos de la foto.
- Proteger el endpoint de tracking frente a enumeración, fuerza bruta, abuso automatizado, cache y filtración por logs. Los límites concretos y las mitigaciones por abuso requieren aprobación.
- Respetar permisos por rol: solo CMJ puede revisar propuestas de escenarios, validar reportes y oficializar según las operaciones aprobadas; las consultas públicas no exponen datos internos.
- Separar configuración/secretos de producción, privilegios SQL mínimos y pruebas negativas por rol.
- No habilitar envío de correo hasta aprobar proveedor, eventos, consentimiento y manejo de rebotes/reintentos.

## 9. Pruebas y criterios de aceptación

### Formulario y territorio

- Escenario existente seleccionable solo del inventario oficial/activo.
- Nuevos escenarios se mantienen fuera del inventario/mapa hasta aprobación CMJ.
- Una comuna muestra únicamente sus barrios; un corregimiento muestra únicamente sus entradas. Los `C.P.` conservan tipo; no se agregan ubicaciones externas.
- Opción manual no ofrece ni acepta coordenadas. GPS no se solicita al abrir el formulario; se usa solo tras acción/permiso. EXIF no se usa como sustituto.
- Error/ausencia del catálogo de disciplinas no presenta catálogo falso ni permite texto libre como fuente principal.
- Identidad visual conservada; cuatro etapas responsivas a móvil/tableta/escritorio; navegación accesible y sin pérdida de datos al volver entre pasos durante la sesión.

### Evidencias y contacto

- Rechazar cero/seis fotos, >5 MB individual, >20 MB total, dimensión por encima de 1920 × 1920, formatos no permitidos, SVG, ejecutables, corruptos, MIME/extensión falsos y formatos falsificados.
- Confirmar lectura de contenido real, EXIF eliminado, optimización legible y ausencia de acceso público directo.
- Vista previa, eliminación y reemplazo actualizan la selección; reintentos no duplican; la pérdida de conexión no se representa como carga completada.
- No se confirma envío sin 1–5 fotos aceptadas por el servidor.
- Todos los reportes requieren nombre/apodo y correo, sin solicitar número de identificación; todos reciben código único.
- Verificar que el correo solo sea visible para roles autorizados y que las notificaciones, una vez aprobados sus eventos/proveedor, se envíen únicamente a la dirección capturada.

### CMJ y D1

- Aprobar/rechazar escenario no valida reporte ni cambia semáforo.
- Validar o rechazar reporte no cambia estado oficial ni crea historial de oficialización; rechazo sin observación válida se rechaza en backend.
- Solo CMJ con perfil `cmj_consejero` puede oficializar; se usa el `estado_propuesto`, se registra aunque coincida con el vigente y una transacción deja escenario/historial/marca consistentes.
- Pendiente, rechazado, inexistente, ya oficializado, token inválido y no-CMJ se manejan según contrato D1, sin escrituras parciales.
- La doble solicitud/concurrencia no duplica oficialización; historial legado conserva valores y no se atribuyen responsables/fechas retroactivas.

### Integración y seguridad

- Migraciones reconstruibles/idempotentes según D7, checksum/exclusión concurrente, y ensayadas sobre restauración aislada.
- Integridad de FKs/CHECKs, conteos comparables, vistas/permisos, consultas de carga y errores de MySQL verificados.
- Seguimiento no expone PII ni evidencia, resiste enumeración/rate limit aprobado y no almacena código en logs.
- Pruebas de API, integración, seguridad, concurrencia, accesibilidad y diseño adaptable; documentar resultados y defectos pendientes.
- Prueba final de despliegue público y conexión con configuración no local forma parte del cierre académico de fases posteriores, no de esta actividad documental.

## 10. Pendientes que requieren aprobación

No reabrir los límites fotográficos aprobados ni la ubicación manual exclusivamente territorial. Siguen pendientes:

### D1 y datos

1. Aprobación técnica final de tipos/nombres/campos D1, CHECK, FKs, unicidad de historial, índices y formato de errores/fechas, además del baseline protegido de legado.
2. Confirmar con consultas protegidas los reportes validados sin historia/inconsistentes antes de habilitar una cola productiva; no corregir automáticamente.
3. D7 ya superó repetición/checksum/lock/fallo-secuencia e integración en la restauración. La instalación desde una base vacía y recuperación independiente siguen sin probarse.

### Evidencias y trabajo offline

4. Selección de proveedor/ubicación de almacenamiento privado; costos, respaldos, disponibilidad, acceso, recuperación y retención/eliminación de objetos.
5. Decidir análisis antimalware adicional y herramienta de procesamiento, sujeto a evaluación técnica posterior.
6. Definir conversión exacta de MB a bytes (decimal/binaria) compartida entre cliente y servidor.
7. Decidir si una cola offline persiste entre recargas/cierres. La cola de sesión y reintento está prevista; persistencia local duradera requiere consentimiento, expiración, protección y borrado aprobados.

### Seguimiento y correo

8. Vigencia, recuperación/reemisión y rotación del código, estados y campos que devuelve el endpoint.
9. Límites concretos de uso del endpoint público de seguimiento: rate limit, política antiabuso, errores/respuestas uniformes y observabilidad que no filtre códigos.
10. Eventos de notificación, proveedor, costos, consentimiento, verificación de correo, plantillas, reintentos y retención.

### Catálogos y solicitudes de escenario

11. Obtener acceso de solo lectura autorizado a la instancia correcta para enumerar `disciplina` (id, nombre, categoría, estado) y relaciones. No se ha comprobado el catálogo actual por `ER_ACCESS_DENIED_ERROR`.
12. Aprobar el filtro del selector (propuesta: solo `DEPORTIVA` y `ACTIVA`) y el proceso autorizado por el cual se amplía/administra el catálogo; no usar texto libre como reemplazo.
13. Verificar con fuente institucional la clasificación administrativa y grafía del catálogo territorial. Las 40 entradas rurales no marcadas `C.P.` no deben declararse oficialmente veredas hasta confirmación.
14. Aprobar reglas para completar/corregir/re-presentar solicitudes de escenario rechazadas, motivo de rechazo, aviso al ciudadano, duplicados y vínculo posterior con el reporte.
15. Aprobar alcance del snapshot obligatorio de contacto, consentimiento, retención y eliminación de datos personales.
16. Aprobar contratos de API, modelo de recepción/staging, política de idempotencia y cuándo se comunica al ciudadano el estado de su recepción.

## 11. Secuencia propuesta de trabajo

La siguiente secuencia registra el estado real y el trabajo restante. La autorización del Bloque 2 cubrió solo el ejecutor y el ensayo de DDL en la copia aislada; no autoriza migrar `deportes` ni implementar backend:

1. Cerrar decisiones técnicas pendientes de D1 y del nuevo flujo; identificar expresamente las aprobaciones del propietario.
2. **Completado en aislamiento:** ejecutar D7 versionado, checksum, guardia de destino, lock, repetición y detención ante fallo.
3. **Completado en aislamiento:** aplicar y probar migraciones 001–003 desde el respaldo verificado. Cualquier otro destino requiere autorización propia y nuevo preflight; `deportes` permanece intacta.
4. **Completado en código y probado en aislamiento:** recepción, consultas CMJ, validación, historial y oficialización D1 independiente. La cola de candidatos a oficialización y otros destinos requieren trabajo/aprobación adicional.
5. Integrar `Reportar.jsx` con la API: el formulario visual está, pero el envío continúa bloqueado mientras no existan endpoints de recepción, carga y seguimiento.
6. Actualizar el panel CMJ para mostrar y mantener independientes revisión de escenarios, validación y oficialización.
7. Completar seguimiento ciudadano mediante código único; la recepción genera el código, pero el endpoint de consulta ciudadana todavía no existe.
8. Resolver decisiones pendientes de almacenamiento privado, correo, retención, privacidad y recuperación del código antes de habilitar sus funciones.
9. Ejecutar pruebas funcionales, seguridad, integración, concurrencia, privacidad, accesibilidad y diseño adaptable; no usar la base original para pruebas de escritura.
10. Documentar resultados, respaldo/migraciones y limitaciones, y solicitar aprobación del propietario antes de migrar otra instancia, desplegar o avanzar.

## 12. Inconsistencias documentales y conciliación

| Tema | Estado encontrado | Tratamiento en este plan |
|---|---|---|
| D1 | El trigger actual oficializa automáticamente durante validación. | La regla aprobada es la separación; retirar el trigger y habilitar la operación independiente solo mediante D7 y migración aprobada. |
| Mensaje actual del formulario | Sugiere que CMJ revisa antes de cambiar el semáforo. | Sustituir en implementación por explicación de revisión/validación y eventual oficialización separada. |
| Contacto e identificación del reportante | UI/controlador actuales requieren número de identificación para quien no tiene sesión y el backend busca/reutiliza o crea una fila `persona`. | Todo reporte requiere nombre o apodo y correo, no solicita identificación y obtiene código de seguimiento; proteger contacto según permisos por rol. |
| Evidencia | Actual `evidencia_url` de texto sin carga privada. | Aplicar los límites fotográficos aprobados, almacenamiento privado y validación de contenido; proveedor sigue pendiente. |
| D10 en el plan general de migraciones | Una nota previa aún dice que faltan los límites de evidencia. | Corregido en esta actualización documental: los límites ya están aprobados; quedan pendientes almacenamiento, retención y controles complementarios. |
| Catálogo de disciplinas | Esquema documenta categoría/estado, pero no se obtuvo lista de filas. | No afirmar qué disciplinas existen; requiere consulta de solo lectura autorizada. |
| Catálogo rural | 7 centros poblados aparecen como `C.P.`; las otras 40 entradas rurales no tienen clasificación certificada en la lista recibida. | Mantener agrupación/nombres recibidos y no cambiar su categoría ni presentarla como oficial. |
| Fase 4 auditoría | No se localizó un informe independiente en `docs`. | Conservar hallazgos directamente comprobados en código y planes existentes; agregar el informe como referencia cuando se ubique, sin inventar findings. |
| Sesiones, despliegue y privilegios | JWT se mantiene inicialmente (D5); despliegue público es requisito académico; el plan de migraciones señala cuenta SQL `root` en el entorno auditado. | No adelantar sesiones revocables; privilegiar preparación segura de producción y desplegar solo en fase autorizada. |

## 13. Criterio de aprobación del plan

Este plan queda listo para revisión documental. Antes de empezar la implementación, el propietario del proyecto deberá aprobar:

- las decisiones técnicas pendientes de D1, recepción y seguimiento;
- el alcance y las reglas de revisión/rechazo/re-presentación de escenarios;
- el proveedor/políticas de almacenamiento y el tratamiento de offline/correo;
- el resultado de la consulta de solo lectura de disciplinas y el filtro del selector;
- la verificación territorial pendiente y las decisiones de privacidad/retención;
- el inicio de D7 y, después, la preparación de pruebas de D1 en aislamiento.

**Estado actual:** se modificaron el frontend visual de `Reportar`, el ejecutor D7, las migraciones versionadas, el backend de veeduría y documentación relacionada. Las migraciones solo se ejecutaron en la copia aislada; `deportes` y producción permanecen intactas. La carga de fotos, seguimiento ciudadano y correo aún no se implementan.
