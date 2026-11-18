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

## PWA y despliegue en Railway

La compilación genera el manifiesto, los iconos y el *service worker* de SIVEC. En un sitio HTTPS, el navegador puede instalarlo como aplicación. Tras una primera visita en línea, puedes abrir la interfaz sin conexión. El *service worker* también guarda hasta 60 consultas públicas recientes de disciplinas, escenarios y cronogramas durante un máximo de siete días. Se intenta obtener la versión de la red primero. Cada filtro solo está disponible sin conexión si se consultó antes.

El deportista puede leer su último historial visto durante la misma sesión del navegador. Se guarda por cuenta en `sessionStorage` y se borra al cerrar sesión o al iniciar otra. Las evidencias, el seguimiento de reportes y los datos privados del CMJ están fuera de la caché. Se necesita conexión para autenticarse, consultar información que no esté guardada, inscribirse, reportar u oficializar cambios.

1. En Railway, crea un proyecto con un servicio MySQL 8 y otro para la aplicación. Conecta el servicio de la aplicación al repositorio y selecciona la rama de entrega. El `Dockerfile` raíz compila el frontend y lo sirve desde Express en el mismo dominio que `/api`. Railway puede verificar el proceso en `/api/health`.
2. En el servicio de aplicación, configura `DB_HOST` con el host privado de MySQL, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y un `JWT_SECRET` generado para ese entorno. Configura las credenciales en Railway. Usa una copia de demostración aislada y un usuario de aplicación con los permisos necesarios sobre ese esquema.
3. Restaura un respaldo base autorizado con datos ficticios. Desde un proceso con acceso al MySQL privado, verifica o aplica las migraciones de la copia siguiendo la [guía](BACKEND/migrations/README.md). Usa una cuenta de migración separada si la cuenta de aplicación carece de permisos DDL.
4. Monta un volumen persistente para las evidencias en `/app/data`. Verifica que el usuario del contenedor pueda escribir en el volumen. El Dockerfile usa el usuario `node` (UID 1000) y define `VEEDURIA_STORAGE_DIR=/app/data`.
5. Genera un dominio HTTPS para la aplicación. Abre Inicio y una ruta directa, como `/seguimiento`. Instala SIVEC desde el menú del navegador, comprueba que abra sin conexión después de la primera carga y vuelve a conectar para ejecutar los recorridos de entrega. Reinicia el servicio y comprueba que las fotos ya guardadas sigan disponibles.
