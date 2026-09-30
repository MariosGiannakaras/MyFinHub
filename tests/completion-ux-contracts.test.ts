import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('completion UX contracts',()=>{
  it('keeps mobile Quick Entry compact and reserves scroll clearance above fixed chrome',()=>{
    const quick=read('src/styles/command-palette-contextual-entry.css');
    const shell=read('src/styles/mobile-app-shell.css');
    expect(quick).toContain('.mobile-quick-action{display:grid;place-items:center');
    expect(quick).toContain('width:48px;height:48px');
    expect(quick).toContain('.mobile-quick-action>span{position:absolute;width:1px');
    expect(shell).toContain('padding-bottom:calc(146px + env(safe-area-inset-bottom,0px))');
    expect(shell).toContain('scroll-padding-bottom:calc(146px + env(safe-area-inset-bottom,0px))');
  });

  it('bounds Dashboard primary account cards on tablet',()=>{
    const css=read('src/styles/dashboard-bankmark-chart-attention.css');
    expect(css).toContain('@media(min-width:681px) and (max-width:980px)');
    expect(css).toContain('grid-auto-rows:max-content!important');
    expect(css).toContain('height:184px!important');
    expect(css).toContain('height:76px!important');
  });

  it('uses the existing bounded transaction page slice on mobile',()=>{
    const source=read('src/pages/TransactionsPage.tsx');
    expect(source).toContain('className="mobile-transaction-list"');
    expect(source).toContain('{pageRows.map(r=>');
    expect(source).not.toContain('aria-label={`Κινήσεις για ${month}`}>{rows.map');
    expect(source).toContain('className="mobile-transaction-pagination"');
    expect(source).toContain('setQuery(e.target.value);setPage(1)');
    expect(source).toContain('setSortDirection(value);setPage(1)');
  });

  it('renders lending history as semantic cards on phones instead of a squeezed table',()=>{
    const source=read('src/pages/LendingPage.tsx');
    const mobileStart=source.indexOf('className="mobile-lending-history"');
    expect(mobileStart).toBeGreaterThan(-1);
    const mobileTail=source.slice(mobileStart);
    expect(mobileTail).toContain('role="list"');
    expect(mobileTail).toContain('className="mobile-lending-history-row"');
    expect(mobileTail).not.toContain('className="semantic-table receivables-table"');
    expect(mobileTail).toContain('hidden={!privacyVisible}');
  });

  it('makes Cards an explicit phone snap carousel and keeps the active Settings tab visible',()=>{
    const cards=read('src/styles/cards-prototype-presentation.css');
    const settings=read('src/pages/SettingsPage.tsx');
    const settingsCss=read('src/pages/SettingsPage.css');
    expect(cards).toContain('scroll-snap-type:x mandatory');
    expect(cards).toContain('scroll-snap-stop:always');
    expect(settings).toContain("selected?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' })");
    expect(settings).toContain('aria-labelledby={`settings-tab-${activeTab}`}');
    expect(settingsCss).toContain('scroll-snap-type:x proximity');
    expect(settingsCss).toContain('mask-image:linear-gradient');
  });
});
