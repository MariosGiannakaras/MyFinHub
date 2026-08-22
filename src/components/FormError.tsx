import type { ReactNode } from 'react';

export function FormError({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} className="form-error" role="alert" aria-live="assertive">{children}</div>;
}
