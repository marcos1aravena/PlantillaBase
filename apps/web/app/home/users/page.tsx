'use client';

import { useEffect, useState } from 'react';
import type { CreateUserInput, UpdateUserInput, User } from '@base/contracts';
import { useAuth, roleName } from '../../components/auth';
import { UserForm } from '../../components/user-form';
import { client } from '../../api';
import { useI18n } from '../../i18n';

export default function UsersPage() {
  const { user, setUser } = useAuth(); const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]); const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  async function load() { setUsers((await client.users()).users); }
  useEffect(() => { if (user.role !== 'USER') load().catch((err) => setError(err.message)); }, [user.role]);
  if (user.role === 'USER') return <p role="alert">{t('No tienes permisos para esta acción.')}</p>;
  async function mutation(action: () => Promise<void>, success?: string) {
    setError(''); setMessage(''); setBusy(true);
    try { await action(); await load(); if (success) setMessage(t(success)); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar.'); }
    finally { setBusy(false); }
  }
  const save = (input: CreateUserInput) => mutation(async () => { await client.createUser(input); setShowForm(false); }, 'Usuario creado correctamente.');
  const saveEdit = (input: UpdateUserInput) => mutation(async () => {
    if (!editing) return;
    const result = await client.updateUser(editing.id, input);
    if (editing.id === user.id) setUser(result.user);
    setEditing(null);
  }, 'Usuario actualizado correctamente.');
  const update = (target: User, input: UpdateUserInput) => mutation(async () => {
    const result = await client.updateUser(target.id, input);
    if (target.id === user.id) setUser(result.user);
  });
  const remove = (target: User) => {
    if (window.confirm(`${t('¿Eliminar permanentemente a')} ${target.name}?`)) void mutation(() => client.deleteUser(target.id));
  };
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-blue-700">{t('ADMINISTRACIÓN')}</p><h1 className="mt-2 text-3xl font-bold">{t('Usuarios')}</h1><p className="mt-2 text-slate-500">{t('Gestiona las cuentas y sus permisos.')}</p></div><button disabled={busy} onClick={() => { setShowForm(!showForm); setEditing(null); }} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{t(showForm ? 'Cancelar' : 'Crear usuario')}</button></div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}{message && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    {showForm && <UserForm mode="create" actor={user.role} initial={null} busy={busy} onSave={save} onCancel={() => setShowForm(false)} />}
    {editing && <UserForm key={editing.id} mode="edit" actor={user.role} initial={editing} busy={busy} onSave={saveEdit} onCancel={() => setEditing(null)} />}
    <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm">
      <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Usuario', 'Rol', 'Estado', 'Acciones'].map((label) => <th key={label} className="px-5 py-3">{t(label)}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{users.map((target) => {
        const protectedUser = user.role !== 'SUPERADMIN' && target.role !== 'USER';
        return <tr key={target.id}>
          <td className="px-5 py-4"><p className="font-medium">{target.name}</p><p className="text-xs text-slate-500">{target.email}</p></td>
          <td className="px-5 py-4">{protectedUser ? t(roleName[target.role]) : <select disabled={busy} value={target.role} onChange={(event) => update(target, { role: event.target.value as User['role'] })} className="rounded-md border border-slate-200 bg-white px-2 py-1">{user.role === 'SUPERADMIN' && <><option value="SUPERADMIN">{t('Superadministrador')}</option><option value="ADMIN">{t('Administrador')}</option></>}<option value="USER">{t('Usuario')}</option></select>}</td>
          <td className="px-5 py-4"><button disabled={protectedUser || target.role === 'SUPERADMIN' || busy} onClick={() => update(target, { active: !target.active })} className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${target.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{t(target.active ? 'Activo' : 'Inactivo')}</button></td>
          <td className="px-5 py-4"><div className="flex gap-3"><button disabled={protectedUser || busy} onClick={() => { setEditing(target); setShowForm(false); setError(''); setMessage(''); }} className="text-sm font-medium text-blue-600 disabled:text-slate-300">{t('Editar')}</button><button disabled={protectedUser || target.role === 'SUPERADMIN' || busy} onClick={() => remove(target)} className="text-sm font-medium text-red-600 disabled:text-slate-300">{t('Eliminar')}</button></div></td>
        </tr>;
      })}{users.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">{t('No hay usuarios para mostrar.')}</td></tr>}</tbody>
    </table></div>
  </>;
}
