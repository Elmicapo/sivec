# Auditoría técnica de MySQL

**Alcance:** inspección de solo lectura de la instancia local y contraste con los requerimientos y las decisiones D1–D10. El respaldo se generó aparte; no se ejecutaron escrituras, DDL, migraciones ni restauraciones en la base original.

## 1. Instancia y conexión

- Base de datos comprobada: `deportes`.
- Servidor: MySQL `8.0.45`, puerto `3306`; `CURRENT_USER()` es `root@localhost`.
- Motor de las 15 tablas: InnoDB. Juego de caracteres/collation de la base: `utf8mb4` / `utf8mb4_0900_ai_ci`; `foreign_key_checks=1`.
- `sql_mode`: `IGNORE_SPACE`, `ONLY_FULL_GROUP_BY`, `STRICT_TRANS_TABLES`, `NO_ZERO_IN_DATE`, `NO_ZERO_DATE`, `ERROR_FOR_DIVISION_BY_ZERO`, `NO_ENGINE_SUBSTITUTION`.
- El backend conecta mediante `mysql2/promise`; host, usuario, base y puerto se leen de `.env`. En esta instancia resuelven a `localhost`, `root`, `deportes` y `3306`. El código tiene valores de reserva; la contraseña no se reproduce aquí.
- Pool: `waitForConnections`, `connectionLimit: 10`, `queueLimit: 0`, `dateStrings: true`, `charset: utf8mb4`.
- Riesgo confirmado: la cuenta de aplicación `root@localhost` dispone de privilegios globales, incluida capacidad de modificar/eliminar objetos y otorgar privilegios. No es una cuenta de mínimo privilegio y no debe reutilizarse en producción.
- `mysqldump` no está disponible en el entorno. Se utilizó MySQL Shell 8.0 con `util.dumpSchemas`, contraseña por stdin, consistencia habilitada, y exportación de rutinas, triggers y eventos. El detalle y la verificación están en §5.

## 2. Inventario de tablas y columnas

Las abreviaturas `?` indican columna nullable; `AI` indica autoincremento; `STORED` indica columna generada almacenada. Si no se indica un default, no hay default explícito. Todas las tablas son InnoDB.

