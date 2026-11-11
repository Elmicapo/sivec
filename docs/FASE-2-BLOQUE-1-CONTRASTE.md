# Fase 2 — Bloque 1: recuperación y contraste documental

**Alcance:** exclusivamente documental. No se implementaron cambios de código ni de base de datos en este bloque.

## 1. Fuentes revisadas

1. [Requerimientos del programa](./requisitos/REQUERIMIENTOS%20DEL%20PROGRAMA.docx), leído completo. Describe roles y permisos, inventarios deportivos y culturales, escenarios y semáforo, cronogramas, veeduría, consultas e informes.
2. [Fase 1: Arquitectura y planificación](./arquitectura/SIVEC%20%E2%80%94%20Fase%201%20Arquitectura%20y%20planificaci%C3%B3n.pdf), leído completo (26 páginas). Contiene diagnóstico, arquitectura propuesta, hallazgos B1–B12, estrategia de base de datos, fases, riesgos y decisiones D1–D10 pendientes de aprobación en la fecha del documento.

No hay otros archivos dentro de `docs/`. La carpeta de arquitectura tenía el nombre `arquictectura`; se corrigió a `arquitectura` sin modificar ni duplicar el PDF.

## 2. Estado documental y de la solución

Fase 1 se presenta como propuesta pendiente de aprobación y declara que no implementó cambios. El inventario técnico previo encontró código de interfaz y API, y una instancia MySQL 8 con 15 tablas, 10 vistas, un procedimiento y tres triggers. Entre las reglas existentes están las validaciones de cupos y cruces de horario y la actualización del semáforo desde un trigger al validar un reporte.

El esquema y los objetos existentes no están acompañados en `docs/` por un DDL versionado, scripts de migración, respaldo verificado ni documentación de restauración. La existencia de objetos en la instancia no demuestra que las propuestas de Fase 1 estén implementadas. Los datos actuales se consideran de prueba conforme a la decisión aprobada; esto no elimina la obligación de hacer y verificar un respaldo antes de migrar.

## 3. Decisiones aprobadas D1–D10

Estas decisiones son independientes del catálogo DB-01–DB-12. La clasificación refleja las instrucciones aprobadas para SIVEC en este bloque.

| Código | Decisión aprobada | Aplicación documental / estado |
|---|---|---|
| D1 | Validar un reporte y oficializar el cambio del semáforo son dos operaciones diferentes. | Mantener estados y operaciones separados. La implementación todavía debe planificarse y probarse. |
| D2 | El entrenador solicita su vinculación y el administrador la aprueba. | Registrar solicitud y aprobación antes de habilitar la vinculación; pendiente de implementación. |
| D3 | Respetar la privacidad y los permisos por rol. | Aplicar permisos en el backend y exponer solo los datos correspondientes a cada rol. El canal de contacto entrenador–deportista sigue pendiente. |
| D4 | Los datos actuales son de prueba. | Actualiza la pregunta abierta de Fase 1 sobre si los datos eran reales. No equivale a respaldo ni autoriza a omitirlo. |
| D5 | Mantener JWT inicialmente y preparar sesiones revocables para una fase posterior. | JWT se conserva en la etapa inicial; la capacidad revocable se programa para la fase posterior indicada en Fase 1. |
| D6 | Los reportes ciudadanos sin cuenta conservan una copia de los datos necesarios y un código de seguimiento. | La copia debe quedar asociada al reporte, sin asociarla automáticamente a una cuenta existente. Límites y reglas de retención no definidos aquí. |
| D7 | Utilizar un ejecutor propio de migraciones. | No sustituirlo por una herramienta externa. |
| D8 | Las mejoras P3 se hacen si el tiempo lo permite. | P3 es condicional, no requisito de cierre prioritario. |
| D9 | Priorizar seguridad y desarrollar la PWA desde la fase prevista. | La seguridad se trabaja antes; la PWA comienza en la fase de diseño/cascarón prevista en Fase 1, no se posterga hasta el final. |
| D10 | Definir límites de evidencias antes de implementar esa funcionalidad. | Tamaño, formatos y cantidad siguen pendientes; no habilitar carga de evidencias antes de acordarlos. |

MySQL 8 es obligatorio. Se permite reorganizar y modificar el esquema, siempre que los cambios se documenten y apliquen mediante migraciones con respaldo verificado. El requisito final incluye despliegue real accesible por Internet para la evaluación académica.

## 4. Contradicciones y conciliación

