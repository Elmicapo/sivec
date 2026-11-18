# SIVEC

Sistema de Información, Veeduría y Espacios para el Deporte y la Cultura de Apartadó. Proyecto académico con React, Express y MySQL.

## Preparar la demostración

Usa Node.js 24 y MySQL 8. Restaura un respaldo autorizado del esquema base en un esquema aislado, como `sivec_isolated_demo`. Para compartir la demostración, usa datos ficticios. El repositorio requiere el esquema base y las migraciones amplían ese esquema. El respaldo y las imágenes de veeduría se mantienen fuera de Git.

1. Copia `BACKEND/.env.example` a `BACKEND/.env` y configura el esquema restaurado, el usuario de MySQL y su contraseña. Configura `VEEDURIA_STORAGE_DIR` con una ruta privada y persistente fuera del repositorio.
2. Genera una clave JWT local con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guárdala como `JWT_SECRET` en `BACKEND/.env`.
3. Desde `BACKEND`, instala dependencias y consulta las migraciones de la copia. Si el respaldo es el esquema base sin migraciones, aplica las migraciones con el último comando. Para una copia ya migrada, verifica su estado y sigue la [guía de migraciones](BACKEND/migrations/README.md).

   ```sh
   npm ci
   node scripts/migrate.js --database=sivec_isolated_demo --status
   node scripts/migrate.js --database=sivec_isolated_demo
   ```

4. Desde `BACKEND`, ejecuta `npm test` y `npm run dev`. En otra terminal, desde `frontend`, ejecuta `npm ci` y `npm run dev`. Abre la URL que imprime Vite.
5. Si la API se ejecuta en otro host o puerto, copia `frontend/.env.example` a `frontend/.env.local` y ajusta `VITE_API_URL`, incluida la ruta `/api`.

La base original `deportes` tiene su propio procedimiento de migración, descrito en la guía. Usa la copia aislada para la demostración.

## Recorridos de entrega

- **Deportista:** inscríbete en una disciplina y verifica que aparezca en el historial.
- **Entrenador y administración:** envía una solicitud de vinculación, apruébala, registra un horario con una disciplina y un escenario asociados, y comprueba que aparezca en la agenda.
- **Administración:** crea, edita y da de baja una disciplina de prueba. Recarga la pantalla después de cada acción para comprobar la persistencia.
- **Ciudadano y CMJ:** envía una veeduría con una fotografía, guarda el código, valida el reporte en CMJ, oficializa el semáforo y consulta el resultado en Seguimiento. Envía una propuesta de escenario y comprueba que su aprobación la añade al catálogo.

Usa cuentas de demostración distintas para cada rol y un perfil CMJ en el esquema aislado. Conserva las claves de esas cuentas fuera del repositorio.

Desde `frontend`, `npm run build` verifica la compilación y `npm run lint` revisa el código. Las pruebas de integración con MySQL requieren la copia aislada documentada en [Migraciones](BACKEND/migrations/README.md).

[Documentación del proyecto](docs/README.md)
