import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('approved Settings source contract',()=>{
  it('keeps the verified General architecture while exposing the full Settings tab set',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const styles=read('src/pages/SettingsPage.css');
    expect(source).toContain("import './SettingsPage.css'");
    for(const label of ['Γενικά','Λογαριασμός','Λογαριασμοί','Προϋπολογισμοί & Στόχοι','Κατηγορίες','Εικονίδια','Κανόνες','Δεδομένα'])expect(source).toContain(label);
    expect(source).toContain("useState<SettingsTab>('general')");
    expect(source).toContain('settings-general-grid');
    expect(styles).toContain('.settings-general-grid{display:grid');
    expect(source).not.toContain('disabledReason:');
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

  it('preserves existing Settings functionality while unsupported account mutations stay truthful',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    expect(source).toContain('<AccountMetadataSettings data={data} />');
    expect(source).toContain('<BudgetRuleSettings');
    expect(source).toContain('<CategoryIconsWorkspace');
    expect(source).toContain('Εισαγωγή JSON');
    expect(source).toContain('Backup & λήψη');
    expect(source).toContain('technical-settings');
    expect(source).toContain('settings-profile-card');
    expect(source).toContain('Δεν υποστηρίζεται από αυτή τη σελίδα');
    expect(source).not.toContain('Αλλαγή email</button>');
    expect(source).not.toContain('Αλλαγή κωδικού</button>');
  });

  it('separates existing rules and icon capabilities into dedicated tabs without duplicating domain logic',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const styles=read('src/pages/SettingsPage.css');
    const budgetRules=read('src/components/BudgetRuleSettings.tsx');
    expect(source).toContain("activeTab === 'icons'");
    expect(source).toContain("activeTab === 'rules'");
    expect(source).toContain('settings-icons-only');
    expect(source).toContain('settings-rules-only');
    expect(source).toContain('view="budgets"');
    expect(source).toContain('view="rules"');
    expect(budgetRules).toContain("type BudgetRuleSettingsView='all'|'budgets'|'rules'");
    expect(budgetRules).toContain("open={view==='rules'?true:undefined}");
    expect(styles).toContain('.settings-categories-only .taxonomy-icon-disclosure{display:none}');
    expect(styles).toContain('.settings-icons-only .taxonomy-row-actions');
  });
});
