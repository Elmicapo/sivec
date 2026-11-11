# Inventario de objetos MySQL

Instancia auditada: `deportes`, MySQL 8.0.45. Metadatos de solo lectura. No se modificó ningún objeto.

## Resumen

| Objeto | Cantidad |
|---|---:|
| Tablas InnoDB | 15 |
| Vistas | 10 |
| Procedimientos | 1 |
| Funciones almacenadas | 0 |
| Triggers | 3 |
| Eventos | 0 |
| Claves foráneas | 20 |
| Restricciones `CHECK` | 6 |
| Definiciones de índices (incluye PK; por tabla e índice) | 40 |
| Entradas de columna en `information_schema.STATISTICS` | 51 |

## Índices

`U` = único; `N` = no único. La PK se indica aparte. Los índices fueron leídos de `information_schema.STATISTICS`.

| Tabla | Índices |
|---|---|
| `administrativo` | PK (`id_persona`) |
| `cmj_consejero` | PK (`id_persona`) |
| `cronograma` | PK (`id_cronograma`); N `fk_crono_disc_ent` (`id_disciplina`,`id_entrenador`); N `fk_crono_disc_esc` (`id_disciplina`,`id_escenario`); N `ix_crono_entrenador` (`id_entrenador`,`dia_semana`); N `ix_crono_escenario` (`id_escenario`,`dia_semana`) |
| `deportista` | PK (`id_persona`) |
| `disciplina` | PK (`id_disciplina`); U `nombre` (`nombre`); N `ix_disciplina_categoria` (`categoria`,`estado`) |
| `disciplina_entrenador` | PK compuesta (`id_disciplina`,`id_entrenador`); N `id_entrenador` (`id_entrenador`) |
| `disciplina_escenario` | PK compuesta (`id_disciplina`,`id_escenario`); N `id_escenario` (`id_escenario`) |
| `entrenador` | PK (`id_persona`) |
| `escenario` | PK (`id_escenario`); U `nombre` (`nombre`); N `ix_escenario_semaforo` (`estado_semaforo`) |
| `historial_estado_escenario` | PK (`id_historial`); N `id_cmj` (`id_cmj`); N `id_reporte` (`id_reporte`); N `ix_historial_escenario` (`id_escenario`,`fecha_cambio`) |
| `inscripcion` | PK (`id_inscripcion`); U `ux_inscripcion_activa` (`id_deportista`,`disciplina_activa`); N `ix_inscripcion_disciplina` (`id_disciplina`,`estado`) |
| `persona` | PK (`id_persona`); U `numero_identificacion`; N `ix_persona_nombre` (`nombre_completo`) |
| `reporte_veeduria` | PK (`id_reporte`); N `id_cmj_valida`; N `id_reportante`; N `ix_reporte_escenario` (`id_escenario`,`fecha_reporte`); N `ix_reporte_estado` (`estado_reporte`) |
| `rol` | PK (`id_rol`); U `nombre` |
| `usuario` | PK (`id_usuario`); U `id_persona`; U `login`; N `id_rol` |

Las claves foráneas y sus acciones están enumeradas en [Relaciones de la base de datos](./RELACIONES-BASE-DATOS.md). `inscripcion.disciplina_activa` es una columna generada que permite conservar varias filas históricas no activas, manteniendo única la pareja activa.

No se declara un índice faltante como defecto confirmado sin una consulta objetivo y medición. La comprobación de `EXPLAIN` y cargas representativas queda para la fase de pruebas; los índices de búsqueda por columnas de relación/estado existen en la mayoría de los recorridos observados.

## Restricciones `CHECK`

Las seis restricciones están activas en MySQL 8.0.45:

| Tabla | Restricción | Regla |
|---|---|---|
| `cronograma` | `ck_crono_horas` | `hora_fin > hora_inicio` |
| `cronograma` | `ck_crono_vigencia` | `vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde` |
| `disciplina` | `ck_disc_cupo` | `cupo_maximo > 0` |
| `escenario` | `ck_esc_aforo` | `capacidad_aforo IS NULL OR capacidad_aforo > 0` |
| `persona` | `ck_persona_correo` | Expresión básica de formato por `LIKE`; no acredita que el correo exista |
| `reporte_veeduria` | `ck_reporte_validacion` | Pendiente exige validador/fecha nulos; validado o rechazado exige ambos no nulos |

Los valores de estados declarados como `ENUM` están limitados a sus miembros. No hay `CHECK` de rango geográfico ni de 0/1 para columnas `TINYINT(1)`.

## Vistas

