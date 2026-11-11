# Documentación de SIVEC

## Identidad institucional

**Nombre oficial:** SIVEC — Sistema de Información, Veeduría y Espacios para el Deporte y la Cultura.

**Eslogan:** Conectamos el deporte, la cultura y la ciudadanía.

**Ubicación:** Apartadó, Antioquia, Colombia.

SIVEC es una plataforma académica orientada a centralizar la información de la oferta deportiva y cultural de Apartadó, facilitar la consulta de disciplinas, entrenadores, escenarios y horarios, y promover la participación ciudadana mediante mecanismos de veeduría sobre el estado de los escenarios.

Este proyecto es académico y no representa un portal oficial de la Alcaldía de Apartadó ni del CMJ.

## Fuentes de referencia

- [Requerimientos del programa](./requisitos/REQUERIMIENTOS%20DEL%20PROGRAMA.docx): necesidades expresadas por el cliente.
- [Fase 1: Arquitectura y planificación](./arquitectura/SIVEC%20%E2%80%94%20Fase%201%20Arquitectura%20y%20planificaci%C3%B3n.pdf): diagnóstico, propuesta y plan de fases.
- [Fase 2 — Bloque 1: recuperación y contraste documental](./FASE-2-BLOQUE-1-CONTRASTE.md): decisiones aprobadas, hallazgos B y DB, diferencias, pendientes y planificación actualizada.
- [Auditoría MySQL](./AUDITORIA-MYSQL.md): conexión, esquema, integridad, reglas verificadas y respaldo del Bloque 2.
- [Relaciones de la base de datos](./RELACIONES-BASE-DATOS.md): FKs y relaciones comprobadas en el esquema real.
- [Inventario de objetos MySQL](./INVENTARIO-OBJETOS-MYSQL.md): índices, restricciones, vistas, procedimiento y triggers.
- [Plan de migraciones MySQL](./PLAN-MIGRACIONES-MYSQL.md): orden propuesto, dependencias, preservación de datos y pruebas; no ejecutado.
- [Catálogo territorial de Apartadó](./CATALOGO-TERRITORIAL-APARTADO.md): jerarquía urbana/rural para Reportar, procedencia del catálogo y limitación de consulta de disciplinas.
- [Plan de integración de Reportar con D1](./PLAN-INTEGRACION-REPORTAR-D1.md): flujo ciudadano, evidencias, escenarios nuevos y separación D1.
- [Plan maestro de Fase 4 — Reportar](./FASE-4-PLAN-REPORTAR.md): alcance consolidado, arquitectura, flujos, cambios previstos, pruebas, dependencias, aprobaciones y orden propuesto de trabajo.
- [Verificación de restauración MySQL](./VERIFICACION-RESTAURACION-MYSQL.md): prueba del respaldo en un esquema aislado, comprobaciones y limitaciones.
- [Prueba de restauración aislada de MySQL](./PRUEBA-RESTAURACION-MYSQL.md): repetición de la restauración, comparación detallada de objetos, datos e integridad y esquema temporal conservado.

## Convenciones

- **D1–D10** identifica decisiones de producto aprobadas por el usuario; no son hallazgos de base de datos.
- **B1–B12** conserva los códigos de hallazgos de seguridad del apartado 17 de Fase 1.
- **DB-01–DB-12** identifica hallazgos técnicos de base de datos. Estos códigos sustituyen la etiqueta ambigua `D1–D12` que Fase 1 también utilizó para hallazgos de base de datos; no representan una equivalencia numérica con esa serie.
- Un hallazgo solo se marca como resuelto después de implementar su solución y verificar su criterio de aceptación. La documentación de este bloque no resuelve hallazgos técnicos.

Los documentos originales se conservan. La carpeta `docs/arquictectura` se renombró a `docs/arquitectura` para corregir su nombre; el PDF no fue editado ni duplicado.
