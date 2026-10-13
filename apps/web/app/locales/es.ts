export const es = {
  'nav.home': 'Inicio', 'nav.profile': 'Mi perfil', 'nav.users': 'Usuarios', 'nav.logout': 'Cerrar sesión',
  'roles.SUPERADMIN': 'Superadministrador', 'roles.ADMIN': 'Administrador', 'roles.USER': 'Usuario',
  'common.loading': 'Cargando…', 'common.saving': 'Guardando…', 'common.cancel': 'Cancelar', 'common.retry': 'Reintentar',
  'fields.name': 'Nombre', 'fields.email': 'Correo electrónico', 'fields.role': 'Rol', 'fields.status': 'Estado', 'fields.password': 'Contraseña',
  'status.active': 'Activo', 'status.inactive': 'Inactivo',
  'home.label': 'INICIO', 'home.greeting': 'Hola,', 'home.welcome': 'Bienvenido a tu espacio de trabajo.', 'home.account': 'Tu cuenta', 'home.security': 'Sesión protegida con JWT · Rol:',
  'profile.label': 'CUENTA', 'profile.description': 'Consulta y actualiza tu información personal.', 'profile.account': 'Información de la cuenta', 'profile.registered': 'Fecha de registro',
  'profile.readonly': 'El correo electrónico y el rol no se pueden modificar desde el perfil.', 'profile.nameHelp': 'Actualiza el nombre asociado a tu cuenta.', 'profile.saveName': 'Guardar nombre', 'profile.nameSaved': 'Nombre actualizado correctamente.',
  'profile.changePassword': 'Cambiar contraseña', 'profile.passwordHelp': 'Por seguridad, confirma tu contraseña actual. La nueva debe tener al menos 12 caracteres.', 'profile.currentPassword': 'Contraseña actual', 'profile.newPassword': 'Nueva contraseña', 'profile.passwordRevokes': 'Cambiar la contraseña cerrará todas tus sesiones.',
  'profile.sessions': 'Sesiones', 'profile.revoke': 'Cerrar todas mis sesiones', 'profile.revokeConfirm': '¿Cerrar todas tus sesiones, incluida esta?', 'profile.sessionsHelp': 'Cierra el acceso en todos los dispositivos, incluido este.',
  'users.label': 'ADMINISTRACIÓN', 'users.description': 'Gestiona las cuentas y sus permisos.', 'users.create': 'Crear usuario', 'users.editTitle': 'Editar usuario', 'users.edit': 'Editar', 'users.delete': 'Eliminar', 'users.actions': 'Acciones', 'users.save': 'Guardar usuario',
  'users.created': 'Usuario creado correctamente.', 'users.updated': 'Usuario actualizado correctamente.', 'users.optionalPassword': 'Nueva contraseña (opcional)', 'users.passwordLabel': 'Contraseña (mínimo 12 caracteres)', 'users.keepPassword': 'Deja el campo vacío para conservar la contraseña actual.', 'users.deleteConfirm': '¿Eliminar permanentemente a {name}?', 'users.empty': 'No hay usuarios para mostrar.',
  'pagination.limit': 'Elementos por página', 'pagination.previous': 'Anterior', 'pagination.next': 'Siguiente', 'pagination.summary': 'Página {page} de {pages} · {total} usuarios',
  'login.welcome': 'Bienvenido', 'login.description': 'Inicia sesión para continuar.', 'login.submitting': 'Ingresando…', 'login.submit': 'Iniciar sesión', 'login.help': 'Acceso disponible únicamente para usuarios creados por un administrador.',
  'errors.connection': 'No se pudo conectar con el servidor.', 'errors.forbidden': 'No tienes permisos para esta acción.', 'errors.session': 'Sesión expirada o inválida.', 'errors.internal': 'Error interno del servidor.', 'errors.profile': 'No se pudo actualizar el perfil.', 'errors.update': 'No se pudo actualizar.',
} as const;
export type TranslationKey = keyof typeof es;
export type Dictionary = Record<TranslationKey, string>;