Las 10 vistas usan `SQL SECURITY DEFINER`. Una vista no aplica autorización por rol del usuario final; esta debe estar garantizada por permisos SQL/API. Las columnas sensibles señaladas describen exposición potencial al consumidor autorizado de la vista, no una prueba de acceso público.

| Vista | Tablas / vistas de origen | Salida, filtros y sensibilidad |
|---|---|---|
| `v_cronograma_consolidado` | `cronograma`, `disciplina`, `escenario`, `persona` | Solo cronogramas activos; consolida disciplina, escenario y nombre del entrenador. |
| `v_disciplinas_demanda` | `disciplina`, `inscripcion` | Agrega cupos activos, inscripciones históricas y porcentaje de ocupación. |
| `v_historial_deportista` | `inscripcion`, `disciplina` | Disciplina, fecha y estado por identificador de deportista. |
| `v_historico_veedurias` | `reporte_veeduria`, `escenario`, `persona` | Reportes con nombre de reportante y validador, descripción y observación; contiene datos personales y contenido potencialmente sensible. |
| `v_persona_edad` | `persona` | Expone identificación, nombre, correo, teléfono, dirección, género y fecha de nacimiento, además de edad calculada. Alta sensibilidad. |
| `v_rep_deportistas_por_disciplina` | `inscripcion`, `disciplina`, `persona` | Solo inscripciones activas; expone nombre e identificación del deportista. |
| `v_rep_disciplinas_activas` | `disciplina`, `inscripcion` | Disciplinas activas, cupos y conteos agregados. |
| `v_rep_entrenadores` | `entrenador`, `persona`, `disciplina_entrenador`, `disciplina` | Solo entrenadores activos; expone identificación, correo y teléfono además de nombre/deportes. |
| `v_rep_escenarios_semaforo` | `escenario` | Solo escenarios activos; estado oficial, ubicación, tipo y aforo. |
| `v_reportes_pendientes` | `v_historico_veedurias` | Filtra estado `PENDIENTE`; hereda el nombre del reportante y la descripción. |

Los metadatos marcan algunas vistas como actualizables. No debe concederse acceso de escritura amplio a vistas `DEFINER`. La autorización efectiva de cada endpoint y el mínimo privilegio deben comprobarse con pruebas por rol.

## Procedimiento almacenado

### `sp_validar_inscripcion`

- Parámetros `IN`: `p_id_inscripcion INT`, `p_id_deportista INT`, `p_id_disciplina INT`, `p_estado VARCHAR(20)`.
- Si `p_estado='ACTIVA'`, obtiene el cupo de la disciplina y cuenta sus inscripciones activas, excluyendo la fila que se está actualizando.
- Si el conteo alcanza el cupo, genera `SIGNAL SQLSTATE '45000'` con `La disciplina no tiene cupos disponibles`.
- Después busca inscripciones activas del mismo deportista y compara cronogramas activos: mismo día, intersección de horas y superposición de vigencias. Si encuentra cruce, genera `SQLSTATE '45000'` con `El deportista ya tiene un entrenamiento que se cruza en horario`.
- Tablas leídas: `disciplina`, `inscripcion`, `cronograma`. La rutina no hace escrituras explícitas.
- No comprueba estado `ACTIVA` de la disciplina ni bloquea explícitamente cupo frente a concurrencia. FK, `CHECK`, índice único y errores de integridad pueden producir errores adicionales en el statement.
- `SQL SECURITY DEFINER`; no determinista; `CONTAINS SQL`.

## Triggers

| Trigger | Tabla, evento y momento | Operación y efectos |
|---|---|---|
| `trg_inscripcion_bi` | `inscripcion`, `BEFORE INSERT` | Llama `sp_validar_inscripcion(0, NEW.id_deportista, NEW.id_disciplina, NEW.estado)`. Rechaza cupo/cruce con SQLSTATE `45000`. |
| `trg_inscripcion_bu` | `inscripcion`, `BEFORE UPDATE` | Llama al procedimiento con el id anterior y los valores nuevos. Vuelve a validar cuando el estado nuevo es activo. |
| `trg_oficializar_semaforo` | `reporte_veeduria`, `AFTER UPDATE` | Si el reporte pasa de pendiente a validado, compara el estado propuesto con el oficial. Si difieren, inserta `historial_estado_escenario` y actualiza `escenario.estado_semaforo` y `fecha_ultima_actualizacion`. No llama procedimientos. Rechazo o estado sin cambio oficial no generan esa transición. Acopla validación con oficialización y contradice D1. |

Los triggers aparecen definidos por `root@localhost`; al migrar a otro entorno, el definer y los privilegios requeridos deben revisarse. No se alteró ninguno.

## Eventos y funciones

No se encontraron eventos ni funciones almacenadas en el esquema.
