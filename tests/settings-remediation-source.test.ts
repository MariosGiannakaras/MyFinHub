import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/pages/SettingsPage.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const routing=readFileSync(new URL('../src/lib/routing.ts',import.meta.url),'utf8');
const dialog=readFileSync(new URL('../src/components/DialogShell.tsx',import.meta.url),'utf8');
const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
const rendered=readFileSync(new URL('../scripts/settings-tabs-qa.mjs',import.meta.url),'utf8');
const finance=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');

describe('Settings post-v1.4 remediation contracts',()=>{
  it('keeps legacy motion data inert and makes OS reduced motion authoritative',()=>{
    expect(settings).toContain('const {motion:_legacyMotion,...persisted}=settings');
    expect(settings).not.toContain("motion: 'full'");
    expect(app).not.toContain("savingsTargetRate:rate,motion:'full'");
    expect(app).not.toContain("settings: { ...settings, motion: 'full' }");
    expect(app).toContain("document.documentElement.dataset.motion = 'full'");
    expect(dialog).toContain('const reduce=Boolean(systemReduced)');
    expect(dialog).not.toContain("motionMode==='reduced'");
    expect(qa).toContain("document.documentElement.dataset.motion='full'");
    expect(qa).toContain("if(params.get('motion')==='reduced')next.state.settings.motion='reduced'");
    expect(finance).toContain('const {motion:_legacyMotion,...settings}=migrated.state.settings');
    expect(finance).not.toContain("motion:'full'");
    const completion=readFileSync(new URL('../scripts/ui-ux-completion-qa.mjs',import.meta.url),'utf8');
    expect(completion).toContain("name:'prefers-reduced-motion',value:'reduce'");
    expect(completion).toContain("reducedMotionState.system&&reducedMotionState.app==='full'");
    expect(completion).toContain('OS reduced motion leaves workspace at rest');
    expect(completion).not.toContain("navigate({page:'dashboard',motion:'reduced'}");

  });

  it('makes all seven Settings tabs addressable through canonical hash routes',()=>{
    expect(routing).toContain("SETTINGS_TAB_IDS=['general','profile','accounts','categories','icons','rules','data']");
    expect(routing).toContain("return {page:'settings',notFound:false,settingsTab:sectionPart as SettingsTabId}");
    expect(routing).toContain("export function settingsHash(tab:SettingsTabId)");
    expect(app).toContain("const [settingsTab,setSettingsTab]=useState<SettingsTabId>(initialRoute.settingsTab??'general')");
    expect(app).toContain('const navigateSettingsTab=(tab:SettingsTabId)=>');
    expect(app).toContain("setSettingsTab(next.settingsTab??'general')");
    expect(app).toContain('activeTab={settingsTab} onActiveTabChange={navigateSettingsTab}');
    expect(settings).toContain('const activeTab=controlledTab??localTab');
  });

  it('bounds Settings workspace measure at wide desktop sizes',()=>{
    expect(css).toContain('.settings-tabs-page{gap:16px;width:min(100%,1680px);margin-inline:auto}');
    expect(css).toContain('.settings-tab-panel{min-width:0;width:min(100%,1540px);margin-inline:auto}');
    expect(css).toContain('width:min(100%,1320px);margin-inline:auto');
  });

  it('keeps support diagnostics out of the product-default baseline',()=>{
    expect(settings).not.toContain('runtimeEnv?.DEV');
    expect(settings).toContain("VITE_MYFINHUB_SUPPORT_DIAGNOSTICS==='1'");
    expect(settings).toContain("get('support-diagnostics')==='1'");
    expect(rendered).toContain('product-default Settings baseline excludes support diagnostics');
    expect(rendered).toContain("support-diagnostics','1'");
  });

  it('directly covers every Settings tab in Light/Dark and bounded wide desktop evidence',()=>{
    expect(rendered).toContain("const tabs=[");
    expect(rendered).toContain("assert((await applyTheme('light'))==='light'");
    expect(rendered).toContain("assert((await applyTheme('dark'))==='dark'");
    expect(rendered).toContain("settings-${tab.id}-dark-desktop");
    expect(rendered).toContain("[1920,1080,'1920'],[2560,1440,'2560']");
    expect(rendered).toContain('geometry.page<=1681&&geometry.panel<=1541');
    expect(rendered).toContain('settings-diagnostics-explicit-desktop');
  });
});
