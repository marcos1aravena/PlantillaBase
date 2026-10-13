'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileInput } from '@base/contracts';
import { useAuth, roleName } from '../../components/auth';
import { Field, inputClass } from '../../components/field';
import { ApiError, client } from '../../api';
import { useI18n, TranslationKey } from '../../i18n';

export default function ProfilePage() {
  const { user, setUser } = useAuth(); const { t, locale, message: localize } = useI18n(); const router = useRouter();
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  async function save(event: FormEvent<HTMLFormElement>, password = false) {
    event.preventDefault(); setError(''); setMessage(''); setFields({}); setBusy(true);
    const data = new FormData(event.currentTarget);
    const input: ProfileInput = password ? { currentPassword: String(data.get('currentPassword')), newPassword: String(data.get('newPassword')) } : { name: String(data.get('name')) };
    try {
      const result = await client.updateProfile(input);
      if (result.sessionsRevoked) { router.replace('/login'); return; }
      setUser(result.user); setMessage(t('profile.nameSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.profile'));
      if (err instanceof ApiError) setFields(err.fieldErrors);
    } finally { setBusy(false); }
  }
  async function revoke() {
    if (!window.confirm(t('profile.revokeConfirm'))) return;
    setError(''); setBusy(true);
    try { await client.revokeSessions(); router.replace('/login'); }
    catch (err) { setError(err instanceof Error ? err.message : t('errors.profile')); }
    finally { setBusy(false); }
  }
  const info: [TranslationKey, string][] = [['fields.email', user.email], ['fields.role', t(roleName[user.role])], ['fields.status', t(user.active ? 'status.active' : 'status.inactive')], ['profile.registered', new Date(user.createdAt).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US')]];
  return <>
    <p className="text-sm font-medium text-blue-700">{t('profile.label')}</p><h1 className="mt-2 text-3xl font-bold">{t('nav.profile')}</h1><p className="mt-2 text-slate-500">{t('profile.description')}</p>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{localize(error)}</p>}{message && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('profile.account')}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{info.map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase text-slate-500">{t(label)}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl><p className="mt-4 text-xs text-slate-400">{t('profile.readonly')}</p></section>
    <form onSubmit={(event) => save(event)} className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">{t('fields.name')}</h2><p className="mt-1 text-sm text-slate-500">{t('profile.nameHelp')}</p>
      <div className="mt-4 max-w-lg"><Field label={t('fields.name')} errors={fields.name}><input name="name" required minLength={2} maxLength={100} defaultValue={user.name} className={inputClass} aria-invalid={Boolean(fields.name)} /></Field></div>
      <button disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(busy ? 'common.saving' : 'profile.saveName')}</button>
    </form>
    <form onSubmit={(event) => save(event, true)} className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold">{t('profile.changePassword')}</h2><p className="mt-1 text-sm text-slate-500">{t('profile.passwordHelp')}</p>
      <div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2"><Field label={t('profile.currentPassword')} errors={fields.currentPassword}><input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} aria-invalid={Boolean(fields.currentPassword)} /></Field><Field label={t('profile.newPassword')} errors={fields.newPassword}><input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={72} className={inputClass} aria-invalid={Boolean(fields.newPassword)} /></Field></div>
      <button disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(busy ? 'common.saving' : 'profile.changePassword')}</button><p className="mt-3 text-xs text-slate-500">{t('profile.passwordRevokes')}</p>
    </form>
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('profile.sessions')}</h2><p className="mt-2 text-sm text-slate-500">{t('profile.sessionsHelp')}</p><button disabled={busy} onClick={revoke} className="mt-4 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">{t('profile.revoke')}</button></section>
  </>;
}
