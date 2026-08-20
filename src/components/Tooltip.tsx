import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
type DescribedElement = ReactElement<{ 'aria-describedby'?: string }>;

export function Tooltip({ label, children, side = 'bottom' }: { label: string; children: ReactNode; side?: TooltipSide }) {
  const id = useId();
  const child = isValidElement(children)
    ? (() => {
        const element = children as DescribedElement;
        const describedBy = [element.props['aria-describedby'], id].filter(Boolean).join(' ');
        return cloneElement(element, { 'aria-describedby': describedBy });
      })()
    : children;

  return (
    <span className={`app-tooltip app-tooltip-${side}`}>
      {child}
      <span className="app-tooltip-bubble" id={id} role="tooltip">
        {label}
      </span>
    </span>
  );
}
