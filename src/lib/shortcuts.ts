export type ShortcutId = 'commandPalette' | 'quickEntry' | 'undo' | 'redo' | 'dismiss';

export type ShortcutKeyEvent = {
  key:string;
  ctrlKey:boolean;
  metaKey:boolean;
  shiftKey:boolean;
  altKey:boolean;
  repeat:boolean;
  defaultPrevented:boolean;
};

type ShortcutElementLike={
  closest?:(selectors:string)=>ShortcutElementLike|null;
  tagName?:string;
  type?:string;
  getAttribute?:(name:string)=>string|null;
};

export const SHORTCUT_ORDER: ShortcutId[] = ['commandPalette', 'quickEntry', 'undo', 'redo', 'dismiss'];

export const SHORTCUT_META: Record<ShortcutId, { label: string; description: string }> = {
  commandPalette: { label: 'Αναζήτηση / Command Palette', description: 'Ανοίγει την ενιαία αναζήτηση και τις διαθέσιμες εντολές.' },
  quickEntry: { label: 'Γρήγορη καταχώριση', description: 'Ανοίγει νέα γρήγορη οικονομική κίνηση από οποιαδήποτε ενότητα.' },
  undo: { label: 'Αναίρεση', description: 'Αναιρεί την τελευταία διαθέσιμη αλλαγή της τρέχουσας συνεδρίας.' },
  redo: { label: 'Επαναφορά', description: 'Επαναφέρει την τελευταία αλλαγή που αναιρέθηκε.' },
  dismiss: { label: 'Κλείσιμο παραθύρου / overlay', description: 'Κλείνει μόνο το επάνω dismissible παράθυρο ή overlay.' },
};

function currentPlatform() {
  if (typeof navigator === 'undefined') return '';
  return navigator.platform || navigator.userAgent || '';
}

export function isAppleShortcutPlatform(platform = currentPlatform()) {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function shortcutDisplay(id: ShortcutId, platform = currentPlatform()) {
  const apple = isAppleShortcutPlatform(platform);
  if (id === 'dismiss') return 'Esc';
  if (id === 'commandPalette') return apple ? '⌘ K' : 'Ctrl K';
  if (id === 'quickEntry') return apple ? '⌘ ⇧ Space' : 'Ctrl Shift Space';
  if (id === 'undo') return apple ? '⌘ Z' : 'Ctrl Z';
  return apple ? '⌘ ⇧ Z' : 'Ctrl Y';
}

function modPressed(event: ShortcutKeyEvent, apple: boolean) {
  return apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

export function shortcutMatches(event: ShortcutKeyEvent, id: ShortcutId, platform = currentPlatform()) {
  const key = event.key.toLowerCase();
  if (id === 'dismiss') return key === 'escape' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
  if (event.altKey) return false;
  const apple = isAppleShortcutPlatform(platform);
  if (!modPressed(event, apple)) return false;
  if (id === 'commandPalette') return key === 'k' && !event.shiftKey;
  if (id === 'quickEntry') return (key === ' ' || key === 'spacebar') && event.shiftKey;
  if (id === 'undo') return key === 'z' && !event.shiftKey;
  if (apple) return key === 'z' && event.shiftKey;
  return (key === 'y' && !event.shiftKey) || (key === 'z' && event.shiftKey);
}

export function appShortcutFromEvent(event: ShortcutKeyEvent, platform = currentPlatform()): Exclude<ShortcutId, 'dismiss'> | null {
  for (const id of ['commandPalette', 'quickEntry', 'undo', 'redo'] as const) {
    if (shortcutMatches(event, id, platform)) return id;
  }
  return null;
}

export function isEditableShortcutTarget(target: unknown) {
  const element=target as ShortcutElementLike|null;
  if(!element||typeof element.closest!=='function')return false;
  if(element.closest('[contenteditable="true"], [contenteditable="plaintext-only"]'))return true;
  const control=element.closest('input, textarea, select');
  if(!control)return false;
  const tag=(control.tagName??'').toLowerCase();
  if(tag!=='input')return true;
  const type=(control.type??control.getAttribute?.('type')??'text').toLowerCase();
  return !['button','submit','reset','checkbox','radio','range','color','file'].includes(type);
}

export function shouldBlockAppShortcut(context: { editable: boolean; modalOpen: boolean; repeat: boolean; defaultPrevented: boolean }) {
  return context.editable || context.modalOpen || context.repeat || context.defaultPrevented;
}
