# Plan de corrección D1: validación y oficialización del semáforo

**Estado:** análisis y propuesta; no implementado.  
**Revisión de la base original:** `2026-11-03 21:44:24 -05:00`, mediante consultas de solo lectura a `deportes`.  
**Alcance:** diseñar la separación entre validar un reporte y oficializar el estado del escenario. No se ejecutaron cambios.

## 1. Resumen ejecutivo

La decisión D1 establece dos operaciones diferentes: el CMJ valida o rechaza un reporte y, en una acción posterior e independiente, una persona autorizada oficializa el estado del escenario. La validación no debe cambiar el semáforo oficial.

En la instancia original `deportes`, el trigger `trg_oficializar_semaforo` ejecuta actualmente la segunda operación dentro de la primera: ante el cambio `PENDIENTE` → `VALIDADO`, registra historial y actualiza el escenario cuando el estado propuesto difiere del actual. El backend solo actualiza el reporte; el efecto adicional ocurre en MySQL.

La corrección requiere coordinar esquema, trigger, API, autorización y panel CMJ en una misma ventana de despliegue. La propuesta central es retirar el efecto automático, conservar la ruta de validación y agregar una operación backend transaccional e idempotente para oficializar. Antes de implementar quedan decisiones de permisos y de tratamiento de los reportes históricos que deben aprobarse.

## 2. Alcance, fuentes y certeza

### Fuentes revisadas

- Base de datos original `deportes`: metadatos de objetos, definición del trigger, columnas, motores, relaciones e índices; además de conteos agregados sin leer datos personales.
- [Auditoría MySQL](./AUDITORIA-MYSQL.md).
- [Inventario de objetos MySQL](./INVENTARIO-OBJETOS-MYSQL.md).
- [Relaciones de la base de datos](./RELACIONES-BASE-DATOS.md).
- [Plan de migraciones MySQL](./PLAN-MIGRACIONES-MYSQL.md).
- [Contraste documental de Fase 2, Bloque 1](./FASE-2-BLOQUE-1-CONTRASTE.md).
- `BACKEND/src/controllers/escenarios.controller.js`, `BACKEND/src/routes/escenarios.routes.js`, `BACKEND/src/routes/reportes.routes.js`, `BACKEND/src/middlewares/authMiddleware.js` y `BACKEND/src/config/db.js`.
- `frontend/src/services/veeduriaService.js`, `frontend/src/pages/PanelCMJ.jsx`, `frontend/src/pages/Reportar.jsx` y `frontend/src/App.jsx`.
- `BACKEND/package.json` y el árbol de `BACKEND/src` para buscar el ejecutor de migraciones y scripts SQL.

### Hechos comprobados

- La base conectada fue `deportes`, no un esquema de restauración temporal. Las consultas se limitaron a metadatos y agregados; no se leyeron datos personales ni se ejecutó DDL/DML.
- Las tablas `reporte_veeduria`, `escenario` e `historial_estado_escenario` usan InnoDB.
- La instancia observada tiene 15 tablas, 10 vistas, 1 procedimiento y 3 triggers.
- La tabla `historial_estado_escenario` tiene 2 filas en la revisión; no se observó más de una fila de historial por reporte. Había 2 reportes `VALIDADO` y 1 `RECHAZADO`; los 2 validados tenían una fila de historial asociada. No había reportes pendientes en ese corte.
- La inspección del proyecto no encontró archivos de migración ejecutables ni un ejecutor propio implementado. D7 y el uso de ese ejecutor están descritos en el plan documental, pero no se encontraron implementados en `BACKEND/src` ni configurados como script de `BACKEND/package.json`.

Los conteos anteriores son una fotografía de la instancia en la fecha indicada, no una regla de negocio ni una garantía de que sigan iguales. El procedimiento, las columnas y rutas descritos abajo se basan en la implementación observada; toda decisión de diseño se marca como propuesta o pendiente.

## 3. Modelo actual comprobado

### 3.1 Tablas y relaciones relevantes