| Tema | Requerimientos / Fase 1 | Decisión aprobada o situación actual | Cómo queda registrado |
|---|---|---|---|
| Versionado de decisiones y DB | Fase 1 usa `D1–D10` para decisiones y también `D1–D12` para hallazgos de base de datos. | Se requiere distinguir decisiones y hallazgos técnicos. | Las decisiones conservan D1–D10; DB-01–DB-12 son identificadores editoriales nuevos. No se debe inferir equivalencia por número con la serie D técnica, que colisiona con las decisiones. |
| Cambio de esquema | Fase 1 recomienda conservar el esquema y evolucionarlo de forma aditiva; también advierte sobre reconstruir `inscripcion`. | Se permite reorganizar/modificar el esquema, sujeto a migración documentada y respaldo verificado. | La recomendación aditiva de Fase 1 no es una restricción aprobada. Las migraciones pueden cambiar el esquema si cumplen las condiciones aprobadas y sus criterios de prueba. |
| Semáforo | El requisito distingue validar/rechazar y oficializar; el trigger actual, según Fase 1 y el inventario técnico, hace ambas cosas al validar. | D1 confirma que son operaciones diferentes. | Se registra como discrepancia funcional y DB-03; queda pendiente la implementación y la prueba del flujo separado. |
| Vinculación de entrenador | El requisito pide que el entrenador registre/actualice disciplinas y agenda; Fase 1 describe una vinculación automática y plantea una solicitud aprobada como alternativa. | D2 aprueba solicitud del entrenador y aprobación administrativa. | La vinculación automática no es el comportamiento objetivo. B7 queda abierto hasta implementar y probar la aprobación. DB-07 corresponde a snapshot/seguimiento de reportes anónimos, no a la vinculación del entrenador. |
| Identidad y privacidad | El requisito contiene datos personales y consultas por rol; Fase 1 plantea vistas y respuestas separadas. | D3 exige privacidad y permisos por rol. | El criterio de mínimo privilegio queda aprobado; el canal de contacto entre entrenador y deportista permanece pendiente. |
| Datos de prueba | Fase 1 pregunta si los datos actuales son reales y condiciona las migraciones a esa confirmación. | D4 confirma que son datos de prueba. | La incertidumbre sobre si son datos reales queda resuelta documentalmente; el respaldo verificado sigue siendo prerrequisito. |
| Sesiones | Fase 1 presenta JWT de acceso y refresh como alternativas y recomienda diferir la opción revocable. | D5 mantiene JWT inicialmente y prepara sesiones revocables después. | Se conserva el orden aprobado; no se adelanta una migración de sesiones a esta etapa por mera recomendación. |
| Reportes anónimos | El requisito permite reportar sin cuenta; Fase 1 propone snapshot del reportante y código. | D6 exige conservar copia de los datos necesarios y código de seguimiento. | Se adopta ese resultado funcional. Los límites de abuso y retención específicos no están aprobados en este bloque. |
| Ejecutor de migraciones | Fase 1 propone un ejecutor pequeño propio y menciona una herramienta externa como alternativa. | D7 selecciona ejecutor propio. | La alternativa externa queda descartada para el proyecto. |
| P3 y PWA | Fase 1 ordena seguridad primero, propone el cascarón PWA desde Fase 3 y clasifica push/QR/2FA como P3. | D8 y D9 confirman P3 condicional y PWA desde su fase prevista, con prioridad de seguridad. | La PWA no se pospone al cierre; las mejoras P3 no bloquean la entrega si el tiempo no alcanza. |
| Evidencias | Fase 1 deja tamaño y límites para una fase posterior. | D10 exige definirlos antes de implementar evidencias. | La fase indicada en Fase 1 no autoriza a implementar antes de definir límites. Valores pendientes. |
| Despliegue | Fase 1 indica que el alojamiento de producción no está decidido y que una instalación local documentada bastaría para el proyecto educativo. | Se requiere que el sistema final quede desplegado y accesible por Internet. | Se actualiza el criterio final de aceptación y se añade al plan. No se elige proveedor, dominio ni servicio de pago en este bloque. |

## 5. Matriz de hallazgos B1–B12

Los códigos B y las fases propuestas se conservan del apartado 17 y del plan de fases de Fase 1. Los criterios de aceptación sintetizan la corrección descrita allí; no afirman que esté implementada. **Estado de todos los hallazgos en este bloque: pendiente de implementación y verificación.**