| Tabla | Propósito observado | Columnas |
|---|---|---|
| `administrativo` | Perfil especializado de persona administrativa. | `id_persona INT NOT NULL`; `cargo VARCHAR(80) NOT NULL` |
| `cmj_consejero` | Perfil especializado de persona consejera del CMJ. | `id_persona INT NOT NULL`; `cargo_cmj VARCHAR(80) NOT NULL` |
| `cronograma` | Horarios, vigencia y asignación de disciplina, escenario y entrenador. | `id_cronograma INT NOT NULL AI`; `id_disciplina INT NOT NULL`; `id_escenario INT NOT NULL`; `id_entrenador INT NOT NULL`; `dia_semana ENUM(LUNES,MARTES,MIERCOLES,JUEVES,VIERNES,SABADO,DOMINGO) NOT NULL`; `hora_inicio TIME NOT NULL`; `hora_fin TIME NOT NULL`; `vigencia_desde DATE NOT NULL`; `vigencia_hasta DATE ?`; `activo TINYINT(1) NOT NULL DEFAULT 1` |
| `deportista` | Perfil deportivo de una persona. | `id_persona INT NOT NULL`; `activo TINYINT(1) NOT NULL DEFAULT 1` |
| `disciplina` | Oferta deportiva/cultural y cupo. | `id_disciplina INT NOT NULL AI`; `nombre VARCHAR(100) NOT NULL`; `categoria ENUM(DEPORTIVA,CULTURAL) NOT NULL`; `poblacion_objetivo VARCHAR(100) ?`; `estado ENUM(ACTIVA,INACTIVA) NOT NULL DEFAULT ACTIVA`; `cupo_maximo INT NOT NULL` |
| `disciplina_entrenador` | Asociación entre disciplina y entrenador. | `id_disciplina INT NOT NULL`; `id_entrenador INT NOT NULL` |
| `disciplina_escenario` | Asociación entre disciplina y escenario. | `id_disciplina INT NOT NULL`; `id_escenario INT NOT NULL` |
| `entrenador` | Perfil especializado de una persona entrenadora. | `id_persona INT NOT NULL`; `activo TINYINT(1) NOT NULL DEFAULT 1` |
| `escenario` | Escenario, ubicación, aforo y semáforo oficial. | `id_escenario INT NOT NULL AI`; `nombre VARCHAR(120) NOT NULL`; `ubicacion VARCHAR(200) NOT NULL`; `latitud DECIMAL(9,6) ?`; `longitud DECIMAL(9,6) ?`; `tipo VARCHAR(60) NOT NULL`; `capacidad_aforo INT ?`; `estado_semaforo ENUM(VERDE,AMARILLO,ROJO) NOT NULL DEFAULT VERDE`; `fecha_ultima_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`; `activo TINYINT(1) NOT NULL DEFAULT 1` |
| `historial_estado_escenario` | Cambios oficiales de estado con referencias a escenario, reporte y consejero. | `id_historial INT NOT NULL AI`; `id_escenario INT NOT NULL`; `estado_anterior ENUM(VERDE,AMARILLO,ROJO) NOT NULL`; `estado_nuevo ENUM(VERDE,AMARILLO,ROJO) NOT NULL`; `id_reporte INT ?`; `id_cmj INT NOT NULL`; `fecha_cambio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `inscripcion` | Inscripción e historial de deportista en disciplina. | `id_inscripcion INT NOT NULL AI`; `id_deportista INT NOT NULL`; `id_disciplina INT NOT NULL`; `fecha_inscripcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`; `estado ENUM(ACTIVA,CANCELADA,FINALIZADA) NOT NULL DEFAULT ACTIVA`; `disciplina_activa INT ? GENERATED STORED` (igual a `id_disciplina` cuando `estado='ACTIVA'`, en otro caso `NULL`) |
| `persona` | Datos personales compartidos por perfiles y cuentas. | `id_persona INT NOT NULL AI`; `nombre_completo VARCHAR(150) NOT NULL`; `numero_identificacion VARCHAR(20) NOT NULL`; `correo_electronico VARCHAR(120) NOT NULL`; `telefono VARCHAR(20) ?`; `direccion_residencia VARCHAR(200) ?`; `genero ENUM(F,M,OTRO) ?`; `fecha_nacimiento DATE ?`; `fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `reporte_veeduria` | Reporte ciudadano, propuesto, estado de validación y observación. | `id_reporte INT NOT NULL AI`; `id_escenario INT NOT NULL`; `id_reportante INT NOT NULL`; `estado_propuesto ENUM(VERDE,AMARILLO,ROJO) NOT NULL`; `descripcion TEXT NOT NULL`; `evidencia_url VARCHAR(300) ?`; `fecha_reporte DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`; `estado_reporte ENUM(PENDIENTE,VALIDADO,RECHAZADO) NOT NULL DEFAULT PENDIENTE`; `id_cmj_valida INT ?`; `fecha_validacion DATETIME ?`; `observacion_cmj TEXT ?` |
| `rol` | Catálogo de roles de cuentas. | `id_rol SMALLINT NOT NULL`; `nombre VARCHAR(20) NOT NULL` |
| `usuario` | Cuenta de acceso asociada a persona y rol. | `id_usuario INT NOT NULL AI`; `id_persona INT NOT NULL`; `id_rol SMALLINT NOT NULL`; `login VARCHAR(50) NOT NULL`; `password_hash VARCHAR(255) NOT NULL`; `activo TINYINT(1) NOT NULL DEFAULT 1`; `ultimo_acceso DATETIME ?` |

Las claves, restricciones e índices se detallan en [Relaciones de la base de datos](./RELACIONES-BASE-DATOS.md) y [Inventario de objetos MySQL](./INVENTARIO-OBJETOS-MYSQL.md). No se asumieron relaciones que no estén declaradas en MySQL.

