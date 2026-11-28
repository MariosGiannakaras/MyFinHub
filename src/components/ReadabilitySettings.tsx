import { useEffect, useState, type KeyboardEvent } from 'react';
import { rovingTabDestination } from '../lib/rovingTabDestination';
import { getThemePreference, setThemePreference, subscribeThemePreference, type ThemePreference } from '../lib/theme';
import type { TextSizePreference } from '../types';
import { Surface } from './Surface';

const OPTIONS: Array<{ value: TextSizePreference; label: string; description: string }> = [
  { value: 'compact', label: 'Συμπαγές', description: 'Περισσότερο περιεχόμενο στην οθόνη.' },
  { value: 'normal', label: 'Κανονικό', description: 'Ισορροπημένη προεπιλογή για καθημερινή χρήση.' },
  { value: 'large', label: 'Μεγάλο', description: 'Μεγαλύτερα γράμματα και πιο άνετη ανάγνωση.' },
];

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'system', label: 'Σύστημα', description: 'Ακολουθεί αυτόματα το φωτεινό ή σκούρο θέμα της συσκευής.' },
  { value: 'light', label: 'Φωτεινό', description: 'Φωτεινό θέμα με ήπιες επιφάνειες και καθαρή αντίθεση.' },
  { value: 'dark', label: 'Σκούρο', description: 'Σκούρο θέμα σχεδιασμένο για άνετη ανάγνωση χωρίς υπερβολική αντίθεση.' },
];

function handleRadioKey(event:KeyboardEvent<HTMLDivElement>){
  const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role=radio]')];
  const active=(event.target as HTMLElement).closest('button[role=radio]');
  if(!active)return;
  const index=buttons.indexOf(active as HTMLButtonElement);
  const key=event.key==='ArrowDown'?'ArrowRight':event.key==='ArrowUp'?'ArrowLeft':event.key;
  const next=rovingTabDestination(key,index,buttons.length);
  if(next===null)return;
  event.preventDefault();
  buttons[next].focus();
  buttons[next].click();
}

export function ReadabilitySettings({ value = 'normal', onChange }: { value?: TextSizePreference; onChange: (value: TextSizePreference) => void }) {
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference());
  useEffect(() => subscribeThemePreference(setTheme), []);
  const chooseTheme = (next: ThemePreference) => {
    setThemePreference(next);
    setTheme(next);
  };

  return (
    <Surface as="section" variant="raised" className="panel readability-settings settings-general-appearance" aria-labelledby="readability-title">
      <div className="panel-head">
        <div>
          <span id="readability-title">Εμφάνιση</span>
          <small>Ρύθμισε το μέγεθος κειμένου και το θέμα με τις υπάρχουσες προτιμήσεις του MyFinHub.</small>
        </div>
      </div>

      <div className="settings-choice-group">
        <div className="settings-choice-copy">
          <b>Μέγεθος κειμένου</b>
          <small>Εφαρμόζεται σε όλη την εφαρμογή.</small>
        </div>
        <div className="text-size-picker" role="radiogroup" aria-label="Μέγεθος κειμένου" onKeyDown={handleRadioKey}>
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value === option.value}
              tabIndex={value === option.value ? 0 : -1}
              className={value === option.value ? 'active' : ''}
              title={option.description}
              onClick={() => onChange(option.value)}
            >
              <b>{option.label}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-choice-group">
        <div className="settings-choice-copy">
          <b>Θέμα</b>
          <small>Σύστημα, φωτεινό ή σκούρο θέμα χωρίς αλλαγή των οικονομικών δεδομένων.</small>
        </div>
        <div className="text-size-picker" role="radiogroup" aria-label="Θέμα εμφάνισης" onKeyDown={handleRadioKey}>
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              tabIndex={theme === option.value ? 0 : -1}
              className={theme === option.value ? 'active' : ''}
              title={option.description}
              onClick={() => chooseTheme(option.value)}
            >
              <b>{option.label}</b>
            </button>
          ))}
        </div>
      </div>
    </Surface>
  );
}
