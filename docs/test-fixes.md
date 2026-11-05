# Registro de correcciones detectadas mediante pruebas

Este documento es un historial de cambios, **no un backup**. El código anterior se conserva mediante Git; las copias de datos se documentan en [postgresql-backups.md](postgresql-backups.md). No se duplican secretos, bases ni archivos de código en `docs/`.

## 2026-10-13 — Protección concurrente del último superadministrador

- **Problema:** la comprobación del número de superadministradores y la actualización del rol se ejecutaban por separado. Dos peticiones simultáneas podían aprobar ambas comprobaciones y dejar cero superadministradores activos.
- **Reproducción:** prueba de integración `concurrent demotions preserve at least one active superadministrator`, con PostgreSQL real. Un trigger temporal, exclusivo de la base de pruebas, retrasa las actualizaciones para reproducir la carrera. Antes de la corrección ambas operaciones devolvían éxito y la prueba falló.
- **Cambio:** `updateUser` verifica permisos, cuenta y actualiza dentro de una transacción protegida por `pg_advisory_xact_lock(7319401)`. `deleteUser` utiliza el mismo bloqueo para no eliminar una cuenta cuyo rol cambie concurrentemente. El hash de contraseña se calcula antes de obtener el bloqueo.
- **Verificación:** una degradación puede finalizar y la otra se rechaza, conservando al menos un superadministrador activo. La prueba se ejecuta en español e inglés.
- **Impacto:** no cambia el esquema ni requiere migraciones. Las mutaciones administrativas se serializan entre instancias que utilicen estos servicios; no protege escrituras manuales realizadas directamente en la base.

Añadir aquí nuevas entradas cuando una prueba detecte una corrección de comportamiento, incluyendo reproducción, archivos afectados, verificación e impacto en despliegue/datos.

## 2026-10-13 — Nombre accesible de los campos tras una validación

- **Problema:** `Field` incluía el error dentro de la etiqueta del input. Al mostrar una validación, el nombre accesible del campo cambiaba de "Nombre" a "Nombre + mensaje de error", dificultando localizarlo con lectores de pantalla y tests por etiqueta.
- **Reproducción:** la prueba E2E de perfil introducía un nombre de solo espacios y después intentaba corregirlo; el input dejaba de encontrarse por su etiqueta exacta.
- **Cambio:** etiqueta explícita con `htmlFor` e ID estable mediante `useId`, errores fuera de la etiqueta y asociados con `aria-describedby`/`aria-invalid`.
- **Verificación:** el escenario E2E corrige el valor tras una validación y comprueba el mensaje de éxito y el sidebar en español/inglés.
- **Impacto:** solo frontend; no modifica datos ni requiere migraciones.

## 2026-10-13 — Selectores de alertas en pruebas E2E

- **Problema del test:** Next.js agrega un anunciador de rutas con `role="alert"`, por lo que un selector global de alertas era ambiguo.
- **Cambio:** las pruebas consultan alertas dentro de `main`, manteniendo intacto el anunciador accesible de Next.js.
- **Impacto:** ajuste de selectores, sin cambio de comportamiento de la aplicación.

## 2026-10-13 — Aislamiento de metadatos de Next.js durante E2E

- **Problema del tooling:** al usar `.next-test`, Next.js agregaba rutas de tipos de pruebas a `tsconfig.json` y cambiaba la referencia generada de `next-env.d.ts`.
- **Cambio:** las pruebas usan `tsconfig.e2e.json`. Al finalizar, el runner restaura únicamente el cambio conocido de ruta generado en `next-env.d.ts`, siempre que no detecte modificaciones ajenas.
- **Impacto:** mantiene separados los tipos/caché de E2E y desarrollo/producción. Las pruebas no deben ejecutarse simultáneamente con otro servidor que modifique esos mismos metadatos.
