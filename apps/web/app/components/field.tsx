import { Children, cloneElement, isValidElement, ReactElement, ReactNode, useId } from 'react';
export const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500';
export function Field({ label, children, errors }: { label: string; children: ReactNode; errors?: string[] }) {
  const id = useId();
  const errorId = `${id}-errors`;
  return <div className="text-sm font-medium">
    <label htmlFor={id}>{label}</label>
    {Children.map(children, (child) => {
      if (!isValidElement(child) || !['input', 'select', 'textarea'].includes(String(child.type))) return child;
      return cloneElement(child as ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, {
        id, 'aria-invalid': Boolean(errors?.length), 'aria-describedby': errors?.length ? errorId : undefined,
      });
    })}
    {errors?.length ? <div id={errorId} role="alert" className="mt-1 text-xs text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
  </div>;
}
