'use client';

import { ReactNode, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react';
import { AuthProvider, useAuth, roleName } from '../components/auth';
import { client } from '../api';
import { useI18n } from '../i18n';

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <AuthProvider><Shell>{children}</Shell></AuthProvider>;
}
function Shell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname(); const router = useRouter();
  const [error, setError] = useState('');
  async function logout() {
    try { await client.logout(); router.replace('/login'); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.'); }
  }
  const links = [{ href: '/home', label: 'Inicio', Icon: Home }, { href: '/home/profile', label: 'Mi perfil', Icon: UserRound }, ...(user.role !== 'USER' ? [{ href: '/home/users', label: 'Usuarios', Icon: Users }] : [])];
  return <div className="min-h-screen md:flex">
    <aside className="flex w-full flex-col border-r border-slate-200 bg-white md:fixed md:inset-y-0 md:w-64">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5"><div className="rounded-lg bg-blue-600 p-2 text-white"><ShieldCheck size={20} /></div><span className="font-bold">Base App</span></div>
      <nav className="flex flex-wrap gap-2 p-3 md:flex-1 md:flex-col">{links.map(({ href, label, Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${pathname === href ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={18} />{t(label)}</Link>)}</nav>
      <div className="hidden border-t border-slate-100 p-4 md:block"><p className="truncate text-sm font-semibold">{user.name}</p><p className="text-xs text-slate-500">{t(roleName[user.role])}</p></div>
      <button onClick={logout} className="flex items-center gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-600"><LogOut size={18} />{t('Cerrar sesión')}</button>
    </aside>
    <main className="min-w-0 flex-1 p-6 md:ml-64 md:p-10">{error && <p role="alert" className="mb-4 text-red-700">{t(error)}</p>}{children}</main>
  </div>;
}