| Tabla | Campos pertinentes observados | Relaciones y restricciones relevantes |
|---|---|---|
| `reporte_veeduria` | `id_reporte`, `id_escenario`, `id_reportante`, `estado_propuesto`, `descripcion`, `evidencia_url`, `fecha_reporte`, `estado_reporte`, `id_cmj_valida`, `fecha_validacion`, `observacion_cmj` | FK a `escenario`, `persona` y `cmj_consejero`. `estado_reporte` admite `PENDIENTE`, `VALIDADO` y `RECHAZADO`. El `CHECK` `ck_reporte_validacion` exige validador/fecha nulos para pendientes y ambos no nulos para estados procesados. |
| `escenario` | `estado_semaforo`, `fecha_ultima_actualizacion` | El estado es `ENUM('VERDE','AMARILLO','ROJO')`; InnoDB. |
| `historial_estado_escenario` | `estado_anterior`, `estado_nuevo`, `id_reporte` nullable, `id_cmj`, `fecha_cambio` | FKs a escenario, reporte y consejero CMJ. El índice de `id_reporte` no es único. La tabla es InnoDB. |

El esquema no contiene un campo explícito de oficialización en el reporte. El historial es actualmente el único rastro asociado al reporte para la transición; no distingue por sí mismo al validador del actor que oficializó.

### 3.2 Trigger y efecto secundario

`trg_oficializar_semaforo` es un `AFTER UPDATE` de `reporte_veeduria`. Cuando detecta que `OLD.estado_reporte = 'PENDIENTE'` y `NEW.estado_reporte = 'VALIDADO'`, lee el estado oficial del escenario. Si difiere de `NEW.estado_propuesto`, inserta una fila en `historial_estado_escenario` y actualiza `escenario.estado_semaforo` y `fecha_ultima_actualizacion`. Si el estado propuesto ya coincide, no inserta historial ni actualiza el escenario. El rechazo no activa esta lógica.

El trigger toma `NEW.id_cmj_valida` y `NEW.fecha_validacion` como actor y fecha de la fila de historial. Como se ejecuta al validar, esa trazabilidad identifica al validador y momento de validación; no prueba que haya existido una segunda autorización de oficialización.

### 3.3 Backend, rutas y permisos actuales

- `POST /api/escenarios/reportes` usa autenticación opcional y crea un reporte. La ruta no está protegida por rol.
- `GET /api/escenarios/reportes/pendientes` requiere token y acepta `CMJ` o `ADMINISTRATIVO`.
- `PUT /api/escenarios/reportes/:id_reporte/validar` requiere token y acepta únicamente `CMJ`. El controlador admite `VALIDADO` o `RECHAZADO` y actualiza el estado, el CMJ, la fecha y la observación, con condición `estado_reporte = 'PENDIENTE'`. No contiene una actualización explícita de escenario ni una transacción de varias sentencias; el trigger produce el efecto de oficialización.
- `GET /api/reportes/historico-veedurias` requiere token y acepta `ADMINISTRATIVO` o `CMJ`.
- No se encontró una ruta backend de oficialización ni otra ruta backend directa que cambie el semáforo oficial.
- La autenticación de la API utiliza JWT y `permitirRoles`; la autorización debe aplicarse en el backend, no solo ocultando botones.
- El pool de conexión usa `mysql2/promise`, lo que permite transacciones en una conexión dedicada. El backend ya usa transacciones en otros controladores, pero no en el controlador de reportes de veeduría.

Hay una diferencia actual de acceso: administración puede consultar pendientes, pero solo CMJ puede validarlos. La nueva capacidad de oficializar debe tener una matriz de roles aprobada y no debe inferirse de esa diferencia.

### 3.4 Frontend y dependencias

- El servicio `veeduriaService.js` expone consultas de escenarios, creación de reportes, pendientes, resolución y consulta histórica. No expone operación de oficialización.
- `PanelCMJ.jsx` permite validar y rechazar. Su texto afirma que al validar cambia el semáforo; debe corregirse al aplicar D1. El panel no presenta una cola separada de reportes validados pendientes de oficialización.
- El panel muestra estado oficial actual y estado propuesto; después de resolver vuelve a consultar pendientes, histórico y escenarios.
- `Reportar.jsx` indica que el reporte será revisado por CMJ antes de cambiar el semáforo. No ejecuta una oficialización.
- La ruta `/cmj` del frontend está protegida para rol `CMJ`. La ruta de validación backend también es solo CMJ; este plan no propone cambiar la ruta frontend existente.
- El frontend exige observación al rechazar, pero el controlador backend admite que sea nula. La regla efectiva debe decidirse y validarse en backend; no basta con la validación del navegador.