| Hallazgo | Corrección documentada | Fase objetivo | Criterio de aceptación |
|---|---|---:|---|
| B1 — `errorHandler` no conectado y `error.message` enviado al cliente. | Conectar el middleware global; errores de aplicación y mensaje genérico al cliente; detalle en logs. | 2 | Errores internos no exponen SQL, stack ni mensajes sensibles; los errores controlados conservan el mensaje esperado por el frontend y el detalle técnico queda en logs. |
| B2 — CORS abierto; faltan cabeceras y límites de tasa. | Lista blanca de orígenes por entorno, Helmet y límites para login, registro, reportes y seguimiento. | 2 | Solo los orígenes configurados reciben acceso CORS; las rutas protegidas por límite responden con el estado de tasa documentado; cabeceras se verifican en pruebas. |
| B3 — Reporte sin cuenta sin controles suficientes. | Snapshot de datos del reportante, código de seguimiento, límites, detección de duplicados y campo trampa. | 6 | Un reporte sin cuenta conserva los datos y el código; las solicitudes inválidas o excedidas se rechazan; duplicados siguen la regla documentada y el flujo se prueba sin vincularlo a una cuenta por coincidencia de identificación. |
| B4 — Exposición de datos personales entre roles. | Consultas/vistas y servicios por rol; el entrenador ve solo deportistas de sus disciplinas; pantallas con datos mínimos. | 2 y 5 | Pruebas API por rol y propiedad demuestran que un usuario no obtiene datos personales o recursos fuera de su permiso; las pantallas no dependen de ocultar campos solo en el cliente. |
| B5 — Histórico público expone el nombre del reportante. | Vista pública sin datos personales y vista interna para administración/CMJ. | 2 | El histórico público no devuelve identidad ni datos personales del reportante; los roles autorizados consultan los datos internos según la política aprobada. |
| B6 — El trigger de inscripción puede revelar `error.message`. | Conservar mensajes controlados `SQLSTATE 45000`; convertir otros errores en respuesta genérica. | 2 | Errores de negocio previstos se traducen a respuestas controladas; errores inesperados no exponen detalle SQL al usuario y quedan registrados. |
| B7 — Vinculación automática de entrenadores. | Flujo de solicitud del entrenador y aprobación administrativa conforme a D2. | 5 | Una solicitud pendiente no habilita la vinculación; solo una aprobación autorizada habilita el vínculo, con pruebas de permisos y estado. |
| B8 — Token inválido responde 403 y el frontend trata 401/403 de forma conjunta. | 401 para falta/token inválido o expirado; 403 para rol insuficiente; sincronizar el interceptor del cliente. | 2 | Pruebas verifican 401, 403 y el comportamiento correspondiente del cliente sin cerrar una sesión válida por un mero 403 de autorización. |
| B9 — `JWT_SECRET` no validado al iniciar. | Validar variables de entorno al arranque y fallar rápido ante ausencia o longitud insuficiente. | 2 | El backend no arranca con secreto ausente o inválido y sí arranca con configuración válida, sin registrar el valor del secreto. |
| B10 — Validación manual e inconsistente. | Esquemas Zod por endpoint de escritura, límites de longitud y formato, incluida la URL de evidencia. | 2 y por módulo | Casos válidos pasan; campos faltantes, mal formados o fuera de límite se rechazan con respuesta consistente antes de llegar a la lógica de escritura. |
| B11 — Entornos no separados. | Configuraciones y bases de desarrollo, pruebas y producción separadas. | 2 | La configuración de un entorno no conecta accidentalmente con otro; las pruebas usan una base aislada y producción no carga datos de prueba. |
| B12 — Cuentas de prueba con contraseña conocida. | Semillas solo para desarrollo/pruebas; no crear cuentas de prueba en producción. | 2 | El proceso de despliegue no crea usuarios ni contraseñas de demostración en producción; semillas y credenciales están limitadas a entornos no productivos. |

## 6. Catálogo de hallazgos DB-01–DB-12

Fase 1 reutiliza códigos D para hallazgos de base de datos, lo que colisiona con las decisiones D1–D10. El siguiente catálogo usa códigos nuevos, solo documentales, para separar ambos conceptos. La fase es la prevista en Fase 1 o la necesaria para respetar las decisiones aprobadas. **Ninguno queda resuelto por este bloque.**

