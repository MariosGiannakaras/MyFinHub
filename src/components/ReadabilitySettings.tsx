import { useEffect, useState } from 'react';
import { getThemePreference, setThemePreference, subscribeThemePreference, type ThemePreference } from '../lib/theme';
import type { TextSizePreference } from '../types';

const OPTIONS: Array<{ value: TextSizePreference; label: string; description: string }> = [
  { value: 'compact', label: 'Συμπαγές', description: 'Περισσότερο περιεχόμενο στην οθόνη.' },
  { value: 'normal', label: 'Κανονικό', description: 'Ισορροπημένη προεπιλογή για καθημερινή χρήση.' },
  { value: 'large', label: 'Μεγάλο', description: 'Μεγαλύτερα γράμματα και πιο άνετη ανάγνωση.' },
];

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'system', label: 'Σύστημα', description: 'Ακολουθεί αυτόματα το Light/Dark θέμα της συσκευής.' },
  { value: 'light', label: 'Light', description: 'Φωτεινό θέμα με ήπιες επιφάνειες και καθαρή αντίθεση.' },
  { value: 'dark', label: 'Dark', description: 'Σκούρο θέμα σχεδιασμένο για άνετη ανάγνωση χωρίς υπερβολικό contrast.' },
];

export function ReadabilitySettings({ value = 'normal', onChange }: { value?: TextSizePreference; onChange: (value: TextSizePreference) => void }) {
  const [theme,setTheme]=useState<ThemePreference>(()=>getThemePreference());
  useEffect(()=>subscribeThemePreference(setTheme),[]);
  const chooseTheme=(next:ThemePreference)=>{setThemePreference(next);setTheme(next)};
  return (
    <section className="panel neo-raised readability-settings" aria-labelledby="readability-title">
      <div className="panel-head">
        <div>
          <span id="readability-title">Αναγνωσιμότητα</span>
          <small>Διάλεξε το μέγεθος κειμένου και το θέμα που διαβάζεις πιο άνετα. Οι επιλογές εφαρμόζονται χωρίς να αλλάζουν τα οικονομικά δεδομένα ή την τρέχουσα εργασία σου.</small>
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
      <div className="section-title" style={{marginTop:18}}><span>Θέμα εμφάνισης</span><b>System · Light · Dark</b></div>
      <div className="text-size-picker" role="radiogroup" aria-label="Θέμα εμφάνισης">
        {THEME_OPTIONS.map((option)=>(
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={theme===option.value}
            className={theme===option.value?'active':''}
            onClick={()=>chooseTheme(option.value)}
          >
            <b>{option.label}</b>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
