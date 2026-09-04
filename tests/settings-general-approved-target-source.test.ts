import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('approved Settings source contract',()=>{
  it('keeps the verified General architecture while exposing the full Settings tab set',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const styles=read('src/pages/SettingsPage.css');
    expect(source).toContain("import './SettingsPage.css'");
    for(const label of ['Γενικά','Χρήστης & Πρόσβαση','Λογαριασμοί','Προϋπολογισμοί & Στόχοι','Κατηγορίες','Εικονίδια','Κανόνες','Δεδομένα'])expect(source).toContain(label);
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

  it('keeps user access useful with real auth mutations, compact PIN controls and device controls',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const account=read('src/components/AccountSecuritySettings.tsx');
    const devices=read('src/components/DeviceAccessSettings.tsx');
    expect(source).toContain('<AccountSecuritySettings');
    expect(source).toContain("label: 'Χρήστης & Πρόσβαση'");
    expect(account).toContain('changeAccountEmail');
    expect(account).toContain('changeAccountPassword');
    expect(account).toContain('Αλλαγή email');
    expect(account).toContain('Τρέχον email:');
    expect(account).toContain('Αλλαγή κωδικού');
    expect(account).toContain('const PIN_LENGTH=4');
    expect(account).toContain('PIN & αυτόματο κλείδωμα');
    expect(account).toContain('Κλείδωμα μετά από αδράνεια');
    expect(account).toContain('Κλείδωμα τώρα');
    expect(account).not.toContain('Τρέχον PIN');
    expect(account).toContain('<DeviceAccessSettings/>');
    expect(devices).toContain('Συνδεδεμένες συσκευές');
    expect(devices).toContain('Αφαίρεση όλων των άλλων');
    expect(source).not.toContain('Δεν υποστηρίζεται από αυτή τη σελίδα');
  });

  it('preserves existing Settings functionality and exposes real account management',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const accounts=read('src/components/AccountManagementSettings.tsx');
    const providerTaxonomy=read('src/lib/financialProviders.ts');
    const domain=read('src/lib/domain.ts');
    expect(source).toContain('<AccountManagementSettings');
    expect(accounts).toContain('Προεπιλεγμένοι λογαριασμοί');
    expect(accounts).toContain('Οι λογαριασμοί μου');
    expect(accounts).toContain('Νέος λογαριασμός');
    expect(accounts).toContain('CASH_ACCOUNT_TYPES.map');
    expect(providerTaxonomy).toContain("{id:'cash',label:'Μετρητά'}");
    expect(providerTaxonomy).toContain("{id:'reserve',label:'Καβάτζα'}");
    expect(accounts).not.toContain('RefreshCw');
    expect(domain).toContain('customAccounts');
    expect(domain).toContain('accountOverrides');
    expect(source).toContain('<BudgetRuleSettings');
    expect(source).toContain('<CategoryIconsWorkspace');
    expect(source).toContain('Εισαγωγή JSON');
    expect(source).toContain('Backup & λήψη');
    expect(source).toContain('technical-settings');
  });

  it('separates existing budgets, rules, taxonomy and icon capabilities into dedicated canonical views',()=>{
    const source=read('src/pages/SettingsPage.tsx');
    const budgetRules=read('src/components/BudgetRuleSettings.tsx');
    const categories=read('src/components/CategoryIconsWorkspace.tsx');
    expect(source).toContain("activeTab === 'icons'");
    expect(source).toContain("activeTab === 'rules'");
    expect(source).toContain('view="budgets"');
    expect(source).toContain('view="rules"');
    expect(source).toContain('view="taxonomy"');
    expect(source).toContain('view="icons"');
    expect(budgetRules).toContain("type BudgetRuleSettingsView='all'|'budgets'|'rules'");
    expect(budgetRules).toContain("open={view==='rules'?true:undefined}");
    expect(categories).toContain("type CategoryWorkspaceView='all'|'taxonomy'|'icons'");
    expect(categories).toContain("const showTaxonomy=view!=='icons'");
    expect(categories).toContain("const showIcons=view!=='taxonomy'");
  });
});
