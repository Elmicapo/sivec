# Plan propuesto de migraciones MySQL

**Estado:** D7 y las migraciones 001–003 fueron aplicados y verificados únicamente en una restauración aislada del respaldo. No se ejecutaron sobre `deportes` ni en producción. MySQL 8 se conserva como requisito.

## Principios

1. Usar el ejecutor propio aprobado en D7, con historial de versiones/checksums, detección de ejecuciones repetidas y protección contra dos ejecutores simultáneos.
2. No ejecutar automáticamente scripts de instalación que eliminen o reconstruyan una base existente.
3. Cada cambio debe explicar objetivo, dependencias, estrategia de conservación de datos, verificación y recuperación. DDL de MySQL puede confirmar transacciones implícitamente: no prometer rollback transaccional donde no aplica.
4. No duplicar reglas en API y base de datos sin una fuente de verdad acordada. Conservar FKs, restricciones duras y validación autoritativa bien delimitada.
5. Hacer ensayo completo en una base aislada antes de una instancia objetivo. Probar restauración de respaldo fuera de la base original antes de migrar; registrar versión de motor y objetos.
6. La instancia auditada contiene datos de prueba, pero se deben preservar registros útiles para pruebas/regresión y documentar cualquier mapeo o descarte.

## Evidencia del Bloque 2 — solo base aislada

- El ejecutor propio está en `BACKEND/scripts/migrate.js`; las migraciones versionadas están en `BACKEND/migrations/`. El servidor de la aplicación no las ejecuta al iniciar.
- El CLI requiere una base explícita con nombre de prueba/aislada, conexión MySQL 8, checksum SHA-256 por versión, historial `sivec_schema_migrations`, lock advisory por base y bloqueo ante checksum distinto, estado `RUNNING` obsoleto o fallo. No crea ni elimina bases. Los destinos no aislados permanecen bloqueados.
- Se ejecutaron `001_d1_independent_officialization.js` y `002_reportar_intake_and_evidence.js` en `sivec_restore_test_20261104_484fe0eb`, previamente restaurada desde `SIVEC-deportes-20261104T005121Z`; servidor MySQL `8.0.45`. La segunda ejecución omitió ambas versiones ya aplicadas.
- La migración `003_report_decision_history.js` añadió `reporte_veeduria_historial` en esa misma copia; el ledger registra 001–003 como `APPLIED`. El nuevo servicio ejecutó allí recepción, validación y oficialización dentro de una transacción de prueba.
- Las pruebas de migración se ejecutaron en transacción y se revirtieron. Se conservaron los 3 reportes, 2 filas del historial y 3 escenarios iniciales; no quedaron filas de prueba en las tablas nuevas.
- Postflight previo a 003: 30 FKs comprobadas, cero referencias huérfanas, 17 `CHECK` enforced, todas las tablas InnoDB. Después de 003 se verificaron 32 FKs, 18 `CHECK` enforced y todas las tablas InnoDB. D1: trigger automático retirado solo en la copia, marcas de oficialización y unicidad de historial presentes. `deportes` fue verificada con consultas de solo lectura y conserva el trigger, no tiene las columnas D1 nuevas y mantiene sus conteos documentados.
- El verificador de esquema y sus comandos reproducibles están descritos en [`BACKEND/migrations/README.md`](../BACKEND/migrations/README.md). DDL MySQL puede confirmar implícitamente; una versión fallida requiere inspección manual, no reintento automático.

## Orden recomendado

