'use client';
import { useAuth, roleName } from '../components/auth';
import { useI18n } from '../i18n';

export default function HomePage() {
  const { user } = useAuth(); const { t } = useI18n();
  return <><p className="text-sm font-medium text-blue-700">{t('home.label')}</p><h1 className="mt-2 text-3xl font-bold">{t('home.greeting')} {user.name}</h1><p className="mt-2 text-slate-500">{t('home.welcome')}</p><div className="mt-8 rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">{t('home.account')}</h2><p className="mt-2 text-sm text-slate-500">{t('home.security')} {t(roleName[user.role])}</p></div></>;
}
