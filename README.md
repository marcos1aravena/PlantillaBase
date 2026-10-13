# Base App

Plantilla de aplicación con Next.js, Express, PostgreSQL, Prisma y TypeScript. El frontend y la API viven en un monorepo npm y pueden ejecutarse juntos.

## Requisitos

- Node.js 22 o superior y npm.
- Docker y Docker Compose para ejecutar la aplicación completa.

## Ejecución con Docker

1. Copia `.env.example` a `.env` y cambia las contraseñas y el secreto JWT por valores únicos.
2. Ejecuta `docker compose up --build -d`.
3. En la primera instalación, ejecuta `docker compose run --build --rm seed` para crear el superadministrador.
4. Abre <http://localhost:3000> e inicia sesión con `SEED_SUPERADMIN_EMAIL` y `SEED_SUPERADMIN_PASSWORD`.

Compose inicia PostgreSQL, ejecuta el servicio auxiliar `migrate` y después levanta API y frontend. El seed es manual (perfil `setup`), no se ejecuta con cada arranque. Es idempotente y no cambia contraseñas de usuarios existentes. Las credenciales del seed solo se pasan a ese servicio; se pueden retirar de `.env` después de inicializar la cuenta. Los datos de PostgreSQL persisten en el volumen `postgres_data`.

Las imágenes se construyen por etapas con `npm ci` y `package-lock.json`. La API y el frontend se ejecutan como el usuario `node`, no como root. La imagen API de ejecución no incluye las herramientas de compilación/migración; estas viven en la etapa `tools`. Next.js usa una imagen de ejecución `standalone`.

### Comprobaciones de salud

- API liveness: `GET /api/health` comprueba que el proceso responde.
- API readiness: `GET /api/health/ready` comprueba PostgreSQL con `SELECT 1`; devuelve `503` si no está disponible.
- Frontend: `GET /api/health` en el puerto 3000 comprueba que Next.js responde, sin autenticación.

Docker comprueba readiness de API y salud de frontend cada 15 segundos. La web espera que la API esté saludable al arrancar. Consulta el estado con `docker compose ps`; que `migrate` termine con código 0 es normal. Un estado `unhealthy` no provoca por sí mismo un reinicio automático en Compose.

## Desarrollo local

1. Copia `.env.example` a `.env` y configura `DATABASE_URL` para tu PostgreSQL local.
2. Ejecuta `npm ci` (usa `npm install` al añadir o actualizar dependencias y versiona el lockfile actualizado).
3. Ejecuta `npm run db:migrate` y `npm run db:seed`.
4. Ejecuta `npm run dev` para iniciar API y frontend en paralelo.

Frontend: <http://localhost:3000> · API: <http://localhost:4000/api/health>

## Organización del código

- `packages/contracts`: workspace `@base/contracts`, con los tipos compartidos de usuarios, roles, entradas y respuestas HTTP. No contiene secretos ni depende de Prisma. Ambos proyectos usan estos contratos; el backend valida entradas en runtime mediante Zod.
- `apps/api/src/app.ts`: configuración Express y montaje de rutas. `server.ts` solo inicia el servidor.
- `apps/api/src/routes`: capa HTTP de autenticación y usuarios.
- `apps/api/src/services`: lógica de negocio y acceso a datos. `middleware/auth.ts`, `permissions.ts`, `validation.ts` y `errors.ts` concentran autenticación, permisos, validación y manejo de errores respectivamente.
- `apps/web/app/home/layout.tsx`: layout autenticado persistente con sidebar. Home, perfil y usuarios son páginas independientes que comparten el estado mediante `components/auth.tsx`.
- `apps/web/app/api.ts`: cliente HTTP tipado, cookies y CSRF. Convierte fallos en `ApiError` con estado HTTP y espera opcional. Un `401` en una llamada protegida redirige al login; en login permanece como error de credenciales. Un `403` muestra falta de permisos sin cerrar sesión. Los errores de conexión no se confunden con sesiones expiradas, y la carga inicial ofrece reintento.

Al ampliar la API, actualiza los contratos, la validación y los consumidores juntos. Las respuestas públicas no deben incluir hashes ni versiones de sesión.

## Roles y seguridad

- **Superadministrador:** gestiona todas las cuentas y puede asignar cualquier rol.
- **Administrador:** puede ver las cuentas de administradores, pero no modificarlas; gestiona usuarios normales.
- **Usuario:** accede al home.

El acceso a endpoints se valida en el backend, no solo en la interfaz. Las contraseñas se almacenan con bcrypt. El JWT se guarda en una cookie `HttpOnly`, `SameSite=Strict` y con expiración de ocho horas. En producción, configura `COOKIE_SECURE=true` y sirve la aplicación por HTTPS. El seed no sobrescribe un usuario que ya exista con ese correo.

Las eliminaciones son permanentes; para conservar historial, utiliza la acción de desactivación.