| Etapa | Alcance / motivo | Dependencias y pruebas de aceptación |
|---|---|---|
| 0. Baseline y seguridad operativa | Registrar DDL actual y versiones, formalizar el ejecutor propio, respaldos, retención y procedimiento de restauración. Separar configuración de desarrollo, pruebas y producción. Sustituir en preparación de producción la cuenta `root` por usuarios mínimos separados para aplicación/migración. | DB-01, DB-02, DB-10, DB-12. D7 ya se probó aplicando migraciones a una restauración aislada; todavía falta probar la instalación desde una base vacía y preparar cuentas de privilegio mínimo. Una segunda ejecución omite cambios ya aplicados. Ninguna prueba contra `deportes` original. |
| 1. Diseñar el modelo objetivo y conservar datos | Decidir una estructura mantenible en MySQL 8. Revisar roles/perfiles, índices, restricciones, referencias y estados. Preparar mapeo desde los datos existentes antes de crear tablas/columnas nuevas. | Revisión de claves y duplicados en copia; comparar filas por entidad antes/después; validar todas las FKs; no descartar inscripciones, reportes ni historial sin aprobación documentada. |
| 2. Integridad de inscripción y agenda | Acordar fuente de verdad para cupos, disciplina activa y cruces; cubrir escrituras concurrentes y evitar cronogramas incompatibles. Añadir constraints/índices solo donde sean justificables y compatibles con datos existentes. | DB-04, DB-05, DB-11. Pruebas de cupo límite y concurrente, disciplina inactiva, horarios que se cruzan/no se cruzan, periodos de vigencia, duplicado activo e historial cancelado/finalizado. Comprobar plan con `EXPLAIN` para consultas objetivo. |
| 3. Vinculación aprobada de entrenador | Implementar solicitud explícita del entrenador y aprobación administrativa D2; reflejar estados y auditoría de la solicitud. Una asociación efectiva no debe surgir solo por crear/modificar un cronograma. | D2 y requisito funcional. Pruebas de solicitud, aprobación, rechazo, reintento, permisos y ausencia de vínculo antes de aprobar. Migrar asociaciones existentes solo con regla de conservación revisada. |
| 4. Reporte y semáforo | Separar cambio de estado del reporte de una operación autorizada y explícita de oficialización; conservar historial y proteger idempotencia. | DB-03 / D1. La estructura se ensayó en aislamiento y se comprobó que validar no dispara el trigger ni crea historial. Sigue pendiente implementar y probar el endpoint transaccional CMJ; debe registrar oficialización incluso cuando el color coincida. |
| 5. Recepción de reportes, seguimiento y evidencia | Incorporar snapshot obligatorio de nombre/apodo y correo, sin número de identificación, código de seguimiento y metadatos de evidencias privadas. No asociar nuevos reportes a una persona mediante identificación. | DB-07, DB-08. El esquema existe solo en aislamiento. El backend debe validar el código y permisos, el mínimo de una foto y 20 MB acumulados; almacenar archivos privados y definir retención antes de habilitar cargas. No existe modalidad sin identidad. |
| 6. Privacidad, vistas y permisos | Separar las consultas públicas de las internas; minimizar datos personales; revisar vistas `DEFINER`, endpoints y cuenta de servicio. Mantener sesiones revocables para la fase prevista por D5, no adelantar su cambio por esta auditoría. | DB-09, DB-10. Pruebas negativas por rol/propietario en API y SQL; respuestas públicas sin PII; cuenta de aplicación sin DDL/gestión global; ejecución de vistas sin privilegios excesivos. |
| 7. Validación integral y despliegue | Ejecutar regresión de API/frontend, pruebas de seguridad y restauración en configuración de despliegue. Mantener MySQL 8. Despliegue público accesible por Internet es requisito de cierre académico. | Migraciones aplicadas en copia aislada; recorrido funcional y permisos verificados; respaldo/recuperación demostrados; URL accesible externamente, TLS y secretos/configuración de producción separados. No elegir/contratar proveedor ni incurrir en costos sin aprobación. |

Las etapas 3–5 corresponden al comportamiento acordado; DB-06 (aprobación configurable de inscripción) sigue condicionado a aprobación de alcance y no se presume necesario.

## Preparación antes de cada migración

- Revisar documentación, SQL, dependencias, datos afectados, privileges y reversibilidad de DDL.
- Confirmar respaldo de la instancia correcta, fuera del repositorio; hacer prueba de restauración en entorno separado y comprobar estructura, datos, vistas, rutinas y triggers.
- Aplicar primero en base aislada con copia representativa, comparar conteos, verificar integridad referencial y ejecutar pruebas positivas/negativas/concurrentes.
- Registrar versión MySQL, migración y checksum, logs sin credenciales/datos personales, verificaciones y aprobación.
- No marcar DB-01–DB-12 como resueltos hasta cumplir y documentar sus criterios de aceptación.

## Riesgos y pendientes

