# Relaciones de la base de datos

Modelo observado mediante claves foráneas de `deportes` en MySQL 8.0.45. Se documentan solo relaciones declaradas; no se deducen vínculos por nombres de columnas.

## Personas, cuentas y perfiles

- `usuario.id_persona → persona.id_persona`: cada cuenta está asociada a una persona; la columna es única, así que una persona tiene como máximo una cuenta.
- `usuario.id_rol → rol.id_rol`: una cuenta referencia un rol del catálogo.
- `deportista.id_persona`, `entrenador.id_persona`, `administrativo.id_persona` y `cmj_consejero.id_persona → persona.id_persona`: cada tabla especializada tiene una fila vinculada a una persona.
- No existe FK que exija coherencia entre `usuario.id_rol` y la fila correspondiente en la tabla de perfil especializado. La aplicación puede imponerla; la base no.
- CMJ tiene una relación explícita con `historial_estado_escenario` mediante `id_cmj`. No se encontró una FK de CMJ que lo conecte directamente a `usuario`.

## Oferta, entrenadores y escenarios

- `disciplina_entrenador.id_disciplina → disciplina.id_disciplina`.
- `disciplina_entrenador.id_entrenador → entrenador.id_persona`.
- `disciplina_escenario.id_disciplina → disciplina.id_disciplina`.
- `disciplina_escenario.id_escenario → escenario.id_escenario`.
- Las dos tablas puente tienen PK compuesta por los dos identificadores, por lo que no admiten repetición de la misma pareja.
- `cronograma(id_disciplina,id_entrenador) → disciplina_entrenador(id_disciplina,id_entrenador)` y `cronograma(id_disciplina,id_escenario) → disciplina_escenario(id_disciplina,id_escenario)`. Son FKs compuestas: aseguran que el entrenador y escenario estén asociados a esa disciplina.
- `cronograma` no tiene FKs independientes a `entrenador` o `escenario`; sus dos referencias compuestas son las relaciones efectivas.

## Inscripciones

- `inscripcion.id_deportista → deportista.id_persona`.
- `inscripcion.id_disciplina → disciplina.id_disciplina`.
- El índice único sobre `(id_deportista, disciplina_activa)` evita duplicar una inscripción activa por disciplina/deportista; `disciplina_activa` es generada y queda `NULL` al cancelar/finalizar.
- No existe una relación directa entre inscripción y horario concreto. La validación de cupo/cruces se hace en procedimiento y triggers, no mediante una FK.

## Reportes e historial de veeduría

- `reporte_veeduria.id_escenario → escenario.id_escenario`.
- `reporte_veeduria.id_reportante → persona.id_persona` (obligatoria).
- `reporte_veeduria.id_cmj_valida → cmj_consejero.id_persona` (nullable mientras está pendiente).
- `historial_estado_escenario.id_escenario → escenario.id_escenario`.
- `historial_estado_escenario.id_reporte → reporte_veeduria.id_reporte` (nullable).
- `historial_estado_escenario.id_cmj → cmj_consejero.id_persona`.
- No hay relación de reporte a cuenta. No hay snapshot de reportante ni código de seguimiento en el esquema actual.

## Inventario completo de claves foráneas

Las 20 FKs tienen acción `ON UPDATE NO ACTION` y `ON DELETE NO ACTION`; no hay borrado en cascada.

| Tabla / columna(s) | Referencia |
|---|---|
| `administrativo.id_persona` | `persona.id_persona` |
| `cmj_consejero.id_persona` | `persona.id_persona` |
| `deportista.id_persona` | `persona.id_persona` |
| `entrenador.id_persona` | `persona.id_persona` |
| `usuario.id_persona` | `persona.id_persona` |
| `usuario.id_rol` | `rol.id_rol` |
| `disciplina_entrenador.id_disciplina` | `disciplina.id_disciplina` |
| `disciplina_entrenador.id_entrenador` | `entrenador.id_persona` |
| `disciplina_escenario.id_disciplina` | `disciplina.id_disciplina` |
| `disciplina_escenario.id_escenario` | `escenario.id_escenario` |
| `cronograma(id_disciplina,id_entrenador)` | `disciplina_entrenador(id_disciplina,id_entrenador)` |
| `cronograma(id_disciplina,id_escenario)` | `disciplina_escenario(id_disciplina,id_escenario)` |
| `inscripcion.id_deportista` | `deportista.id_persona` |
| `inscripcion.id_disciplina` | `disciplina.id_disciplina` |
| `reporte_veeduria.id_escenario` | `escenario.id_escenario` |
| `reporte_veeduria.id_reportante` | `persona.id_persona` |
| `reporte_veeduria.id_cmj_valida` | `cmj_consejero.id_persona` |
| `historial_estado_escenario.id_escenario` | `escenario.id_escenario` |
| `historial_estado_escenario.id_reporte` | `reporte_veeduria.id_reporte` |
| `historial_estado_escenario.id_cmj` | `cmj_consejero.id_persona` |

Las consultas de solo lectura no encontraron filas huérfanas en estas relaciones al momento de la auditoría. La descripción de columnas, claves primarias y restricciones `CHECK` está en [Auditoría MySQL](./AUDITORIA-MYSQL.md).