| Código nuevo | Hallazgo técnico de base de datos | Solución/fase prevista | Criterio de aceptación |
|---|---|---:|---|
| DB-01 | El esquema no tiene baseline/migraciones versionadas en el repositorio y Fase 1 advierte que el script original con `DROP DATABASE` no debe ejecutarse sobre una base existente. | 2 | Una línea base documentada y migraciones identificadas y revisadas permiten reproducir el esquema en una base de pruebas sin borrar una base existente. |
| DB-02 | No hay respaldo de base documentado y verificado ni ensayo de restauración identificado. | 2 | Antes de cada migración existe respaldo que incluye los objetos requeridos; se restaura en una base temporal y se verifica su integridad conforme al procedimiento documentado. |
| DB-03 | El trigger actual oficializa el semáforo al validar el reporte, mezclando dos operaciones. | 6 | Validar/rechazar no cambia el semáforo; una oficialización separada, autorizada y válida actualiza semáforo e historial una sola vez. |
| DB-04 | Las reglas de inscripción requieren asegurar disciplina activa y capacidad frente a escrituras concurrentes. | 2 | Pruebas con inscripción concurrente no superan el cupo; las disciplinas inactivas no aceptan nuevas inscripciones. |
| DB-05 | La integridad de inscripción depende también de impedir cruces de horario. | 2 | Las inscripciones que se cruzan se rechazan de forma consistente y las no conflictivas se conservan, incluso con las reglas de concurrencia cubiertas por pruebas. |
| DB-06 | La propuesta P1 de Fase 1 para hacer configurable la aprobación de inscripciones y añadir estados puede requerir reconstruir `inscripcion` por su columna generada y su índice único; se clasifica como riesgo alto. La aprobación configurable no está establecida por los requerimientos ni aprobada en este bloque. | 5, solo si se aprueba ese alcance | Si se aprueba: una migración conserva inscripciones e índices, respeta los estados acordados y pasa pruebas de subida/restauración en una base de pruebas con respaldo verificado. Sin esa aprobación, no implementar la propuesta P1. |
| DB-07 | `reporte_veeduria` necesita conservar snapshot del reportante sin cuenta y código de seguimiento. | 6 | El esquema persiste ambos junto al reporte y permite consultarlo por el código, sin asociar por identificación una cuenta existente. |
| DB-08 | El modelo de evidencia requiere almacenamiento y metadatos; los límites de tamaño, formatos y cantidad siguen sin definirse (D10). | 6, solo después de definir límites | La estructura y validación implementadas cumplen los límites aprobados; las evidencias no son públicas por defecto y sus límites se prueban. No iniciar esta funcionalidad antes del acuerdo D10. |
| DB-09 | Se necesitan consultas/vistas diferenciadas para datos públicos y datos por rol. | 2 | Consultas públicas omiten datos personales; las consultas internas devuelven únicamente los datos permitidos al rol, verificados con pruebas de permisos. |
| DB-10 | Fase 1 propone separar auditoría y cuentas MySQL de aplicación/migración; también propone tablas de sesión e intentos para la fase de autenticación posterior. | 2 y 7, según componente | El usuario de aplicación tiene los privilegios de aplicación acordados y no puede alterar la estructura; las tablas de sesión revocable solo se añaden en la fase prevista y se prueban antes de usarse. |
| DB-11 | Fase 1 identifica índices faltantes como parte de la migración de integridad. | 2 | Los índices aprobados existen en la base de pruebas y las consultas asociadas conservan resultados correctos; no se agregan índices sin justificar su consulta objetivo. |
| DB-12 | Las cuentas de prueba con contraseña conocida no deben llegar a producción. | 2 | El esquema/seed productivo no contiene cuentas de demostración ni credenciales conocidas; las semillas están separadas por entorno. |

Los criterios de esta tabla son condiciones de aceptación futuras, no pruebas ejecutadas. DB-01–DB-12 no representan decisiones de producto ni sustituyen D1–D10.

## 7. Decisiones y definiciones pendientes

Se registran únicamente aspectos que las fuentes dejan sin definir:

1. **D3 — canal de contacto:** Fase 1 deja pendiente cómo contactar a deportistas desde el rol entrenador. D3 aprueba privacidad y permisos, pero no especifica canal ni autorización concreta.
2. **D10 — límites de evidencias:** tamaños máximos por archivo y reporte, formatos permitidos y cantidad. Definirlos antes de implementar carga/almacenamiento.
3. **D1 — representación del flujo:** las operaciones deben ser distintas; la experiencia concreta (dos acciones visibles o una interfaz que conserve dos pasos/estados) no quedó decidida en las instrucciones recibidas.
4. **D6 — seguimiento:** el código es obligatorio, pero no se definieron aquí vigencia, retención ni procedimiento de recuperación.
5. **Despliegue público:** falta decidir plataforma/servidor, dominio, alojamiento de MySQL, presupuesto y método de publicación. No contratar servicios ni asumir costos sin autorización.
6. **Elementos visuales mencionados en Fase 1:** identidad/logo y coordenadas reales de escenarios dependen de información del usuario; no deben inventarse.

La selección del ejecutor propio de migraciones (D7), MySQL 8, D1–D10, la condición de datos de prueba, las prioridades P3 y la obligación de despliegue público no están pendientes de aprobación; sus detalles técnicos aún deben desarrollarse y verificarse.