La gestión incluye un formulario de edición de nombre, correo, rol y contraseña opcional (vacía conserva la actual). Los administradores solo pueden editar usuarios normales; las cuentas de administrador y superadministrador son de solo consulta para ellos. El perfil personal sigue restringiendo correo y rol para todos.

`JWT_EXPIRES_IN` configura la duración del JWT y de la cookie conjuntamente. Acepta enteros positivos con unidad `s`, `m` o `h` (por ejemplo `30m`, `2h` o `8h`); el valor predeterminado es `8h` y el máximo permitido es ocho horas. Un valor inválido impide arrancar la API. Los cambios se aplican a las sesiones nuevas, no a tokens ya emitidos.

### Sesiones y protección de solicitudes

- Cada usuario tiene una `sessionVersion`. Cambiar su contraseña desde el perfil o desde administración incrementa la versión e invalida todos sus JWT anteriores. El perfil ofrece **Cerrar todas mis sesiones**, incluida la actual. Los JWT previos a esta migración también quedan invalidados: será necesario iniciar sesión nuevamente.
- Login y verificación de contraseña actual tienen contadores independientes por IP y cuenta, persistidos en PostgreSQL. Por defecto permiten 10 intentos en 300 segundos y bloquean durante 300 segundos. Configura `AUTH_MAX_ATTEMPTS`, `AUTH_WINDOW_SECONDS` y `AUTH_BLOCK_SECONDS` para cambiar estos valores. Las verificaciones correctas no cuentan como fallos; las solicitudes simultáneas reservan un intento antes de verificarse. Una respuesta `429` incluye `Retry-After` y `retryAfter` en segundos.
- Las contraseñas nuevas requieren al menos 12 caracteres y un máximo de 72 **bytes UTF-8**, sin truncarlas. Los caracteres acentuados y emojis pueden ocupar varios bytes. El login y la comprobación de contraseña actual también rechazan valores mayores a 72 bytes.
- Helmet agrega cabeceras de seguridad a la API. Las operaciones de escritura requieren `Origin` igual al origen de `FRONTEND_URL` y un token CSRF firmado en `X-CSRF-Token`, coincidente con la cookie `csrf`. El cliente obtiene ese token desde `GET /api/auth/csrf`; las llamadas manuales deben conservar las cookies y enviar ambas cabeceras.
- La API valida su configuración al arrancar. Se conserva `COOKIE_SECURE=false` para desarrollo HTTP; no se impone HTTPS en esta etapa.

Para aplicar el código y la migración sin borrar datos: `docker compose up --build -d api web`. Para ejecutar pruebas básicas de seguridad: `npm run test -w @base/api`.

## Idioma

El idioma es global y se configura con `APP_LOCALE` en `.env`: `es` (predeterminado) o `en`. La API publica la configuración actual en `/api/config`, y el frontend la consulta al cargar. Los mensajes de la API y la interfaz usan el mismo idioma.

- **Al cambiar el idioma**, edita `APP_LOCALE` en `.env` y ejecuta `docker compose up -d`. Esto recrea los servicios afectados con el nuevo valor; no hace falta reconstruir las imágenes. Los usuarios con la aplicación abierta deben recargar la página.
- **Al cambiar el código** que implementa o utiliza los idiomas, reconstruye API y frontend con `docker compose up --build -d api web`. `docker compose up -d` y `docker compose up -d --force-recreate api` solo crean contenedores desde las imágenes existentes; no incorporan cambios de código.

Los diccionarios frontend están separados en `apps/web/app/locales/es.ts` y `en.ts`. Usa claves estables tipadas (por ejemplo `t('profile.saveName')`); TypeScript exige que inglés cubra todas las claves de español. Las pruebas verifican también los parámetros de interpolación. La interfaz no se muestra hasta recibir `/api/config`; si falla, presenta un aviso bilingüe y un botón de reintento, sin asumir otro idioma.

### Validación y listado de usuarios

Las respuestas de validación incluyen `fieldErrors`, un mapa de campos a mensajes traducidos que se muestran en los formularios de perfil y administración. El login es la excepción: responde de forma genérica y no incluye errores por campo ni pistas sobre la existencia de una cuenta.

`GET /api/users?page=1&limit=20` acepta páginas enteras positivas y un límite entre 1 y 100. Devuelve `users` y `pagination` (`page`, `limit`, `total`, `totalPages`). Una página fuera del rango de datos se ajusta a la última disponible; una lista vacía utiliza la página 1. El orden es estable por fecha de creación e ID. PostgreSQL pagina con `skip`/`take`, y la consulta selecciona exclusivamente campos públicos, sin hashes ni versiones de sesión. La interfaz permite elegir 10, 20, 50 o 100 elementos y navegar con Anterior/Siguiente. No se incluyen búsqueda ni filtros en esta etapa.

## Copias de seguridad

Consulta [la guía de backup y restauración de PostgreSQL](docs/postgresql-backups.md). Incluye comandos PowerShell para generar archivos, verificar su contenido y restaurar en una base nueva sin sobrescribir producción.
