import type { ReactNode } from 'react';
export const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500';
export function Field({ label, children, errors }: { label: string; children: ReactNode; errors?: string[] }) {
  return <label className="text-sm font-medium">{label}{children}{errors?.map((error) => <span key={error} role="alert" className="mt-1 block text-xs text-red-700">{error}</span>)}</label>;
}