## 4. Flujo actual y objetivo

### Flujo actual

```text
Ciudadano crea reporte
        |
        v
Reporte PENDIENTE
        |
        v
CMJ ejecuta PUT de validación
        |
        +---- RECHAZADO ------> queda rechazado; no cambia el semáforo
        |
        +---- VALIDADO -------> trigger compara estado propuesto y oficial
                                  |
                                  +-- si difieren: inserta historial y cambia escenario
                                  +-- si coinciden: no registra ni actualiza
```

### Flujo propuesto según D1

```text
Ciudadano crea reporte
        |
        v
PENDIENTE
        |
        v
Operación 1 — CMJ valida o rechaza
        |
        +---- RECHAZADO ------> observación registrada; semáforo sin cambios
        |
        +---- VALIDADO -------> validador y fecha registrados; semáforo sin cambios
                                      |
                                      v
                         Cola de validados no oficializados
                                      |
                                      v
Operación 2 — usuario autorizado confirma estado a aplicar
        |
        v
Transacción única: bloquear/revisar reporte y escenario
        |
        +---- elegibilidad/permisos inválidos ---> rechazar sin cambios
        |
        +---- elegible ---> actualizar estado + registrar actor/fecha/historial
                              |
                              +-- cualquier fallo: ROLLBACK completo
```

Validar no debe llamar a oficialización ni por trigger, ni por lógica compartida que la ejecute implícitamente. Rechazar tampoco modifica el semáforo. El usuario y el cliente deben poder distinguir un reporte validado de uno ya oficializado.

## 5. Propuesta técnica

Las alternativas de esquema y permisos de esta sección son propuestas, no decisiones aprobadas.

### 5.1 MySQL

1. Retirar el comportamiento de `trg_oficializar_semaforo` en una migración versionada. La migración no debe reemplazarlo por otro trigger que oficialice al cambiar el estado del reporte.
2. Conservar `reporte_veeduria.id_cmj_valida` y `fecha_validacion` como trazabilidad de la operación 1.
3. Hacer explícita y consultable la oficialización y su actor/fecha. Propuesta de base: añadir campos de oficialización al reporte (por ejemplo, `id_usuario_oficializa` y `fecha_oficializacion`, ambos nulos hasta que se oficialice) y una FK de usuario. Para la trazabilidad del evento en el historial, incorporar un campo de actor de oficialización con FK a usuario, o acordar que el actor solo pueda ser CMJ y usar la relación existente `id_cmj`. No se deben sobrecargar silenciosamente `id_cmj_valida` o `historial.id_cmj` para representar una persona distinta.
4. Proteger la relación uno-a-uno entre reporte e historial de oficialización con una restricción única sobre `historial_estado_escenario.id_reporte` si el criterio aprobado es que un reporte solo oficializa una vez. Antes de añadirla, verificar duplicados en la base objetivo y ensayar la migración en una restauración aislada. El índice actual no es único. La columna admite `NULL`, por lo que varios registros históricos sin reporte seguirían siendo posibles bajo la semántica usual de MySQL.
5. Si se agrega un par de campos actor/fecha, valorar un `CHECK` que exija ambos nulos o ambos informados. Verificar compatibilidad efectiva con MySQL 8 y que las filas existentes satisfagan la regla antes de aplicarlo.
6. La actualización del escenario y el historial deben quedar en una misma transacción InnoDB del backend. Los índices/FKs existentes ya cubren referencias a escenario, reporte y CMJ; los nuevos actores requerirán FKs coherentes con el rol finalmente aprobado.
7. No reescribir ni borrar el historial existente. Los registros históricos fueron creados por el trigger y reflejan validaciones previas; no deben presentarse retroactivamente como una aprobación independiente si no hay evidencia de ella.