## 8. Plan actualizado

Se conserva el orden general de Fase 1: seguridad y base técnica primero; PWA desde la fase prevista; módulos y mejoras posteriores. Se actualiza la condición de cierre para exigir una aplicación publicada y accesible por Internet.

| Fase | Alcance documental actualizado | Condición para avanzar |
|---|---|---|
| 2 — Preparación técnica y base de datos | Seguridad B1, B2, B5, B6, B8–B12; separación de entornos; esquema reproducible, ejecutor propio, respaldos y restauración probados; migraciones iniciales y pruebas de permisos. Preparar configuración de despliegue, sin elegir proveedor ni incurrir en costos. | Respaldo restaurado y verificado; migraciones de esta fase aplican en una base de prueba; hallazgos asignados a esta fase pasan sus criterios; frontend actual sigue funcionando. |
| 3 — Diseño visual y componentes | Identidad visual aprobada y cascarón PWA: manifest, service worker y componentes base. | PWA instalable; accesibilidad, contraste y movimiento reducido verificados según Fase 1. |
| 4 — Portada y navegación | Portada pública, navegación por módulos y buscador/mapa con datos reales disponibles. | Funciona en móvil, tableta y escritorio; no presenta coordenadas inventadas. |
| 5 — Oferta, agendas y usuarios | Funcionalidad esencial de disciplinas/escenarios/cronogramas/inscripciones, solicitud y aprobación de vinculación D2, permisos y privacidad. | Casos funcionales y matriz de permisos probados; recursos no accesibles fuera del rol/propiedad. |
| 6 — Veeduría | Flujo separado D1, snapshot y seguimiento D6, límites D10 previos a evidencia, controles de abuso y cola offline/sincronización. | Estados, permisos, historial, seguimiento e idempotencia verificados; evidencia solo después de aprobar sus límites. |
| 7–8 — Sesiones y adicionales | Sesiones revocables preparadas para la fase prevista por D5; funciones P2 y adicionales de acuerdo con prioridades. | Pruebas de sesión/permisos y documentación de funcionalidades incluidas. |
| 9 — Integración y optimización | Regresión integral, rendimiento, seguridad, PWA y preparación de producción. | Resultados de pruebas reales documentados y errores conocidos listados. |
| 10 — Documentación, entrega y despliegue | Manuales, API, decisiones y operación. Se incorpora como requisito de cierre un despliegue real y accesible por Internet para evaluación académica. | URL pública accesible desde Internet; versión desplegada validada con recorrido de roles y pruebas de aceptación; configuración productiva separada y sin credenciales/datos de prueba. |

La fase final no selecciona proveedor, dominio ni servicio pago. La infraestructura y cualquier costo requieren una decisión/autoridad posterior.

## 9. Riesgos y pruebas necesarias

- **Migración:** DDL de MySQL puede confirmar implícitamente transacciones; no confiar en rollback automático. Revisar cada migración y su reversa, hacer respaldo completo, verificar restauración y aplicar primero en base aislada.
- **Datos y credenciales:** separar seeds por entorno; impedir credenciales conocidas en producción; mantener secretos fuera del repositorio y de respaldos/paquetes públicos.
- **Privacidad y permisos:** pruebas API con cada rol y propietario distinto; revisar respuestas, vistas e históricos, no solo el menú del frontend.
- **Integridad:** pruebas de cupos concurrentes, disciplina activa, choques de horario, triggers, historial del semáforo y estados de reporte.
- **Veeduría y offline:** seguimiento de reportes anónimos, duplicados, límites, reintentos, idempotencia y limpieza de datos locales sensibles.
- **Evidencias:** no habilitar carga hasta acordar D10; después validar tipo real, tamaño, cantidad, almacenamiento no público, acceso autorizado y metadatos conforme a lo aprobado.
- **Despliegue:** probar configuración separada, disponibilidad pública, TLS, acceso a API y MySQL, restauración y recorrido funcional desde fuera del equipo local. Plataforma y coste aún no seleccionados.
- **Cobertura:** Fase 1 menciona suite de base de datos, API, interfaz y flujos completos; el diagnóstico previo no encontró suite backend configurada. No declarar pruebas aprobadas hasta ejecutarlas y registrar resultados.

## 10. Cierre del bloque

Este bloque recupera y organiza fuentes, aclara nomenclatura, registra decisiones aprobadas, documenta contradicciones y añade el requisito de despliegue a la planificación. **No implementa ni marca como resuelto ningún hallazgo técnico.** Se requiere autorización expresa para iniciar el siguiente bloque.
