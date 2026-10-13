'use client';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import type { AppLocale } from '@base/contracts';
import { client } from './api';
import { es, TranslationKey, Dictionary } from './locales/es';
import { en } from './locales/en';

export type { AppLocale } from '@base/contracts';
export type { TranslationKey } from './locales/es';
export const dictionaries: Record<AppLocale, Dictionary> = { es, en };
type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;
const I18nContext = createContext<{ locale: AppLocale; t: Translate; message: (text: string) => string } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale | null>(null);
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    client.config().then((config) => {
      if (config.locale !== 'es' && config.locale !== 'en') throw new Error('Unsupported locale');
      if (active) { document.documentElement.lang = config.locale; setLocale(config.locale); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);
  // No language-dependent UI is rendered before the runtime configuration is known.
  if (!locale) return <main className="grid min-h-screen place-content-center gap-4 p-6">{failed ? <><p role="alert">No se pudo cargar el idioma / Could not load language</p><button onClick={() => setAttempt((value) => value + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Reintentar / Retry</button></> : <div role="status" aria-label="Loading" className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />}</main>;
  const t: Translate = (key, params = {}) => dictionaries[locale][key].replace(/\{(\w+)\}/g, (placeholder, name: string) => String(params[name] ?? placeholder));
  // API messages already use the selected locale; normalize only local fallback errors.
  const message = (text: string) => {
    const key = (Object.keys(es) as TranslationKey[]).find((key) => es[key] === text);
    return key ? t(key) : text;
  };
  return <I18nContext.Provider value={{ locale, t, message }}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n requires I18nProvider');
  return context;
}