**Tratamiento de datos antiguos:** el corte de lectura encontró 2 reportes validados, ambos con historial asociado, y 1 rechazado. Esa correspondencia no elimina la necesidad de una regla de migración explícita. Si los campos nuevos representan oficialización, decidir si los reportes validados antiguos se consideran cerrados por el comportamiento legado, si se marcan como legado con trazabilidad incompleta o si requieren revisión manual. No inventar actor/fecha de oficialización ni volver a aplicar estados históricos. La decisión debe cubrir también reportes validados que ya no tuvieran una fila de historial en otro entorno.

**Estados iguales:** el trigger actual no crea historial si el estado propuesto coincide con el oficial. Para el nuevo flujo hay que definir si una oficialización que confirma el mismo estado se registra como evento explícito (estado anterior igual a nuevo) o si se rechaza/considera no-op con una marca que igualmente impida repetirla. No se debe implementar una opción por suposición.

### 5.2 Backend y API

1. Mantener el endpoint actual de validación para la operación 1. Debe limitarse a cambiar estado de reporte, validador, fecha y observación. Confirmar que ninguna llamada de esta operación cambie el escenario.
2. Agregar una consulta protegida para que roles autorizados vean reportes `VALIDADO` aún no oficializados, con los datos mínimos necesarios: id de reporte, escenario, estado vigente, estado propuesto, fecha de validación y validador. No exponer datos personales innecesarios.
3. Agregar una operación explícita para oficializar un reporte elegible; como forma ilustrativa, `POST /api/escenarios/reportes/:id_reporte/oficializar`. El método y la ruta definitivos deben seguir el estilo de API aprobado. Debe recibir el estado que el usuario confirma o selecciona, sin tomarlo implícitamente del endpoint de validación.
4. Resolver la operación en una conexión dedicada:
   - iniciar transacción;
   - leer y bloquear la fila del reporte (`SELECT ... FOR UPDATE`);
   - verificar existencia, estado `VALIDADO` y ausencia de oficialización previa;
   - comprobar autorización del actor desde la identidad autenticada;
   - bloquear la fila del escenario (`SELECT ... FOR UPDATE`) y capturar el estado anterior;
   - validar el estado destino permitido;
   - actualizar semáforo y fecha;
   - insertar el historial relacionado con el reporte y actor/fecha de oficialización;
   - marcar la oficialización como realizada si el diseño persiste ese estado en el reporte;
   - confirmar solo si todos los pasos terminan bien; ante cualquier excepción, `ROLLBACK`.
5. Responder con conflicto controlado (por ejemplo, HTTP 409) si otro proceso ya procesó el reporte o no cumple estado; no convertir una operación duplicada en una falsa respuesta exitosa. La respuesta debe distinguir reporte inexistente, estado no elegible, ya oficializado y falta de permisos según el patrón de errores de la API.
6. Mantener un orden consistente de bloqueo (reporte y luego escenario) para reducir interbloqueos. La restricción única en DB, junto con el bloqueo y la comprobación dentro de la transacción, es la última defensa contra carreras. Tratar un interbloqueo como fallo transaccional completo; decidir si se permite un reintento acotado y seguro o se devuelve un error reintentable.
7. Hacer cumplir en backend las reglas de observación de rechazo aprobadas. El cliente puede validar para UX, pero el servidor debe ser autoritativo.

### 5.3 Frontend

1. Conservar la acción actual de validar/rechazar como operación independiente y la ruta del panel CMJ.
2. Corregir el texto del panel: validar no cambia el semáforo oficial.
3. Añadir una sección/cola diferenciada de reportes validados pendientes de oficialización, alimentada por la nueva consulta API. Presentar claramente estado oficial y estado propuesto.
4. Mostrar la oficialización como una acción explícita posterior, con confirmación del estado destino. No agregarla al botón de validar ni ejecutar ambas operaciones en una sola acción.
5. Tras validar, refrescar la lista de pendientes y mantener el reporte en la lista de validados por oficializar. Tras oficializar, refrescar el semáforo y el historial; mostrar errores de conflicto y permisos sin simular éxito.
6. Mostrar por separado validador/fecha de validación y oficializador/fecha de oficialización si la API provee los datos. Mantener diseño accesible y adaptable.
7. Actualizar el mensaje del formulario ciudadano para explicar la secuencia aprobada (revisión/validación y, en su caso, oficialización posterior) sin prometer que el semáforo cambia al validar.

