'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateUserInput, UpdateUserInput, User, Pagination } from '@base/contracts';
import { useAuth, roleName } from '../../components/auth';
import { UserForm } from '../../components/user-form';
import { ApiError, client } from '../../api';
import { useI18n, TranslationKey } from '../../i18n';

export default function UsersPage() {
  const { user, setUser } = useAuth(); const { t, message: localize } = useI18n();
  const [users, setUsers] = useState<User[]>([]); const [editing, setEditing] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [fields, setFields] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(1); const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current; setLoading(true);
    try {
      const result = await client.users(page, limit);
      if (request !== sequence.current) return;
      setUsers(result.users); setPagination(result.pagination);
      if (result.pagination.page !== page) setPage(result.pagination.page);
    } catch (error) { if (request === sequence.current) throw error; }
    finally { if (request === sequence.current) setLoading(false); }
  }, [page, limit]);
  useEffect(() => {
    if (user.role !== 'USER') { setError(''); load().catch((err) => setError(err.message)); }
    return () => { sequence.current++; };
  }, [user.role, load]);
  if (user.role === 'USER') return <p role="alert">{t('errors.forbidden')}</p>;
  async function mutation(action: () => Promise<void>, success?: TranslationKey) {
    setError(''); setMessage(''); setFields({}); setBusy(true);
    try { await action(); await load(); if (success) setMessage(t(success)); }
    catch (err) { setError(err instanceof Error ? err.message : t('errors.update')); if (err instanceof ApiError) setFields(err.fieldErrors); }
    finally { setBusy(false); }
  }
  const save = (input: CreateUserInput) => mutation(async () => { await client.createUser(input); setShowForm(false); }, 'users.created');
  const saveEdit = (input: UpdateUserInput) => mutation(async () => { if (!editing) return; const result = await client.updateUser(editing.id, input); if (editing.id === user.id) setUser(result.user); setEditing(null); }, 'users.updated');
  const update = (target: User, input: UpdateUserInput) => mutation(async () => { const result = await client.updateUser(target.id, input); if (target.id === user.id) setUser(result.user); });
  const remove = (target: User) => { if (window.confirm(t('users.deleteConfirm', { name: target.name }))) void mutation(() => client.deleteUser(target.id)); };
  const headings: TranslationKey[] = ['roles.USER', 'fields.role', 'fields.status', 'users.actions'];
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-blue-700">{t('users.label')}</p><h1 className="mt-2 text-3xl font-bold">{t('nav.users')}</h1><p className="mt-2 text-slate-500">{t('users.description')}</p></div><button disabled={busy} onClick={() => { setShowForm(!showForm); setEditing(null); setFields({}); }} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{t(showForm ? 'common.cancel' : 'users.create')}</button></div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{localize(error)}</p>}{message && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    {showForm && <UserForm mode="create" actor={user.role} initial={null} busy={busy} errors={fields} onSave={save} onCancel={() => setShowForm(false)} />}
    {editing && <UserForm key={editing.id} mode="edit" actor={user.role} initial={editing} busy={busy} errors={fields} onSave={saveEdit} onCancel={() => setEditing(null)} />}
    <label className="mt-6 flex items-center gap-3 text-sm">{t('pagination.limit')}<select value={limit} disabled={busy} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2">{[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <div aria-busy={loading} className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm">
      <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500"><tr>{headings.map((label) => <th key={label} className="px-5 py-3">{t(label)}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{users.map((target) => {
        const protectedUser = user.role !== 'SUPERADMIN' && target.role !== 'USER';
        return <tr key={target.id}>
          <td className="px-5 py-4"><p className="font-medium">{target.name}</p><p className="text-xs text-slate-500">{target.email}</p></td>
          <td className="px-5 py-4">{protectedUser ? t(roleName[target.role]) : <select disabled={busy || loading} value={target.role} onChange={(event) => update(target, { role: event.target.value as User['role'] })} className="rounded-md border border-slate-200 bg-white px-2 py-1">{user.role === 'SUPERADMIN' && <><option value="SUPERADMIN">{t('roles.SUPERADMIN')}</option><option value="ADMIN">{t('roles.ADMIN')}</option></>}<option value="USER">{t('roles.USER')}</option></select>}</td>
          <td className="px-5 py-4"><button disabled={protectedUser || target.role === 'SUPERADMIN' || busy || loading} onClick={() => update(target, { active: !target.active })} className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${target.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{t(target.active ? 'status.active' : 'status.inactive')}</button></td>
          <td className="px-5 py-4"><div className="flex gap-3"><button disabled={protectedUser || busy || loading} onClick={() => { setEditing(target); setShowForm(false); setError(''); setMessage(''); setFields({}); }} className="text-sm font-medium text-blue-600 disabled:text-slate-300">{t('users.edit')}</button><button disabled={protectedUser || target.role === 'SUPERADMIN' || busy || loading} onClick={() => remove(target)} className="text-sm font-medium text-red-600 disabled:text-slate-300">{t('users.delete')}</button></div></td>
        </tr>;
      })}{users.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">{t(loading ? 'common.loading' : 'users.empty')}</td></tr>}</tbody>
    </table></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><p role="status">{t('pagination.summary', { page: pagination.page, pages: pagination.totalPages, total: pagination.total })}</p><div className="flex gap-2"><button disabled={busy || loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">{t('pagination.previous')}</button><button disabled={busy || loading || page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">{t('pagination.next')}</button></div></div>
  </>;
}
