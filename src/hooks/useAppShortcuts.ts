import { useEffect } from 'react';
import { appShortcutFromEvent, isEditableShortcutTarget, shouldBlockAppShortcut } from '../lib/shortcuts';

function hasVisibleModal() {
  return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].some((element) => element.isConnected && element.getClientRects().length > 0);
}

export function useAppShortcuts({ onCommand, onQuickEntry, onUndo, onRedo, canUndo, canRedo }:{
  onCommand: () => void;
  onQuickEntry: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = appShortcutFromEvent(event);
      if (!shortcut) return;

      // Keep one app-wide shortcut authority. This runs at the window bubble
      // boundary after focused controls have seen the key, but before older
      // page-level listeners can also act on the same combination.
      event.stopImmediatePropagation();

      const editable = isEditableShortcutTarget(event.target) || isEditableShortcutTarget(document.activeElement);
      if (shouldBlockAppShortcut({
        editable,
        modalOpen: hasVisibleModal(),
        repeat: event.repeat,
        defaultPrevented: event.defaultPrevented,
      })) return;

      if (shortcut === 'commandPalette') {
        event.preventDefault();
        onCommand();
        return;
      }
      if (shortcut === 'quickEntry') {
        event.preventDefault();
        onQuickEntry();
        return;
      }
      if (shortcut === 'undo' && canUndo && onUndo) {
        event.preventDefault();
        onUndo();
        return;
      }
      if (shortcut === 'redo' && canRedo && onRedo) {
        event.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCommand, onQuickEntry, onUndo, onRedo, canUndo, canRedo]);
}
