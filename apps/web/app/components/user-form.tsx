'use client';
import type { FormEvent } from 'react';
import type { CreateUserInput, Role, UpdateUserInput, User } from '@base/contracts';
import { Field, inputClass } from './field';
import { useI18n } from '../i18n';

type Props = { actor: Role; initial: User | null; busy: boolean; onCancel: () => void } & (
  { mode: 'create'; onSave: (input: CreateUserInput) => Promise<void> } |
  { mode: 'edit'; onSave: (input: UpdateUserInput) => Promise<void> }
);
export function UserForm(props: Props) {
  const { t } = useI18n();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const fields = { name: String(form.get('name')), email: String(form.get('email')), role: String(form.get('role')) as Role };
    if (props.mode === 'create') await props.onSave({ ...fields, password });
    else await props.onSave({ ...fields, ...(password ? { password } : {}) });
  }
  return <form onSubmit={submit} className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
    <h2 className="font-semibold sm:col-span-2">{t(props.mode === 'edit' ? 'Editar usuario' : 'Crear usuario')}</h2>
    <Field label={t('Nombre')}><input name="name" defaultValue={props.initial?.name} required minLength={2} maxLength={100} className={inputClass} /></Field>
    <Field label={t('Correo')}><input name="email" type="email" defaultValue={props.initial?.email} required className={inputClass} /></Field>
    <Field label={t(props.mode === 'edit' ? 'Nueva contraseña (opcional)' : 'Contraseña (mínimo 12 caracteres)')}><input name="password" type="password" autoComplete="new-password" required={props.mode === 'create'} minLength={12} maxLength={72} className={inputClass} />{props.mode === 'edit' && <span className="text-xs text-slate-500">{t('Deja el campo vacío para conservar la contraseña actual.')}</span>}</Field>
    <Field label={t('Rol')}><select name="role" defaultValue={props.initial?.role || 'USER'} className={inputClass}><option value="USER">{t('Usuario')}</option>{props.actor === 'SUPERADMIN' && <><option value="ADMIN">{t('Administrador')}</option><option value="SUPERADMIN">{t('Superadministrador')}</option></>}</select></Field>
    <div className="flex gap-3 sm:col-span-2"><button disabled={props.busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(props.busy ? 'Guardando…' : 'Guardar usuario')}</button><button type="button" disabled={props.busy} onClick={props.onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">{t('Cancelar')}</button></div>
  </form>;
}
