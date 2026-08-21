import { describe, expect, it } from 'vitest';
import { appShortcutFromEvent, isAppleShortcutPlatform, shortcutDisplay, shortcutMatches, shouldBlockAppShortcut } from '../src/lib/shortcuts';

const key=(value:string,patch:Partial<KeyboardEvent>={})=>({key:value,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,repeat:false,defaultPrevented:false,...patch} as KeyboardEvent);

describe('app-wide keyboard shortcuts',()=>{
  it('uses platform-aware conventional search, undo and redo combinations',()=>{
    expect(shortcutMatches(key('k',{ctrlKey:true}),'commandPalette','Win32')).toBe(true);
    expect(shortcutMatches(key('k',{metaKey:true}),'commandPalette','MacIntel')).toBe(true);
    expect(shortcutMatches(key('z',{ctrlKey:true}),'undo','Win32')).toBe(true);
    expect(shortcutMatches(key('y',{ctrlKey:true}),'redo','Win32')).toBe(true);
    expect(shortcutMatches(key('z',{ctrlKey:true,shiftKey:true}),'redo','Win32')).toBe(true);
    expect(shortcutMatches(key('z',{metaKey:true,shiftKey:true}),'redo','MacIntel')).toBe(true);
  });

  it('uses a dedicated non-browser quick-entry chord',()=>{
    expect(shortcutMatches(key(' ',{ctrlKey:true,shiftKey:true}),'quickEntry','Win32')).toBe(true);
    expect(shortcutMatches(key(' ',{metaKey:true,shiftKey:true}),'quickEntry','MacIntel')).toBe(true);
    expect(appShortcutFromEvent(key(' ',{ctrlKey:true,shiftKey:true}),'Win32')).toBe('quickEntry');
  });

  it('keeps escape unmodified for topmost-modal dismissal',()=>{
    expect(shortcutMatches(key('Escape'),'dismiss','Win32')).toBe(true);
    expect(shortcutMatches(key('Escape',{ctrlKey:true}),'dismiss','Win32')).toBe(false);
  });

  it('blocks app actions while editing, while a modal is open, on repeats or when already handled',()=>{
    expect(shouldBlockAppShortcut({editable:true,modalOpen:false,repeat:false,defaultPrevented:false})).toBe(true);
    expect(shouldBlockAppShortcut({editable:false,modalOpen:true,repeat:false,defaultPrevented:false})).toBe(true);
    expect(shouldBlockAppShortcut({editable:false,modalOpen:false,repeat:true,defaultPrevented:false})).toBe(true);
    expect(shouldBlockAppShortcut({editable:false,modalOpen:false,repeat:false,defaultPrevented:true})).toBe(true);
    expect(shouldBlockAppShortcut({editable:false,modalOpen:false,repeat:false,defaultPrevented:false})).toBe(false);
  });

  it('renders platform-appropriate hints for tooltips and Settings',()=>{
    expect(isAppleShortcutPlatform('MacIntel')).toBe(true);
    expect(shortcutDisplay('commandPalette','Win32')).toBe('Ctrl K');
    expect(shortcutDisplay('quickEntry','Win32')).toBe('Ctrl Shift Space');
    expect(shortcutDisplay('redo','MacIntel')).toBe('⌘ ⇧ Z');
    expect(shortcutDisplay('dismiss','MacIntel')).toBe('Esc');
  });
});
