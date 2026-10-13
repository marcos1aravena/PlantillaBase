'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileInput } from '@base/contracts';
import { useAuth, roleName } from '../../components/auth';
import { Field, inputClass } from '../../components/field';
import { client } from '../../api';
import { useI18n } from '../../i18n';

export default function ProfilePage() {
  const { user, setUser } = useAuth(); const { t, locale } = useI18n(); const router = useRouter();
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>, password = false) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    const form = event.currentTarget; const data = new FormData(form);
    const input: ProfileInput = password ? { currentPassword: String(data.get('currentPassword')), newPassword: String(data.get('newPassword')) } : { name: String(data.get('name')) };
    try {
      const result = await client.updateProfile(input);
      if (result.sessionsRevoked) { router.replace('/login'); return; }
      setUser(result.user); setMessage(t('Nombre actualizado correctamente.'));
      if (password) form.reset();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil.'); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!window.confirm(t('¿Cerrar todas tus sesiones, incluida esta?'))) return;
    setError(''); setBusy(true);
    try { await client.revokeSessions(); router.replace('/login'); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar el perfil.'); }
    finally { setBusy(false); }
  }
  return <>
    <p className="text-sm font-medium text-blue-700">{t('CUENTA')}</p><h1 className="mt-2 text-3xl font-bold">{t('Mi perfil')}</h1><p className="mt-2 text-slate-500">{t('Consulta y actualiza tu información personal.')}</p>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}{message && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('Información de la cuenta')}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{[
      ['Correo electrónico', user.email], ['Rol', t(roleName[user.role])], ['Estado', t(user.active ? 'Activo' : 'Inactivo')], ['Fecha de registro', new Date(user.createdAt).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US')],
    ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase text-slate-500">{t(label)}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl><p className="mt-4 text-xs text-slate-400">{t('El correo electrónico y el rol no se pueden modificar desde el perfil.')}</p></section>
    <form onSubmit={(event) => save(event)} className="mt-5 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('Nombre')}</h2><p className="mt-1 text-sm text-slate-500">{t('Actualiza el nombre asociado a tu cuenta.')}</p><div className="mt-4 max-w-lg"><Field label={t('Nombre')}><input name="name" required minLength={2} maxLength={100} defaultValue={user.name} className={inputClass} /></Field></div><button disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(busy ? 'Guardando…' : 'Guardar nombre')}</button></form>
    <form onSubmit={(event) => save(event, true)} className="mt-5 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('Cambiar contraseña')}</h2><p className="mt-1 text-sm text-slate-500">{t('Por seguridad, confirma tu contraseña actual. La nueva debe tener al menos 12 caracteres.')}</p><div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2"><Field label={t('Contraseña actual')}><input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} /></Field><Field label={t('Nueva contraseña')}><input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} className={inputClass} /></Field></div><button disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(busy ? 'Guardando…' : 'Cambiar contraseña')}</button><p className="mt-3 text-xs text-slate-500">{t('Cambiar la contraseña cerrará todas tus sesiones.')}</p></form>
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('Sesiones')}</h2><p className="mt-2 text-sm text-slate-500">{t('Cierra el acceso en todos los dispositivos, incluido este.')}</p><button disabled={busy} onClick={revoke} className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">{t('Cerrar todas mis sesiones')}</button></section>
  </>;
}
