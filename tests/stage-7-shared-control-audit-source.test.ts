import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),'utf8');

const security=read('src/components/AccountSecuritySettings.tsx');
const devices=read('src/components/DeviceAccessSettings.tsx');
const accounts=read('src/components/AccountManagementSettings.tsx');
const desktopLock=read('src/components/DesktopAppLockGate.tsx');
const settings=read('src/pages/SettingsPage.tsx');
const workspaceCompat=read('src/styles/workspace-compat.css');
const securityStyles=read('src/components/AccountSecuritySettings.css');
const ibanStyles=read('src/styles/account-iban-surfaces.css');

describe('Stage 7 shared-control and compatibility cleanup audit',()=>{
  it('moves generic account-security controls onto shared text and action primitives',()=>{
    expect(security).toContain("from './AppTextInput'");
    expect(security).toContain("from './Button'");
    expect(security.match(/<AppTextInput\b/g)).toHaveLength(6);
    expect(security.match(/<Button\b/g)).toHaveLength(5);
    expect(security).not.toMatch(/<input\b/);
    expect(security).not.toMatch(/<button\b/);
    expect(security).toContain('type="email"');
    expect(security).toContain('autoComplete="current-password"');
    expect(security).toContain('inputMode="numeric"');
    expect(securityStyles).toContain('.account-security-field>.app-text-input');
    expect(securityStyles).toContain('.account-security-pin-input>.app-text-input');
    expect(securityStyles).not.toContain('.account-security-field>input');
  });

  it('moves generic device actions onto shared buttons without changing device semantics',()=>{
    expect(devices).toContain("from './Button'");
    expect(devices).toContain("from './IconButton'");
    expect(devices).toContain('<IconButton type="button" aria-label="Ανανέωση συσκευών"');
    expect(devices).toContain('<Button type="button" variant="secondary" className="device-access-revoke"');
    expect(devices).toContain('<Button type="button" variant="secondary" className="danger-text"');
    expect(devices).not.toMatch(/<button\b/);
  });

  it('uses shared actions for generic account-management buttons while retaining semantic composites raw',()=>{
    expect(accounts).toContain("from './Button'");
    expect(accounts).toContain("from './IconButton'");
    expect(accounts).toContain('<Button type="button" variant="primary" className="account-management-create"');
    expect(accounts).toContain('<IconButton type="button" className="danger-text"');
    expect(accounts).toContain('title="Διαγραφή"');
    expect(accounts).toContain('<IconButton type="button" aria-label="Κλείσιμο"');
    expect(accounts).toContain('<Button type="button" variant="secondary" disabled={busy} onClick={closeEditor}>Ακύρωση</Button>');
    expect(accounts).toContain('<Button type="button" variant="primary" disabled={busy} onClick={()=>void save()}>');
    expect(accounts).toContain('<button type="button" data-autofocus="true"');
    expect(accounts).toContain('VISIBLE_CASH_ACCOUNT_TYPES.map(type=><button');
    expect(accounts).toContain('className="account-management-edit"');
    expect(accounts).toContain('className="account-management-delete-modal"');
  });

  it('uses shared Settings data actions and keeps the tab/file composites native',()=>{
    expect(settings).toContain("from '../components/Button'");
    expect(settings).toContain('<Button className="settings-data-action-button" variant="secondary"');
    expect(settings.match(/<Button className="settings-data-action-button"/g)).toHaveLength(2);
    expect(settings.match(/<button\b/g)).toHaveLength(1);
    expect(settings).toContain('role="tab"');
    expect(settings).toContain('<input ref={fileRef} type="file"');
  });

  it('uses the shared text/action primitives at the desktop lock boundary while retaining the PIN digit composite',()=>{
    expect(desktopLock).toContain("from './AppTextInput'");
    expect(desktopLock).toContain("from './Button'");
    expect(desktopLock).toContain('<AppTextInput ref={inputRef} className="desktop-app-lock-input"');
    expect(desktopLock).toContain('<Button type="button" variant="secondary" onClick={()=>location.reload()}>Δοκιμή ξανά</Button>');
    expect(desktopLock).toContain('<button type="button" className="desktop-app-lock-digits"');
    expect(desktopLock).not.toMatch(/<input\b/);
  });

  it('removes deleted account-metadata settings CSS while preserving live IBAN presentation',()=>{
    expect(workspaceCompat).toContain("@import './account-iban-surfaces.css';");
    expect(workspaceCompat).not.toContain('account-metadata-surfaces.css');
    expect(ibanStyles).toContain('.account-iban{');
    expect(ibanStyles).toContain('.primary-balance-card .account-iban');
    expect(ibanStyles).not.toMatch(/account-metadata-(?:settings|list|row|identity)/);
    expect(fs.existsSync(path.join(root,'src/styles/account-metadata-surfaces.css'))).toBe(false);
  });
});
