import type { ReactNode } from 'react';
import './OperationFeedback.css';

/** Shared operation-result semantics for saved, rejected and partially saved actions. */
export type OperationFeedbackTone = 'success' | 'warning' | 'error';

export function OperationFeedback({tone='success',className='',children}:{
  tone?:OperationFeedbackTone;
  className?:string;
  children:ReactNode;
}) {
  const failure=tone!=='success';
  return <div
    className={['operation-feedback',className,failure?'is-error':''].filter(Boolean).join(' ')}
    data-feedback-tone={tone}
    role={failure?'alert':'status'}
    aria-live={failure?'assertive':'polite'}
  >{children}</div>;
}
