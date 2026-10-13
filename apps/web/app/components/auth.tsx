'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role, User } from '@base/contracts';
import { ApiError, client } from '../api';
import { useI18n } from '../i18n';

export const roleName: Record<Role, string> = { SUPERADMIN: 'Superadministrador', ADMIN: 'Administrador', USER: 'Usuario' };
const AuthContext = createContext<{ user: User; setUser: (user: User) => void } | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const expired = () => { setUser(null); router.replace('/login'); };
    window.addEventListener('auth-expired', expired);
    setError('');
    client.me().then((result) => { if (active) setUser(result.user); }).catch((err) => {
      if (!active) return;
      if (err instanceof ApiError && err.status === 401) expired();
      else setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.');
    });
    return () => { active = false; window.removeEventListener('auth-expired', expired); };
  }, [router, reload]);
  if (error) return <main className="grid min-h-screen place-content-center gap-4 p-6"><p role="alert">{t(error)}</p><button onClick={() => setReload((value) => value + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-white">{t('Reintentar')}</button></main>;
  if (!user) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">{t('Cargando…')}</div>;
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
