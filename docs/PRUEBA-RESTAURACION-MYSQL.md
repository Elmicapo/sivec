# Prueba de restauración aislada de MySQL

**Resultado: EXITOSA.** El respaldo se restauró en un esquema nuevo, y su estructura, objetos, conteos de filas y relaciones se contrastaron con el esquema `deportes` y con la auditoría documentada. La base original no recibió escrituras ni cambios de esquema.

## Datos de la prueba

- Fecha/hora local: 2026-11-03, entre 21:19 y 21:26 (UTC−05:00); comprobación final a las 21:26:10.
- Respaldo: `C:\Users\DELL LATITUDE 5500\SIVEC_BACKUPS\SIVEC-deportes-20261104T005121Z`.
- Esquema contenido en el respaldo: `deportes`.
- Formato: volcado de directorio comprimido, generado por `util.dumpSchemas`; manifiesto versión `2.0.1`.
- MySQL Shell y servidor: `8.0.45`.
- Esquema temporal: `deportes_restore_test_20261103_211900_a4c82f6d`.
- Esquema fuente conectado durante la prueba: `deportes`.
- Tamaño de los archivos del respaldo: 68,919 bytes; 15 fragmentos comprimidos con 45 filas y 2,301 bytes de datos según el marcador de finalización.

Antes de crear el destino se comprobó que no existía. El esquema se creó vacío con `utf8mb4` / `utf8mb4_0900_ai_ci`. No se reutilizó ni sobrescribió el esquema de una prueba anterior. El esquema temporal se conserva y no se ejecutó `DROP DATABASE`.

## Procedimiento

1. Se comprobó la carpeta y la presencia de `@.json`, `@.done.json`, los metadatos de 15 tablas, 15 fragmentos `.tsv.zst`, los archivos DDL y las definiciones de 10 vistas. El manifiesto declara un único esquema (`deportes`), origen `dumpSchemas` y servidor de origen MySQL `8.0.45`; el marcador de finalización registra 15 fragmentos.
2. Se consultó la ayuda local de MySQL Shell con `mysqlsh --js -e "print(util.help('loadDump'))"`. La sintaxis confirmada es `util.loadDump(url[, options])`; `schema` redirige un volcado de un esquema a otro esquema destino. La opción `loadUsers` es independiente.
3. La primera prueba `dryRun` se detuvo antes de cualquier cambio porque el servidor tenía `@@GLOBAL.local_infile=0`. La ayuda local confirma que `util.loadDump` requiere esa variable activada.
4. Se activó temporalmente `local_infile` con `SET GLOBAL local_infile=ON`, se repitió `dryRun` indicando el esquema aislado y terminó sin cambios ni advertencias.
5. Se ejecutó la carga completa indicando explícitamente `schema: "deportes_restore_test_20261103_211900_a4c82f6d"`, `loadUsers: false`, `updateGtidSet: "off"`, `ignoreExistingObjects: false`, `progressFile: ""` y cuatro hilos. No se cargaron cuentas de servidor ni se cambió el conjunto GTID.
6. MySQL Shell reportó 15 fragmentos, 45 filas, 15 tablas y cero advertencias. Al finalizar, `local_infile` se restauró a `OFF` y se verificó como `0`.
7. El respaldo se cargó solo en el esquema temporal. La conexión de MySQL Shell tenía `deportes` como esquema seleccionado, pero la opción `schema` de `util.loadDump` mapeó explícitamente los objetos al destino aislado.

La autenticación se suministró por la entrada estándar de MySQL Shell; no se escribieron credenciales en comandos ni en este documento.

## Comparación de objetos

| Objeto o comprobación | Auditoría/origen | Restaurado | Resultado |
|---|---:|---:|---|
| Tablas InnoDB | 15 | 15 | Correcto |
| Vistas | 10 | 10; se ejecutó `SELECT COUNT(*)` en cada una | Correcto |
| Procedimientos | 1 | `sp_validar_inscripcion` | Correcto |
| Triggers | 3 | 3, con tabla, evento y momento coincidentes | Correcto |
| Claves foráneas | 20 | 20 | Correcto |
| Restricciones `CHECK` | 6 | 6 | Correcto |
| Definiciones de índices | 40 | 40 | Correcto |
| Entradas de columnas indexadas | 51 | 51 | Correcto |
| Diferencias de columnas y definiciones | — | 0 diferencias en columnas, índices, FKs, checks y nombres de vistas | Correcto |
| Filas totales | 45 | 45 | Correcto |
| Relaciones huérfanas | 0 reportadas en la auditoría | 0 en las 20 relaciones | Correcto |
| Motor | InnoDB | InnoDB en las 15 tablas | Correcto |
| `local_infile` al terminar | 0 antes de la carga | 0 | Correcto |

