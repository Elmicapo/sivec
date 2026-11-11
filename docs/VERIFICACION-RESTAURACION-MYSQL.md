# Verificación de restauración del respaldo MySQL

**Resultado: EXITOSA para este respaldo y esta versión de servidor.** El volcado se cargó íntegramente en un esquema aislado y sus objetos y conteos se compararon con el esquema fuente. La prueba no cambia el estado general de DB-02: aún debe repetirse como procedimiento operativo antes de cada migración.

## Datos de la prueba

- Fecha/hora de verificación final: `2026-11-03 20:12:00 -05:00`.
- Servidor de origen/destino: MySQL `8.0.45`.
- MySQL Shell: `8.0.45` para Windows x86_64.
- Respaldo: `C:\Users\DELL LATITUDE 5500\SIVEC_BACKUPS\SIVEC-deportes-20261104T005121Z`.
- Esquema original: `deportes`.
- Esquema nuevo de restauración: `sivec_restore_test_20261104_484fe0eb`.
- Compatibilidad: el manifiesto declara un dump `dumpSchemas` de un solo esquema, producido por MySQL Shell/MySQL `8.0.45`; la versión de destino coincide.

## Procedimiento realizado

1. Se comprobó la existencia del manifiesto `@.json`, el marcador `@.done.json` y los archivos del respaldo. Se leyó el manifiesto y se confirmó que contiene solo el esquema `deportes`.
2. Se consultó la ayuda **local** de MySQL Shell mediante `\? util.loadDump`. Esta confirma la sintaxis `util.loadDump(url[, options])`, que la opción `schema` redirige un dump de un solo esquema al esquema indicado y que `loadUsers` es independiente.
3. Antes de crear el destino se verificó que el nombre elegido no existía. Se creó `sivec_restore_test_20261104_484fe0eb` con `utf8mb4` / `utf8mb4_0900_ai_ci` y se comprobó que no contenía tablas ni vistas.
4. Se ejecutó un `dryRun` indicando explícitamente `schema: "sivec_restore_test_20261104_484fe0eb"`. El análisis terminó sin cambios.
5. MySQL Shell indicó que necesita `@@GLOBAL.local_infile=ON` para `LOAD DATA LOCAL INFILE`. El valor original era `OFF`; con autorización del usuario se activó temporalmente, se hizo la carga y se restauró a `OFF`. El valor final se consultó y confirmó como `0`. No se usó `SET PERSIST`.
6. La carga se ejecutó con `util.loadDump` con `schema` explícito, `loadUsers:false`, `updateGtidSet:"off"`, `ignoreExistingObjects:false`, `progressFile:""` y cuatro hilos. La conexión de MySQL Shell no seleccionó `deportes` como esquema destino.
7. El proceso de carga terminó con código `0` y reportó `0 warnings`. No se ejecutó `DROP DATABASE`, migración ni restauración sobre `deportes`.

Los comandos ejecutados fueron consultas de solo lectura a `information_schema`, `CREATE DATABASE` únicamente para el esquema de prueba, `SET GLOBAL local_infile=ON/OFF` temporal y `mysqlsh util.loadDump` con el destino anterior. La contraseña se transmitió por stdin; no se incluyó en comandos, documentación ni resultados.

## Resultados de verificación

| Comprobación | Esperado según esquema real | Restaurado | Resultado |
|---|---:|---:|---|
| Tablas InnoDB | 15 | 15 | Correcto |
| Vistas | 10 | 10 | Correcto |
| Procedimientos | 1 | 1 (`sp_validar_inscripcion`) | Correcto |
| Triggers | 3 | 3 | Correcto |
| Claves foráneas | 20 | 20 | Correcto |
| Restricciones `CHECK` aplicadas | 6 | 6 | Correcto |
| Definiciones de índice distintas (por tabla e índice) | 40 | 40 | Correcto |
| Entradas de columna de índice en `information_schema.STATISTICS` | 51 | 51 | Correcto |
| Filas de datos | 45 | 45 | Correcto |
| Motores | Todas InnoDB | Todas InnoDB | Correcto |
| Consultas de lectura de vistas | 10 | 10 ejecutadas | Correcto |
| Consultas agregadas representativas | 2 | 2 ejecutadas | Correcto |
| Warnings de MySQL Shell durante la carga | 0 | 0 | Correcto |

La consigna indicaba como esperado **43 índices**. La inspección directa del esquema original y la restauración arrojan **40 definiciones de índice** (y 51 filas de columnas indexadas en `information_schema.STATISTICS`). El número 43 del inventario documental anterior no coincide con ninguna de estas dos métricas y se corrigió en [Inventario de objetos MySQL](./INVENTARIO-OBJETOS-MYSQL.md). No faltan índices en la restauración: se comparó la misma estructura fuente, que tiene 40 definiciones.

### Conteo por tabla

| Tabla | Filas |
|---|---:|
| `administrativo` | 1 |
| `cmj_consejero` | 1 |
| `cronograma` | 4 |
| `deportista` | 2 |
| `disciplina` | 4 |
| `disciplina_entrenador` | 2 |
| `disciplina_escenario` | 4 |
| `entrenador` | 1 |
| `escenario` | 3 |
| `historial_estado_escenario` | 2 |
| `inscripcion` | 2 |
| `persona` | 7 |
| `reporte_veeduria` | 3 |
| `rol` | 4 |
| `usuario` | 5 |
| **Total** | **45** |

Se ejecutaron consultas `SELECT COUNT(*)` contra las 10 vistas y consultas agregadas contra las tablas de inscripción y cronograma. Solo se conservaron conteos; no se mostraron registros personales.

## Comparación con la base original y alcance

Antes y después de la carga se compararon en `deportes` los nombres de tablas/vistas/rutinas/triggers, la cantidad de claves foráneas, checks e índices y el conteo exacto de filas de cada tabla. Los resultados coinciden. El comando de restauración mapeó explícitamente el dump al esquema nuevo y no se emitieron escrituras o DDL sobre los objetos de `deportes`.

La prueba se realizó en la misma instancia MySQL local, no en un servidor independiente. Confirma la lectura y restauración del formato de MySQL Shell en la versión coincidente, pero no cubre recuperación ante pérdida de la instancia, operación de despliegue, ni compatibilidad con versiones distintas. El esquema restaurado se conserva para inspección; no se elimina.

**Conclusión:** el respaldo puede considerarse recuperable en MySQL 8.0.45, en el entorno probado. DB-02 permanece abierto como requisito operativo recurrente hasta formalizar y repetir el procedimiento de restauración/aceptación para cada migración.
