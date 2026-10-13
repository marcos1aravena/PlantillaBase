'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { client } from '../api';

export default function LoginPage() {
  const router = useRouter();
  const { t, message } = useI18n();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await client.login({ email: String(form.get('email')), password: String(form.get('password')) });
      router.replace('/home');
    } catch (err) { setError(err instanceof Error ? message(err.message) : t('errors.connection')); }
    finally { setLoading(false); }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-10">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center gap-3"><div className="rounded-xl bg-blue-600 p-3 text-white"><ShieldCheck size={24} /></div><div><p className="text-sm font-semibold text-blue-700">BASE APP</p><h1 className="text-xl font-bold">{t('login.welcome')}</h1></div></div>
      <p className="mb-6 text-sm text-slate-500">{t('login.description')}</p>
      <form noValidate onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">{t('fields.email')}<input required name="email" type="email" autoComplete="username" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
        <label className="block text-sm font-medium">{t('fields.password')}<input required name="password" type="password" autoComplete="current-password" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{t(loading ? 'login.submitting' : 'login.submit')}</button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-400">{t('login.help')}</p>
    </section>
  </main>;
}