## 3. Hallazgos de integridad, privacidad y reglas

### Comprobaciones de datos (solo agregados)

Las consultas fueron de solo lectura y no mostraron datos personales. En el conjunto de prueba inspeccionado:

- 0 huérfanos en las columnas que tienen clave foránea.
- 0 grupos con inscripciones activas duplicadas por deportista/disciplina; 0 disciplinas sobre su cupo; 0 inscripciones activas en disciplinas inactivas.
- 0 reportes con estado inconsistente con `id_cmj_valida`/`fecha_validacion`; 0 valores actuales de latitud/longitud fuera de rango; 0 banderas `activo` distintas de 0/1.
- 0 identificadores de correo duplicados en la muestra; la columna no tiene índice único, por lo que la estructura no impide duplicados futuros.
- **1 par de cronogramas activos** se solapa en día, horas y vigencia para entrenador y escenario compartidos. Es una anomalía confirmada en los datos de prueba; su causa requiere inspección funcional. La base no tiene una restricción que impida ese solapamiento.

Los conteos de filas del respaldo sumaron 45 en las 15 tablas. Son datos de prueba y no una estimación de producción.

### D1 — reporte y semáforo

`trg_oficializar_semaforo` es un `AFTER UPDATE` de `reporte_veeduria`. Cuando el reporte cambia de `PENDIENTE` a `VALIDADO`, lee el estado oficial; si difiere del propuesto, inserta historial y actualiza `escenario.estado_semaforo` y su fecha. Si coincide, no inserta historial. Un rechazo no oficializa el estado. Esto mezcla validación y oficialización y **no cumple D1**. La ruta backend de validación cambia el estado del reporte; no se encontró otra ruta backend directa que actualice `escenario.estado_semaforo`. La cuenta SQL actual, por sus privilegios, sí permite una ruta directa fuera de la aplicación.

### D2 — vinculación de entrenadores

Al crear o actualizar un cronograma, el backend inserta con `INSERT IGNORE` las asociaciones disciplina–entrenador y disciplina–escenario antes de guardar el horario. No hay entidad o estado de solicitud/aprobación en el esquema observado. Esto automatiza la vinculación y no cumple D2.

### Inscripciones

- El procedimiento `sp_validar_inscripcion`, invocado por dos triggers, verifica cupo y cruce de horario/vigencia al crear o actualizar inscripciones activas.
- `ux_inscripcion_activa` impide más de una inscripción activa de la misma persona en la misma disciplina, y conserva registros históricos al cancelar/finalizar.
- La validación de cupo cuenta filas sin bloqueo explícito de la disciplina; solicitudes concurrentes podrían superar el cupo. No se ejecutó una prueba concurrente.
- El procedimiento no verifica que la disciplina siga `ACTIVA`. El backend puede filtrar la oferta, pero una escritura directa con una disciplina inactiva no queda bloqueada por ese procedimiento ni por una restricción de estado.
- El procedimiento tampoco reemplaza la comprobación de solapamiento de cronogramas al crear/editar horarios; se encontró un par solapado en la muestra.

### Reportes ciudadanos y D6

`id_reportante` es obligatorio y referencia `persona`; no hay `id_usuario` opcional, snapshot separado, código de seguimiento ni estado/campo que diferencie explícitamente reportes autenticados de anónimos. El backend usa `req.usuario.id_persona` cuando hay sesión; para una solicitud anónima pide nombre, identificación y correo, busca la persona por identificación y reutiliza su fila si ya existe, o crea una persona si no existe. Por tanto, un envío sin cuenta puede quedar asociado a una persona existente en vez de conservar una copia independiente. Esto no cumple D6. `evidencia_url` es solo un campo opcional de URL de hasta 300 caracteres; no implementa carga ni resuelve los límites requeridos por D10.

