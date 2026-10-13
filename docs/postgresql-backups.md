# Copias de seguridad y restauración de PostgreSQL

El volumen Docker conserva datos al reiniciar contenedores, pero **no es una copia de seguridad**. Genera archivos con `pg_dump`, guárdalos fuera del servidor y prueba su restauración periódicamente.

## Qué contiene un backup

Un dump de la base incluye esquema, datos y el historial de migraciones Prisma: usuarios, hashes de contraseñas, versiones de sesión y contadores de intentos. No incluye `.env`, secretos JWT, imágenes Docker ni los roles globales de PostgreSQL. Protege esos elementos por separado; nunca los publiques en Git.

Los backups contienen información sensible: restringe su acceso, cifra las copias externas y define una política de retención. Los ejemplos utilizan PostgreSQL 16 y formato custom (`-Fc`), restaurable con `pg_restore`.

## Crear una copia (PowerShell)

Con el servicio `postgres` en ejecución, desde la raíz del proyecto:

```powershell
New-Item -ItemType Directory -Force backups
$backup = "base-app-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/base-app.dump'
docker compose cp postgres:/tmp/base-app.dump "backups/$backup"
docker compose exec -T postgres rm /tmp/base-app.dump
```

Comprueba que cada comando termina correctamente antes de continuar. Copia el archivo a un almacenamiento externo protegido. `backups/` y archivos `.dump` están excluidos de Git y del contexto Docker.

Se escribe el archivo **dentro del contenedor y se copia con `docker compose cp`**, evitando redirecciones binarias de PowerShell que pueden alterar el dump en versiones antiguas.

## Verificar el archivo

Sustituye el nombre por el backup que deseas comprobar:

```powershell
docker compose cp backups/base-app-YYYYMMDD-HHMMSS.dump postgres:/tmp/restore.dump
docker compose exec -T postgres pg_restore --list /tmp/restore.dump
```

Listar el contenido verifica que el archivo se reconoce; no sustituye una prueba de restauración completa.

## Probar una restauración sin sobrescribir producción

Los siguientes comandos crean una **base nueva**, `base_restore`, y restauran allí. Si ya existe, usa otro nombre; no la elimines sin revisar su contenido.

```powershell
docker compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" base_restore'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" --exit-on-error --no-owner --no-privileges -d base_restore /tmp/restore.dump'
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d base_restore -c "SELECT COUNT(*) FROM public._prisma_migrations;"'
docker compose exec -T postgres rm /tmp/restore.dump
```

Verifica tablas y cantidades, e idealmente prueba una instancia de la aplicación aislada apuntando a esa base. No arranques una versión más reciente de la aplicación sin revisar las migraciones pendientes.

## Recuperación real

1. Detén las escrituras de la aplicación y realiza una copia del estado actual si es posible.
2. Restaura en una base nueva con el procedimiento anterior.
3. Verifica los datos y configura `DATABASE_URL` para apuntar a la base restaurada. En Docker Compose la URL se construye a partir de `POSTGRES_DB`; revisa también el usuario y sus permisos. Cambiar esa variable no crea bases nuevas dentro de un volumen ya inicializado.
4. Revisa las migraciones pendientes y levanta los servicios con la versión adecuada del código.
5. Considera rotar `JWT_SECRET` para invalidar todas las sesiones: un backup antiguo puede restaurar versiones de sesión anteriores y revertir revocaciones.

No uses `docker compose down -v` como paso de restauración: elimina el volumen con los datos. Esta guía no ejecuta eliminaciones ni reemplaza automáticamente una base existente.