## 6. Seguridad, roles y privacidad

- Aplicar `verificarToken` y una lista de roles autorizados con `permitirRoles` en cada ruta nueva; verificar permiso también en la operación transaccional del servidor.
- No decidir el rol oficializador a partir de que pueda ver pendientes ni de que el componente frontend muestre el botón.
- Verificar autorización contra el rol de la identidad autenticada. Si se conserva JWT sin sesiones revocables (D5), documentar que la revocación inmediata de un token no forma parte de este cambio.
- Obtener el actor desde el token validado, nunca del cuerpo del request. Persistir identificador/fecha de validación y de oficialización de forma diferenciada.
- Restringir la consulta de candidatos a oficialización y respuestas históricas a roles aprobados; seleccionar campos explícitos en vez de exponer columnas completas o vistas con datos personales innecesarios.
- Mantener consultas parametrizadas y validar estados contra la enumeración permitida.
- Usar privilegios mínimos en la cuenta de aplicación como requisito de producción, según el plan de migraciones. Esta corrección no debe dar al frontend acceso directo a MySQL.

## 7. Migración, despliegue y rollback

### Preparación y ensayo

1. Aprobar el modelo de actor, roles autorizados, estados iguales, corte histórico y cambios de esquema.
2. Obtener DDL exacto y conteos de la instancia objetivo; verificar filas repetidas por `id_reporte`, coherencia de FKs y el mapeo reporte–historial. Mantener la consulta sin datos personales.
3. Asegurar un respaldo de la instancia correcta y demostrar su restauración en esquema/instancia aislados antes de migrar. Registrar versión MySQL, objetos, conteos y resultados. El respaldo verificado previamente es evidencia de una prueba anterior; no sustituye la comprobación del respaldo que se usará para una migración futura.
4. Ensayar el cambio con MySQL 8 en una copia restaurada y datos representativos, incluyendo duplicados/concurrencia, rollback de DML, FKs, CHECKs, vistas y recreación de la aplicación.
5. Implementar primero el ejecutor propio aprobado por D7, con registro de versión/checksum, exclusión de ejecuciones concurrentes, logs sin secretos y comprobación de pre/postcondiciones. Actualmente no fue encontrado en el código.

### Secuencia propuesta de aplicación

1. Poner el flujo de escritura en ventana de mantenimiento o detener las instancias API que puedan validar reportes. Evitar que convivan una versión que dependa del trigger y otra que asuma la operación separada.
2. Ejecutar mediante el ejecutor aprobado la migración versionada: retirar el trigger automático, aplicar únicamente los campos/FKs/índices/checks aprobados y registrar la clasificación de datos históricos decidida. MySQL puede confirmar DDL implícitamente; no depender de rollback transaccional de DDL.
3. Desplegar la API con validación separada y operación transaccional de oficialización; luego habilitar el panel actualizado.
4. Ejecutar comprobaciones de esquema, consulta de reportes elegibles, actualización/historial en entorno de prueba, permisos negativos e idempotencia. Confirmar que validar y rechazar ya no actualizan escenario.
5. Habilitar escrituras solo tras pasar las comprobaciones y registrar versión de app, migración, backup usado y aprobación.

La migración no debe hacer `DROP DATABASE`, eliminar filas ni alterar valores para que los conteos coincidan. El DDL y los scripts ejecutables se prepararán y revisarán en una autorización de implementación posterior; este documento no los contiene.

### Rollback y recuperación

- Preferir corrección hacia delante con escrituras pausadas si falla la API después de retirar el trigger. La retirada del trigger es un cambio DDL no transaccional y el rollback completo de esquema no puede prometerse como atómico.
- Diseñar los nuevos campos como aditivos en la medida posible y no borrar ni reinterpretar historial antiguo.
- No recrear automáticamente el trigger antiguo: hacerlo reintroduciría la contradicción con D1 y podría duplicar o volver a oficializar cambios.
- Si no es posible recuperar hacia delante, detener escrituras y ejecutar el procedimiento de recuperación aprobado, restaurando desde una copia verificada en un entorno aislado antes de cualquier decisión sobre la instancia objetivo. La recuperación de producción requiere autorización expresa y debe considerar las escrituras posteriores al respaldo.
- Un `down` de emergencia que restaure el trigger antiguo solo puede considerarse una decisión explícita de negocio/operación, con reconocimiento de que suspende D1; no debe ser la ruta normal ni automática.