- El respaldo `SIVEC-deportes-20261104T005121Z` se restauró el 2026-11-03 en `sivec_restore_test_20261104_484fe0eb`: se verificaron 15 tablas, 10 vistas, 1 procedimiento, 3 triggers, 20 FKs, 6 checks y 45 filas, con cero warnings. La prueba confirmó 40 definiciones de índice (51 entradas de columnas indexadas); el valor 43 previamente documentado era incorrecto y se rectificó. DB-02 permanece abierto como procedimiento recurrente: la prueba cubrió este respaldo en la misma instancia/versión, no una recuperación en servidor independiente ni el ciclo de cada migración.
- Falta revisar/migrar la anomalía de un par de cronogramas activos solapados encontrada en datos de prueba antes de incorporar una restricción.
- Los límites fotográficos D10 se aprobaron posteriormente y están consolidados en [Plan maestro de Fase 4 — Reportar](./FASE-4-PLAN-REPORTAR.md). Siguen pendientes el proveedor/ubicación del almacenamiento privado, la retención y respaldos de evidencias, el canal de contacto D3, la vigencia/recuperación del código D6 y el proveedor/costo de despliegue.
- La configuración de aplicación actual usa una cuenta SQL global `root`; configurar privilegios de producción es prerrequisito.
- La migración no debe copiar valores de prueba a producción ni eliminar registros útiles silenciosamente.
- D1 y la recepción de reportes tienen rutas/servicios backend con pruebas unitarias e integración aislada. No están habilitados sobre `deportes` ni producción; la guardia exige las migraciones 001–003 aplicadas. El endpoint de seguimiento ciudadano, carga de fotos y notificaciones permanecen pendientes.
- La migración 002 deja `reporte_veeduria.id_reportante` nullable para los nuevos reportes con snapshot separado y cambia `v_historico_veedurias` a `LEFT JOIN`; los registros históricos conservan su persona. Requiere revisión de consumidores y permisos antes de un despliegue integrado.

## Preparación controlada del destino original `deportes`

**Estado de este cambio:** preparación de código y pruebas automatizadas solamente. No se conectó a `deportes`, no se ejecutó el preflight allí y no se aplicó ninguna migración. La base original permanece sin cambios por esta tarea.

- `BACKEND/scripts/migrate.js` conserva el camino aislado existente y añade un modo separado que autoriza exclusivamente `--database=deportes --allow-original-deportes --confirm-target=deportes`. Exige `--backup-manifest`; las bases aisladas rechazan estos flags.
- `BACKEND/scripts/prepare-deportes-backup-manifest.js` compara en transacciones de solo lectura el esquema y los conteos exactos de `deportes` con una restauración aislada `sivec_restore_test_*`. Registra host/puerto y versión MySQL, hashes SHA-256 del respaldo y evidencia, y firma el manifiesto con HMAC usando `SIVEC_BACKUP_MANIFEST_KEY` (mínimo 32 bytes). El archivo de respaldo, la evidencia y el manifiesto deben mantenerse fuera del repositorio.
- El marcador de restauración `RESTORE SUCCESS: sivec_restore_test_<suffix>` es una atestación del operador; el sistema valida su archivo/hash y la igualdad entre origen y copia, pero no puede demostrar por sí mismo la procedencia del dump. La persona responsable debe verificar la restauración y conservar evidencia confiable.
- `--preflight-only` abre transacciones `READ ONLY`, no crea el ledger ni ejecuta DDL. Comprueba identidad real de `deportes`, host, puerto, MySQL 8 y su coincidencia con el manifiesto; hashes/evidencia; ledger/orden/checksums; tablas, columnas, constraints, índices, duplicados, trigger y definición de `v_historico_veedurias`; además de conteos exactos.
- El modo de ejecución solo admite 001, 002 y 003 en ese orden. Revalida el respaldo, la identidad, los conteos base y el estado de versiones antes de cada migración; verifica postflight de D1, estructura Reportar, vista e historial. Si una versión falla, registra la versión/error y se detiene sin rollback automático del DDL.
- El procedimiento, los comandos de PowerShell y la recuperación manual están documentados en [`BACKEND/migrations/README.md`](../BACKEND/migrations/README.md). Primero se debe crear el manifiesto con una copia aislada restaurada sin migrar, ejecutar y revisar el preflight; el comando de aplicación no se debe invocar hasta contar con autorización expresa para ese paso.
