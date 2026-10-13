import type { ReactNode } from 'react';
export const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500';
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-sm font-medium">{label}{children}</label>;
}
