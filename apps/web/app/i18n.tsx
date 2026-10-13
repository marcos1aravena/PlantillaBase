'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export type AppLocale = 'es' | 'en';
const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const translations: Record<AppLocale, Record<string, string>> = {
  es: {},
  en: {
    'Inicio': 'Home', 'Mi perfil': 'My profile', 'Usuarios': 'Users', 'Cerrar sesión': 'Sign out',
    'Superadministrador': 'Super administrator', 'Administrador': 'Administrator', 'Usuario': 'User',
    'Cargando…': 'Loading…', 'Bienvenido a tu espacio de trabajo.': 'Welcome to your workspace.',
    'Tu cuenta': 'Your account', 'Sesión protegida con JWT · Rol:': 'JWT-protected session · Role:',
    'CUENTA': 'ACCOUNT', 'Consulta y actualiza tu información personal.': 'View and update your personal information.',
    'Información de la cuenta': 'Account information', 'Correo electrónico': 'Email address', 'Rol': 'Role', 'Estado': 'Status',
    'Activo': 'Active', 'Inactivo': 'Inactive', 'Fecha de registro': 'Registration date',
    'El correo electrónico y el rol no se pueden modificar desde el perfil.': 'Email address and role cannot be changed from your profile.',
    'Nombre': 'Name', 'Actualiza el nombre asociado a tu cuenta.': 'Update the name associated with your account.',
    'Guardando…': 'Saving…', 'Guardar nombre': 'Save name', 'Cambiar contraseña': 'Change password',
    'Por seguridad, confirma tu contraseña actual. La nueva debe tener al menos 12 caracteres.': 'For security, confirm your current password. Your new password must be at least 12 characters.',
    'Contraseña actual': 'Current password', 'Nueva contraseña': 'New password',
    'Nombre actualizado correctamente.': 'Name updated successfully.', 'Contraseña actualizada correctamente.': 'Password updated successfully.',
    'No se pudo actualizar el perfil.': 'Could not update profile.', 'No se pudo actualizar el nombre.': 'Could not update name.',
    'No se pudo actualizar la contraseña.': 'Could not update password.',
    'ADMINISTRACIÓN': 'ADMINISTRATION', 'Gestiona las cuentas y sus permisos.': 'Manage accounts and their permissions.',
    'Crear usuario': 'Create user', 'Cancelar': 'Cancel', 'Usuario creado correctamente.': 'User created successfully.',
    'Editar usuario': 'Edit user', 'Editar': 'Edit', 'Usuario actualizado correctamente.': 'User updated successfully.',
    'Nueva contraseña (opcional)': 'New password (optional)',
    'Deja el campo vacío para conservar la contraseña actual.': 'Leave blank to keep the current password.',
    'Sesiones': 'Sessions', 'Cerrar todas mis sesiones': 'Sign out of all sessions',
    '¿Cerrar todas tus sesiones, incluida esta?': 'Sign out of all sessions, including this one?',
    'Cierra el acceso en todos los dispositivos, incluido este.': 'Sign out on all devices, including this one.',
    'Cambiar la contraseña cerrará todas tus sesiones.': 'Changing your password will sign you out on all devices.',
    'Error al crear usuario.': 'Could not create user.', 'No se pudo actualizar.': 'Could not update user.',
    'No se pudo eliminar.': 'Could not delete user.', 'Correo': 'Email', 'Contraseña (mínimo 12 caracteres)': 'Password (at least 12 characters)',
    'Guardar usuario': 'Save user', 'Acciones': 'Actions', 'Eliminar': 'Delete',
    '¿Eliminar permanentemente a': 'Permanently delete', 'No hay usuarios para mostrar.': 'No users to display.',
    'INICIO': 'HOME', 'Hola,': 'Hello,', 'Bienvenido': 'Welcome', 'Inicia sesión para continuar.': 'Sign in to continue.',
    'Contraseña': 'Password', 'Ingresando…': 'Signing in…', 'Iniciar sesión': 'Sign in',
    'Acceso disponible únicamente para usuarios creados por un administrador.': 'Access is only available to accounts created by an administrator.',
    'No se pudo iniciar sesión.': 'Could not sign in.', 'No se pudo conectar con el servidor.': 'Could not connect to the server.',
  },
};

type I18nContextValue = { locale: AppLocale; t: (text: string) => string };
const I18nContext = createContext<I18nContextValue>({ locale: 'es', t: (text) => text });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>('es');
  useEffect(() => {
    let mounted = true;
    fetch(`${api}/api/config`).then((response) => response.ok ? response.json() : null)
      .then((config) => {
        if (!mounted || (config?.locale !== 'es' && config?.locale !== 'en')) return;
        setLocale(config.locale);
        document.documentElement.lang = config.locale;
      }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  const t = (text: string) => translations[locale][text] || text;
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
