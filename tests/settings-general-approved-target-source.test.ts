import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('approved Settings General source contract',()=>{
  it('implements the agreed tab architecture while keeping General as the first approved slice',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const styles=read('src/pages/SettingsPage.css');
    expect(source).toContain("import './SettingsPage.css'");
    for(const label of ['Γενικά','Λογαριασμός','Λογαριασμοί','Προϋπολογισμοί & Στόχοι','Κατηγορίες','Εικονίδια','Κανόνες','Δεδομένα'])expect(source).toContain(label);
    expect(source).toContain("useState<SettingsTab>('general')");
    expect(source).toContain('settings-general-grid');
    expect(styles).toContain('.settings-general-grid{display:grid');
  });

  it('uses only existing General capabilities and renders each analysis once',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const appShell=read('src/components/AppShell.tsx');
    const readability=read('src/components/ReadabilitySettings.tsx');
    const updates=read('src/components/DesktopUpdatePanel.tsx');
    const shortcuts=read('src/components/KeyboardShortcutsPanel.tsx');
    expect(source).toContain('<ReadabilitySettings');
    expect(source).toContain('<DesktopUpdatePanel />');
    expect(source.match(/<KeyboardShortcutsPanel \/>/g)).toHaveLength(1);
    expect(appShell).not.toContain('KeyboardShortcutsPanel');
    expect(readability).toContain('getThemePreference');
    expect(readability).toContain('setThemePreference');
    expect(updates).toContain('window.myFinHubDesktop');
    expect(updates).toContain('packageJson.version');
    expect(updates).not.toContain('lastChecked');
    expect(updates).not.toContain('Τελευταίος έλεγχος');
    expect(shortcuts).toContain('SHORTCUT_ORDER.map');
    expect(shortcuts).toContain('shortcutDisplay(id)');
  });

  it('preserves existing Settings functionality while future unsupported tabs stay truthful',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    expect(source).toContain('<AccountMetadataSettings data={data} />');
    expect(source).toContain('<BudgetRuleSettings');
    expect(source).toContain('<CategoryIconsWorkspace');
    expect(source).toContain('Εισαγωγή JSON');
    expect(source).toContain('Backup & λήψη');
    expect(source).toContain('technical-settings');
    expect(source).toContain("disabledReason: 'Η αλλαγή email και κωδικού δεν υποστηρίζεται ακόμη");
    expect(source).not.toContain('Αλλαγή email</button>');
    expect(source).not.toContain('Αλλαγή κωδικού</button>');
  });
});