## 8. Pruebas y criterios de aceptación

| Caso | Resultado requerido |
|---|---|
| Validar reporte pendiente | Estado queda `VALIDADO`, actor/fecha de validación se registran; estado/fecha oficial del escenario e historial no cambian. |
| Rechazar reporte pendiente | Estado queda `RECHAZADO`, observación conforme a regla aprobada; escenario e historial no cambian. |
| Validar/rechazar de nuevo un reporte procesado | No hay segunda transición; API devuelve conflicto/no elegible y no escribe cambios. |
| Oficializar reporte validado y elegible | Una transacción actualiza escenario, guarda historial con estado anterior/nuevo, reporte, actor y fecha; queda identificable como oficializado. |
| Intentar oficializar reporte pendiente | Se rechaza; escenario, reporte e historial permanecen sin cambios. |
| Intentar oficializar reporte rechazado | Se rechaza; escenario, reporte e historial permanecen sin cambios. |
| Oficializar dos veces el mismo reporte | Solo una operación tiene éxito; la siguiente se rechaza y no crea otra fila de historial ni altera estado. |
| Dos solicitudes concurrentes del mismo reporte | Una sola oficialización; la restricción única y el control transaccional previenen duplicados. |
| Dos reportes del mismo escenario concurrentes | Los cambios se serializan sobre el escenario; cada historial refleja el estado anterior efectivo de su transacción y no hay actualizaciones perdidas. |
| Usuario sin rol/permisos | API responde denegado sin modificar reporte, escenario o historial; probar acceso directo a endpoint, no solo el menú. |
| Falla insertando historial | El cambio de escenario y la marca del reporte se revierten; no queda estado parcial. |
| Estado elegido igual al vigente | Aplicar el comportamiento previamente aprobado para no-op; la decisión y su criterio de historial/idempotencia deben quedar probados. |
| Datos históricos anteriores | Conteos y filas históricas se conservan; no se asigna retroactivamente actor de oficialización sin evidencia. |
| Migración repetida / ejecución paralela | El ejecutor detecta versión ya aplicada y evita doble ejecución; bloquea o serializa dos ejecutores simultáneos. |
| Consulta de validados pendientes | Devuelve solo reportes `VALIDADO` aún elegibles y campos mínimos; excluye reportes pendientes, rechazados y ya oficializados. |
| Regresión de frontend | Validación y oficialización se presentan como pasos separados; mensajes, estados de carga/error y refresh reflejan cada operación sin llamadas de escritura duplicadas. |

El test de fallo al escribir historial debe inyectarse únicamente en base aislada o entorno de pruebas, nunca en la instancia original durante esta fase de análisis.

## 9. Riesgos y dependencias

| Riesgo/dependencia | Mitigación propuesta |
|---|---|
| El trigger es la única ruta actual que actualiza semáforo e historial al validar. Retirarlo antes de habilitar la nueva operación dejaría el sistema sin oficialización; habilitarla antes de retirar el trigger mantendría el comportamiento contrario a D1. | Ventana coordinada; detener escritores y desplegar migración/API/UI como una unidad operativa. |
| El historial actual atribuye el evento a `id_cmj_valida`, no a un actor de oficialización separado. | Añadir trazabilidad diferenciada; no cambiar el significado histórico. |
| `historial.id_reporte` no es único. | Auditar duplicados y aprobar restricción idempotente antes de añadirla; conservar `NULL` para hechos históricos sin reporte. |
| Los reportes validados existentes se oficializaron automáticamente solo cuando su estado propuesto difería del estado actual. | Aprobar la clasificación del legado; no inferir que ausencia de historial significa que nunca cambió o que aún está pendiente de oficializar. |
| La API permite administración en lectura de pendientes, pero no en validación. El rol oficializador aún no está definido. | Aprobar matriz de permisos D3/D1 antes de implementar endpoints. |
| MySQL DDL puede confirmar implícitamente. | Ensayo aislado, respaldo con restauración comprobada, pre/postcondiciones y recuperación aprobada. |
| No hay ejecutor de migraciones implementado ni pruebas backend configuradas (`npm test` en `BACKEND/package.json` es un marcador que falla). | Completar el requisito D7 y crear pruebas en una fase autorizada antes de desplegar esta migración. |
| Datos e historial pueden cambiar entre esta revisión y la migración. | Repetir preflight y conteos inmediatamente antes de migrar; no usar los conteos de este documento como baseline definitivo. |
| JWT no ofrece revocación inmediata por sí solo. | Mantener alcance D5; no presentarlo como solucionado por este cambio y respetar los roles del token validado. |