El inventario anterior de objetos señala 40 definiciones de índices y 51 entradas de columnas indexadas; ambas métricas coinciden entre origen y restauración.

### Conteo de filas por tabla

Solo se consultaron y documentaron conteos agregados; no se publicaron registros personales.

| Tabla | Origen | Restaurado |
|---|---:|---:|
| `administrativo` | 1 | 1 |
| `cmj_consejero` | 1 | 1 |
| `cronograma` | 4 | 4 |
| `deportista` | 2 | 2 |
| `disciplina` | 4 | 4 |
| `disciplina_entrenador` | 2 | 2 |
| `disciplina_escenario` | 4 | 4 |
| `entrenador` | 1 | 1 |
| `escenario` | 3 | 3 |
| `historial_estado_escenario` | 2 | 2 |
| `inscripcion` | 2 | 2 |
| `persona` | 7 | 7 |
| `reporte_veeduria` | 3 | 3 |
| `rol` | 4 | 4 |
| `usuario` | 5 | 5 |
| **Total** | **45** | **45** |

### Objetos restaurados

El procedimiento observado en metadatos es `sp_validar_inscripcion`. Los triggers y sus eventos son:

- `trg_inscripcion_bi`: `inscripcion`, `BEFORE INSERT`.
- `trg_inscripcion_bu`: `inscripcion`, `BEFORE UPDATE`.
- `trg_oficializar_semaforo`: `reporte_veeduria`, `AFTER UPDATE`.

Las 10 vistas se consultaron con `SELECT COUNT(*)`: `v_cronograma_consolidado`, `v_disciplinas_demanda`, `v_historial_deportista`, `v_historico_veedurias`, `v_persona_edad`, `v_reportes_pendientes`, `v_rep_deportistas_por_disciplina`, `v_rep_disciplinas_activas`, `v_rep_entrenadores` y `v_rep_escenarios_semaforo`. Todas respondieron correctamente.

## Consultas de verificación

Se ejecutaron consultas de solo lectura para:

- Obtener `VERSION()`, `DATABASE()` y `@@GLOBAL.local_infile`.
- Contar filas por tabla en `deportes` y en el esquema temporal.
- Contar tablas, vistas, procedimientos, triggers, claves foráneas, checks e índices en `information_schema`.
- Comparar las definiciones de columnas, índices (incluido orden y unicidad), FKs, checks y nombres de vistas entre origen y restauración.
- Consultar las diez vistas con `SELECT COUNT(*)`.
- Comprobar huérfanos con joins anti-join para las 18 relaciones de una columna y las dos FKs compuestas.
- Consultar los nombres, tablas y eventos de los tres triggers y el nombre del procedimiento.
- Confirmar que `deportes` y el esquema temporal permanecían presentes y que `local_infile` estaba en `OFF` al finalizar.

No se ejecutaron `INSERT`, `UPDATE`, `DELETE`, migraciones ni llamadas al procedimiento. Las pruebas de huérfanos y vistas devolvieron únicamente conteos.

## Errores, advertencias y limitaciones

- `dryRun` inicialmente falló con `MYSQLSH 53025` porque `local_infile` estaba desactivado. Se activó temporalmente solo para la prueba; al finalizar se verificó nuevamente como `OFF`. No se usó `SET PERSIST`.
- Dos consultas preliminares de verificación de metadatos tuvieron errores de construcción/selección de una columna no disponible. Eran consultas de lectura, no cambiaron datos, y se repitieron corregidas; los resultados finales están resumidos arriba.
- La carga terminó con **cero advertencias**.
- La prueba confirma recuperación en la misma instancia local y la misma versión MySQL 8.0.45. No prueba recuperación en un servidor distinto ni ejecuta el procedimiento almacenado. Los triggers se verificaron por metadatos; no se provocaron transiciones de reporte.
- Los conteos de filas coinciden con la auditoría y el respaldo. No se publicó ni inspeccionó contenido personal de las tablas como evidencia.

## Estado de la base original

Antes y después de la carga, `deportes` conservó sus 15 tablas, 10 vistas, 1 procedimiento, 3 triggers, 20 claves foráneas, 6 checks, 40 índices y los mismos conteos por tabla. No se ejecutó DDL ni DML sobre sus objetos. La única modificación temporal fue `@@GLOBAL.local_infile`, que se verificó restablecida a `0`.

La base temporal `deportes_restore_test_20261103_211900_a4c82f6d` queda disponible para inspección y no fue eliminada.
