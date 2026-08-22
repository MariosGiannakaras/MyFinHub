import { Keyboard } from 'lucide-react';
import { SHORTCUT_META, SHORTCUT_ORDER, shortcutDisplay } from '../lib/shortcuts';

export function KeyboardShortcutsPanel(){
  return <section className="panel neo-raised keyboard-shortcuts-panel" aria-labelledby="keyboard-shortcuts-title">
    <div className="panel-head"><div><span id="keyboard-shortcuts-title">Keyboard Shortcuts</span><small>Οι συντομεύσεις λειτουργούν σε όλη την εφαρμογή όταν δεν γράφεις σε πεδίο και δεν υπάρχει άλλο modal που πρέπει να κρατήσει το focus.</small></div><Keyboard aria-hidden="true"/></div>
    <div className="keyboard-shortcut-list" role="list" aria-label="Διαθέσιμες συντομεύσεις πληκτρολογίου">
      {SHORTCUT_ORDER.map(id=><div className="keyboard-shortcut-row" role="listitem" key={id}><div><b>{SHORTCUT_META[id].label}</b><small>{SHORTCUT_META[id].description}</small></div><kbd>{shortcutDisplay(id)}</kbd></div>)}
    </div>
    <p className="keyboard-shortcut-note">Μέσα σε input, textarea ή άλλο editable πεδίο διατηρούνται οι native συντομεύσεις επεξεργασίας. Το Esc χειρίζεται μόνο το επάνω dismissible παράθυρο.</p>
  </section>;
}
