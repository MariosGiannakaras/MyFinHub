import { ArrowDown, ArrowUp } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export function SortDirectionControl({ value, onChange, label = 'Κατεύθυνση ταξινόμησης' }: { value: SortDirection; onChange: (value: SortDirection) => void; label?: string }) {
  return (
    <div className="sort-direction-control" role="group" aria-label={label}>
      <button type="button" style={{ minHeight: 42 }} className={value === 'asc' ? 'active' : ''} aria-pressed={value === 'asc'} onClick={() => onChange('asc')}>
        <ArrowUp size={14} aria-hidden="true" /> ASC
      </button>
      <button type="button" style={{ minHeight: 42 }} className={value === 'desc' ? 'active' : ''} aria-pressed={value === 'desc'} onClick={() => onChange('desc')}>
        <ArrowDown size={14} aria-hidden="true" /> DESC
      </button>
    </div>
  );
}
