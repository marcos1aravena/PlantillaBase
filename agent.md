# Contexto del proyecto

Plantilla base de aplicación para proyectos futuros. Es un monorepo npm con frontend y API separados.

## Stack

- Frontend: Next.js 15 (App Router), React y Tailwind CSS.
- Backend: Node.js, Express 4 y TypeScript.
- Base de datos: PostgreSQL 16; Prisma ORM y migraciones en `apps/api/prisma`.
- Autenticación: JWT en cookie `HttpOnly`, `SameSite=Strict`, duración de 8 horas. Usar HTTPS y `COOKIE_SECURE=true` en producción.
- Idioma: `APP_LOCALE` (`es` o `en`), selecciona un idioma global al iniciar la API. El frontend obtiene el idioma desde `/api/config`, por lo que cambiar el idioma requiere reiniciar servicios, no reconstruir las imágenes.
- Ejecución en contenedores: Docker Compose con servicios `web`, `api` y `postgres`.
- Node.js requerido: 22 (también indicado en `.nvmrc`).

## Estructura

- `apps/web`: interfaz Next.js. Rutas principales: `/login`, `/home`, `/home/profile` y `/home/users`.
- `apps/api/src/server.ts`: endpoints Express, autenticación y autorización.
- `apps/web/app/i18n.tsx`: diccionario frontend y provider que sincroniza locale en runtime con la API.
- `apps/api/prisma/schema.prisma`: modelo de usuarios y enum de roles.
- `apps/api/prisma/migrations`: migraciones versionadas.
- `apps/api/prisma/seed.ts`: crea de forma idempotente el superadministrador inicial.
- `docker-compose.yml`: configuración para levantar la aplicación completa.
- `.env.example`: variables de entorno de referencia.

## Roles y reglas de autorización

- `SUPERADMIN`: puede crear y gestionar usuarios de cualquier rol.
- `ADMIN`: puede gestionar usuarios normales (`USER`) y ver administradores; no puede modificar cuentas de administrador.
- `USER`: acceso al home, sin acceso a gestión de usuarios.
- Todos los roles pueden consultar su perfil y cambiar su nombre y contraseña. El correo y rol son solo de lectura desde el perfil.
- El cambio de contraseña del perfil requiere la contraseña actual; no se acepta email ni rol en el endpoint de perfil.
- La autorización debe validarse siempre en la API, no solo ocultando controles en la interfaz.
- No permitir eliminar superadministradores ni desactivar al último superadministrador activo.
- Al cambiar un rol o desactivar una cuenta, la autenticación consulta el estado actual del usuario para que el cambio aplique a sesiones existentes.
- Las contraseñas se guardan únicamente como hashes bcrypt. Nunca pasar el campo `password` directamente a Prisma: mapearlo a `passwordHash`.

## Comandos habituales

```bash
# Arranque completo (copiar antes .env.example a .env y editar secretos)
docker compose up --build

# Recompilar/levantar solo la API después de cambios
docker compose up --build -d api

# Desarrollo local: instalar dependencias y levantar web + API
npm install
npm run dev

# Migraciones y seed en desarrollo local
npm run db:migrate
npm run db:seed

# Compilar ambos workspaces
npm run build
```

La web se sirve en `http://localhost:3000` y la API en `http://localhost:4000`. Health check: `/api/health`.

## Detalles importantes de Docker/build

- El Dockerfile de API debe copiar `apps/api/prisma` antes de `npm install`, porque el `postinstall` de Prisma busca el esquema.
- La compilación TypeScript de la API genera `apps/api/dist/src/server.js`; el script `start` apunta a `dist/src/server.js`.
- Al cambiar código de API, reconstruir la imagen con `docker compose up --build -d api`.
- No borrar el volumen PostgreSQL para solucionar errores de aplicación; conservar los datos salvo que se solicite explícitamente eliminarlos.

## Convenciones al continuar el trabajo

- Mantener el frontend y backend tipados con TypeScript y respetar la separación por workspace.
- Añadir cambios de esquema mediante migraciones Prisma; no depender solo de cambios manuales en la base.
- No añadir registro público: las cuentas se crean desde la gestión de usuarios.
- No incluir secretos reales en el repositorio. Actualizar `.env.example` solo con valores de ejemplo.
- Cuando se cambie el contrato de API, actualizar también sus consumidores en el frontend.