## 10. Decisiones pendientes de aprobación

1. **Rol de oficialización:** ¿CMJ solamente, rol administrativo, ambos u otro rol ya existente? La base actual liga el actor de historial a `cmj_consejero`; ampliar roles exige un modelo explícito de actor.
2. **Identidad que se almacena:** aprobar FK a `usuario` (cuenta), a `persona`, o mantener el actor como CMJ únicamente. Debe distinguir al oficializador del CMJ validador.
3. **Regla para el estado sin cambio:** ¿se permite confirmar el estado vigente? En caso afirmativo, ¿se crea evento de historial con estado anterior igual al nuevo o se guarda una marca de oficialización sin evento de cambio?
4. **Reportes ya validados:** aprobar cómo identificar en el nuevo modelo los dos reportes validados que actualmente tienen historial, así como cualquier reporte validado sin historial que pudiera existir en otros entornos. No asignar actor/fecha inventados.
5. **Observación de rechazo:** confirmar si es obligatoria en todos los rechazos; el frontend actual la exige y el backend no.
6. **Contrato API:** aprobar nombres/métodos definitivos para consultar validados pendientes y oficializar, además de códigos de respuesta para estado no elegible, repetición y concurrencia.
7. **Historial:** aprobar si toda oficialización, incluso no-op, debe aparecer en `historial_estado_escenario`, o si se requiere un registro separado de eventos de oficialización.
8. **Ejecutor de migraciones D7:** definir/autorizar la fase para implementarlo antes de preparar una migración ejecutable.

## 11. Orden recomendado de implementación

1. Resolver las decisiones pendientes de la sección anterior y aprobar el modelo objetivo.
2. Revalidar la copia de seguridad y el estado exacto de la instancia objetivo; extraer baseline de DDL y datos agregados.
3. Implementar y probar el ejecutor propio D7 en una base desechable/restaurada, sin apuntarlo a `deportes`.
4. Escribir la migración versionada para retirar el trigger, agregar trazabilidad aprobada y proteger idempotencia; probar conservación del historial.
5. Implementar la operación de validación sin efectos sobre escenario y la oficialización transaccional con autorizaciones explícitas.
6. Implementar consulta de validados no oficializados y adaptar Panel CMJ/formulario a dos pasos; conservar las rutas y operaciones existentes que sigan vigentes.
7. Ejecutar pruebas de API, base aislada, concurrencia, rollback de DML, permisos y regresión de interfaz; documentar resultados.
8. Desplegar de forma coordinada, verificar D1 en el entorno destino y actualizar inventario/documentación solo después de comprobarlo.

## 12. Criterio de cierre de D1

D1 podrá declararse implementado únicamente cuando esté comprobado que:

- validar y rechazar no cambian el semáforo oficial;
- solo los roles aprobados pueden oficializar;
- solo un reporte validado y todavía no oficializado puede completar la operación;
- escenario, trazabilidad y estado de oficialización se escriben en una transacción;
- no hay doble oficialización aun con solicitudes concurrentes;
- un fallo de historial revierte toda la operación;
- el historial legado permanece intacto y su interpretación no atribuye datos no comprobados;
- el panel y la API presentan claramente los dos pasos;
- las pruebas y la migración fueron ejecutadas en el entorno autorizado y sus resultados quedaron documentados.

Este plan no marca D1 ni ningún hallazgo técnico como resuelto.
