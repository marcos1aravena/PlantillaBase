'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useI18n } from '../i18n';
import { apiFetch as fetch } from '../api';

const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
type User = { id: string; name: string; email: string; role: 'SUPERADMIN' | 'ADMIN' | 'USER'; active: boolean; createdAt: string };
const roleName: Record<User['role'], string> = { SUPERADMIN: 'Superadministrador', ADMIN: 'Administrador', USER: 'Usuario' };

export default function HomePage() {
  const router = useRouter(); const pathname = usePathname();
  const { t, locale } = useI18n();
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`${api}/api/auth/me`, { credentials: 'include' }).then(async (res) => { if (!res.ok) throw new Error(); const data = await res.json(); setUser(data.user); }).catch(() => router.replace('/login')).finally(() => setLoading(false)); }, [router]);
  async function logout() { await fetch(`${api}/api/auth/logout`, { method: 'POST', credentials: 'include' }); router.replace('/login'); }
  if (loading || !user) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">{t('Cargando…')}</div>;
  const admin = user.role !== 'USER';
  return <div className="min-h-screen md:flex">
    <aside className="flex w-full flex-col border-r border-slate-200 bg-white md:fixed md:inset-y-0 md:w-64">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5"><div className="rounded-lg bg-blue-600 p-2 text-white"><ShieldCheck size={20} /></div><span className="font-bold">Base App</span></div>
      <nav className="flex gap-2 p-3 md:flex-1 md:flex-col">
        <Link href="/home" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${pathname === '/home' ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Home size={18} />{t('Inicio')}</Link>
        <Link href="/home/profile" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${pathname.includes('/profile') ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><UserRound size={18} />{t('Mi perfil')}</Link>
        {admin && <Link href="/home/users" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${pathname.includes('/users') ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Users size={18} />{t('Usuarios')}</Link>}
      </nav>
      <div className="hidden border-t border-slate-100 p-4 md:block"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-slate-500">{t(roleName[user.role])}</p></div>
      <button onClick={logout} className="flex items-center gap-3 border-t border-slate-100 px-6 py-4 text-left text-sm text-slate-600 hover:bg-slate-50"><LogOut size={18} />{t('Cerrar sesión')}</button>
    </aside>
    <main className="min-w-0 flex-1 p-6 md:ml-64 md:p-10">{pathname.includes('/users') && admin ? <UsersScreen user={user} /> : pathname.includes('/profile') ? <ProfileScreen user={user} onUserUpdated={setUser} /> : <><p className="text-sm font-medium text-blue-700">{t('INICIO')}</p><h1 className="mt-2 text-3xl font-bold">{t('Hola,')} {user.name}</h1><p className="mt-2 text-slate-500">{t('Bienvenido a tu espacio de trabajo.')}</p><div className="mt-8 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('Tu cuenta')}</h2><p className="mt-2 text-sm text-slate-500">{t('Sesión protegida con JWT · Rol:')} {t(roleName[user.role])}</p></div></>}</main>
  </div>;
}

function ProfileScreen({ user, onUserUpdated }: { user: User; onUserUpdated: (user: User) => void }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function updateProfile(body: object) {
    const response = await fetch(`${api}/api/auth/profile`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(t(result.error || 'No se pudo actualizar el perfil.'));
    if (result.sessionsRevoked) { router.replace('/login'); return; }
    onUserUpdated(result.user);
  }

  async function revokeSessions() {
    if (!window.confirm(t('¿Cerrar todas tus sesiones, incluida esta?'))) return;
    setError(''); setRevoking(true);
    try {
      const response = await fetch(`${api}/api/auth/revoke-sessions`, { method: 'POST' });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
      router.replace('/login');
    } catch (err) { setError(err instanceof Error ? err.message : t('No se pudo actualizar el perfil.')); }
    finally { setRevoking(false); }
  }

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setSavingName(true);
    const name = new FormData(event.currentTarget).get('name');
    try { await updateProfile({ name }); setMessage(t('Nombre actualizado correctamente.')); }
    catch (err) { setError(err instanceof Error ? t(err.message) : t('No se pudo actualizar el nombre.')); }
    finally { setSavingName(false); }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setSavingPassword(true);
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    try {
      await updateProfile({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') });
      form.reset(); setMessage(t('Contraseña actualizada correctamente.'));
    } catch (err) { setError(err instanceof Error ? t(err.message) : t('No se pudo actualizar la contraseña.')); }
    finally { setSavingPassword(false); }
  }

  return <>
    <p className="text-sm font-medium text-blue-700">{t('CUENTA')}</p>
    <h1 className="mt-2 text-3xl font-bold">{t('Mi perfil')}</h1>
    <p className="mt-2 text-slate-500">{t('Consulta y actualiza tu información personal.')}</p>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}

    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">{t('Información de la cuenta')}</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-medium uppercase text-slate-500">{t('Correo electrónico')}</dt><dd className="mt-1 text-sm">{user.email}</dd></div>
        <div><dt className="text-xs font-medium uppercase text-slate-500">{t('Rol')}</dt><dd className="mt-1 text-sm">{t(roleName[user.role])}</dd></div>
        <div><dt className="text-xs font-medium uppercase text-slate-500">{t('Estado')}</dt><dd className="mt-1 text-sm">{t(user.active ? 'Activo' : 'Inactivo')}</dd></div>
        <div><dt className="text-xs font-medium uppercase text-slate-500">{t('Fecha de registro')}</dt><dd className="mt-1 text-sm">{new Date(user.createdAt).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US')}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-slate-400">{t('El correo electrónico y el rol no se pueden modificar desde el perfil.')}</p>
    </section>

    <form onSubmit={saveName} className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">{t('Nombre')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('Actualiza el nombre asociado a tu cuenta.')}</p>
      <div className="mt-4 max-w-lg"><Field label={t('Nombre')}><input name="name" required minLength={2} maxLength={100} defaultValue={user.name} className={inputClass} /></Field></div>
      <button disabled={savingName} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingName ? t('Guardando…') : t('Guardar nombre')}</button>
    </form>

    <form onSubmit={savePassword} className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">{t('Cambiar contraseña')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('Por seguridad, confirma tu contraseña actual. La nueva debe tener al menos 12 caracteres.')}</p>
      <div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Field label={t('Contraseña actual')}><input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} /></Field>
        <Field label={t('Nueva contraseña')}><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={inputClass} /></Field>
      </div>
      <button disabled={savingPassword} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingPassword ? t('Guardando…') : t('Cambiar contraseña')}</button>
      <p className="mt-3 text-xs text-slate-500">{t('Cambiar la contraseña cerrará todas tus sesiones.')}</p>
    </form>
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">{t('Sesiones')}</h2>
      <p className="mt-2 text-sm text-slate-500">{t('Cierra el acceso en todos los dispositivos, incluido este.')}</p>
      <button disabled={revoking} onClick={revokeSessions} className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">{t('Cerrar todas mis sesiones')}</button>
    </section>
  </>;
}

function UsersScreen({ user }: { user: User }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false);
  async function load() { const res = await fetch(`${api}/api/users`, { credentials: 'include' }); const data = await res.json(); if (!res.ok) throw new Error(t(data.error)); setUsers(data.users); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    const data = new FormData(event.currentTarget);
    try { const res = await fetch(`${api}/api/users`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.get('name'), email: data.get('email'), password: data.get('password'), role: data.get('role') }) }); const result = await res.json(); if (!res.ok) throw new Error(t(result.error)); setShowForm(false); setMessage(t('Usuario creado correctamente.')); await load(); }
    catch (err) { setError(err instanceof Error ? t(err.message) : t('Error al crear usuario.')); } finally { setBusy(false); }
  }
  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || (user.role !== 'SUPERADMIN' && editing.role !== 'USER')) return;
    setError(''); setMessage(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    try {
      const response = await fetch(`${api}/api/users/${editing.id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), email: form.get('email'), role: form.get('role'), ...(password ? { password } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('No se pudo actualizar.'));
      await load(); setEditing(null); setMessage(t('Usuario actualizado correctamente.'));
    } catch (err) { setError(err instanceof Error ? err.message : t('No se pudo actualizar.')); }
    finally { setBusy(false); }
  }
  async function update(id: string, body: object) { setError(''); try { const res = await fetch(`${api}/api/users/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(t(data.error)); await load(); } catch (err) { setError(err instanceof Error ? t(err.message) : t('No se pudo actualizar.')); } }
  async function remove(target: User) { if (!window.confirm(`${t('¿Eliminar permanentemente a')} ${target.name}?`)) return; setError(''); try { const res = await fetch(`${api}/api/users/${target.id}`, { method: 'DELETE', credentials: 'include' }); if (!res.ok) { const data = await res.json(); throw new Error(t(data.error)); } await load(); } catch (err) { setError(err instanceof Error ? t(err.message) : t('No se pudo eliminar.')); } }
  return <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-blue-700">{t('ADMINISTRACIÓN')}</p><h1 className="mt-2 text-3xl font-bold">{t('Usuarios')}</h1><p className="mt-2 text-slate-500">{t('Gestiona las cuentas y sus permisos.')}</p></div><button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{showForm ? t('Cancelar') : t('Crear usuario')}</button></div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    {editing && <form key={editing.id} onSubmit={saveEdit} className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">{t('Editar usuario')}</h2>
      <Field label={t('Nombre')}><input name="name" defaultValue={editing.name} required minLength={2} maxLength={100} className={inputClass} /></Field>
      <Field label={t('Correo')}><input name="email" type="email" defaultValue={editing.email} required className={inputClass} /></Field>
      <Field label={t('Nueva contraseña (opcional)')}><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} /><span className="text-xs text-slate-500">{t('Deja el campo vacío para conservar la contraseña actual.')}</span></Field>
      <Field label={t('Rol')}><select name="role" defaultValue={editing.role} className={inputClass}><option value="USER">{t('Usuario')}</option>{user.role === 'SUPERADMIN' && <><option value="ADMIN">{t('Administrador')}</option><option value="SUPERADMIN">{t('Superadministrador')}</option></>}</select></Field>
      <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(busy ? 'Guardando…' : 'Guardar usuario')}</button><button type="button" disabled={busy} onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">{t('Cancelar')}</button></div>
    </form>}
    {showForm && <form onSubmit={save} className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"><Field label={t('Nombre')}><input name="name" required minLength={2} className={inputClass} /></Field><Field label={t('Correo')}><input name="email" type="email" required className={inputClass} /></Field><Field label={t('Contraseña (mínimo 12 caracteres)')}><input name="password" type="password" required minLength={12} className={inputClass} /></Field><Field label={t('Rol')}><select name="role" className={inputClass}><option value="USER">{t('Usuario')}</option>{user.role === 'SUPERADMIN' && <><option value="ADMIN">{t('Administrador')}</option><option value="SUPERADMIN">{t('Superadministrador')}</option></>}</select></Field><div className="sm:col-span-2"><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? t('Guardando…') : t('Guardar usuario')}</button></div></form>}
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Usuario', 'Rol', 'Estado', 'Acciones'].map((label) => <th key={label} className="px-5 py-3">{t(label)}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{users.map((target) => {
          const protectedUser = user.role !== 'SUPERADMIN' && target.role !== 'USER';
          return <tr key={target.id}>
            <td className="px-5 py-4"><p className="font-medium">{target.name}</p><p className="text-xs text-slate-500">{target.email}</p></td>
            <td className="px-5 py-4">{protectedUser ? t(roleName[target.role]) : <select disabled={busy} value={target.role} onChange={(e) => update(target.id, { role: e.target.value })} className="rounded-md border border-slate-200 bg-white px-2 py-1">{user.role === 'SUPERADMIN' && <><option value="SUPERADMIN">{t('Superadministrador')}</option><option value="ADMIN">{t('Administrador')}</option></>}<option value="USER">{t('Usuario')}</option></select>}</td>
            <td className="px-5 py-4"><button disabled={protectedUser || target.role === 'SUPERADMIN' || busy} onClick={() => update(target.id, { active: !target.active })} className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${target.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{t(target.active ? 'Activo' : 'Inactivo')}</button></td>
            <td className="px-5 py-4"><div className="flex gap-3"><button disabled={protectedUser || busy} onClick={() => { setEditing(target); setShowForm(false); setError(''); setMessage(''); }} className="text-sm font-medium text-blue-600 disabled:cursor-not-allowed disabled:text-slate-300">{t('Editar')}</button><button disabled={protectedUser || target.role === 'SUPERADMIN' || busy} onClick={() => remove(target)} className="text-sm font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-300">{t('Eliminar')}</button></div></td>
          </tr>;
        })}{users.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">{t('No hay usuarios para mostrar.')}</td></tr>}</tbody>
      </table>
    </div>
  </>;
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500';
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="text-sm font-medium">{label}{children}</label>; }
