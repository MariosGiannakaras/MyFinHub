import type { TextSizePreference } from '../types';

const OPTIONS: Array<{ value: TextSizePreference; label: string; description: string }> = [
  { value: 'compact', label: 'Συμπαγές', description: 'Περισσότερο περιεχόμενο στην οθόνη.' },
  { value: 'normal', label: 'Κανονικό', description: 'Ισορροπημένη προεπιλογή για καθημερινή χρήση.' },
  { value: 'large', label: 'Μεγάλο', description: 'Μεγαλύτερα γράμματα και πιο άνετη ανάγνωση.' },
];

export function ReadabilitySettings({ value = 'normal', onChange }: { value?: TextSizePreference; onChange: (value: TextSizePreference) => void }) {
  return (
    <section className="panel neo-raised readability-settings" aria-labelledby="readability-title">
      <div className="panel-head">
        <div>
          <span id="readability-title">Αναγνωσιμότητα</span>
          <small>Διάλεξε το μέγεθος κειμένου που διαβάζεις πιο άνετα. Η επιλογή εφαρμόζεται σε όλη την εφαρμογή και αποθηκεύεται αυτόματα.</small>
        </div>
      </div>
      <div className="text-size-picker" role="radiogroup" aria-label="Μέγεθος κειμένου">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            <b>{option.label}</b>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