La tabla contempla `PENDIENTE`, `VALIDADO` y `RECHAZADO`; el historial de semáforo solo registra una transición oficial cuando el trigger cambia efectivamente el estado. No se encontró una bitácora general de cada rechazo/cambio del reporte.

### Riesgos de seguridad confirmados y potenciales

- **Confirmado:** cuenta SQL de aplicación con privilegios globales de administrador, incluidas operaciones DDL, borrado y gestión de usuarios.
- **Confirmado:** varias vistas devuelven datos personales; la seguridad por rol debe garantizarse en el API/permisos SQL. Ver el inventario de vistas.
- **Riesgo potencial:** el tipo `TINYINT(1)` no restringe por sí solo `activo` a 0/1; los valores actuales son válidos, pero no hay `CHECK` que lo garantice.
- **Riesgo potencial:** `latitud` y `longitud` no tienen `CHECK` de rangos geográficos; la muestra no contiene valores fuera de rango.
- **Riesgo potencial:** cuota de inscripciones ante concurrencia, ausencia de solicitud/aprobación de entrenador y edición directa de vistas `SQL SECURITY DEFINER`. Requiere pruebas y revisión de privilegios por endpoint.
- El check del correo es de formato básico (`LIKE`), no de verificación de dirección; su calidad y unicidad no se pueden inferir de esa expresión.

## 4. Contraste con decisiones y documentación

- MySQL 8 se mantiene como motor obligatorio.
- La base auditada carece de migraciones versionadas/ejecutor propio identificados; D7 y DB-01 siguen pendientes.
- El esquema actual no se considera inmutable. Cualquier reorganización futura requiere migración documentada y respaldo verificado.
- D1, D2, D6 y D10 tienen brechas descritas arriba; ninguna está resuelta por este informe.
- Las decisiones D1–D10 se separan de los hallazgos DB-01–DB-12. Una referencia de la sección de vinculación en el documento del Bloque 1 fue corregida para no confundir DB-07 (snapshot/seguimiento) con D2/B7.
- Véase [Plan de migraciones MySQL](./PLAN-MIGRACIONES-MYSQL.md). No se ejecutó ninguna migración.

## 5. Respaldo

- Herramienta: MySQL Shell `8.0.45`, formato dump de directorio con compresión Zstandard; se usó `util.dumpSchemas` con consistencia habilitada, rutinas y triggers incluidos.
- Destino fuera del repositorio: `C:\Users\DELL LATITUDE 5500\SIVEC_BACKUPS\SIVEC-deportes-20261104T005121Z`.
- Antes de exportar se confirmó la conexión con `deportes`/MySQL 8.0.45, que el destino con marca temporal no existía y que había aproximadamente 683.6 GB libres en la unidad.
- MySQL Shell reportó 15 tablas y 45 filas. El directorio contiene 88 archivos no vacíos (68,919 bytes), 15 bloques de datos comprimidos, DDL de tablas y 10 vistas, 1 procedimiento y 3 triggers. No se encontró evento definido en la instancia.
- El manifiesto `@.json` y marcador `@.done.json` existen; el manifiesto se leyó y su SHA-256 es `BA60B81684B2B3F56A8C9B72E0FEA066963A66AC48B29D97709373BD267A832A`. La huella del inventario ordenado `ruta relativa|SHA-256 de cada archivo` es `DCDA6466E66EBA27AF71D1C73A36DB84EC7DED2311DCD71E2089E1C2B29E23D9`.
- La ruta tiene ACL local limitada al propietario, SYSTEM y Administradores. La exportación y sus archivos SQL/manifiestos no están vacíos. No se realizó restauración: la recuperabilidad efectiva sigue pendiente de una prueba en una instancia aislada.

## 6. Límites y estado

Inspección de metadatos `information_schema`, comprobaciones agregadas `SELECT`, lectura de configuración sin imprimir secretos y comprobación del dump. No se ejecutó `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, DDL ni migración contra `deportes`; tampoco se modificó ninguna tabla, vista, rutina o trigger. Ningún hallazgo se marca como resuelto.
