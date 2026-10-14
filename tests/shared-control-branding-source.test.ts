import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const controls=read('src/styles/app-controls.css');
const theme=read('src/styles/theme-surface-foundations.css');
const auth=read('src/styles/auth-session-shell.css');
const login=read('src/components/LoginScreen.tsx');
const mfa=read('src/components/MfaScreen.tsx');
const quick=read('src/styles/quick-entry-desktop-composition.css');
const quickBase=read('src/styles/quick-entry-body-split.css');
const security=read('src/components/AccountSecuritySettings.css');

describe('shared form-control branding',()=>{
  it('owns default geometry and semantic states in one shared contract',()=>{
    expect(theme).toContain('--control-height:47px;--control-radius:12px');
    expect(controls).toContain('.app-control,.app-input-shell{box-sizing:border-box;width:100%;min-height:var(--control-height)');
    expect(controls).toContain('border:1px solid var(--control-border,#8096b3);border-radius:var(--control-radius);background:var(--control-bg,var(--surface))');
    expect(controls).toContain('.app-control:focus-visible,.app-input-shell:focus-within');
    expect(controls).not.toContain('.app-input-shell>.app-control{min-width:0;flex:1;min-height:calc(var(--control-height) - 2px);height:calc(var(--control-height) - 2px);border:0!important;border-radius:0;padding:0;background:transparent!important;box-shadow:none!important}');
    expect(controls).toContain('.app-control[aria-invalid=true],.app-input-shell[data-invalid=true]');
  });

  it('keeps Login and MFA on shared shells without auth-local box styling',()=>{
    expect(login).toContain('<AppInputShell className="login-input"');
    expect(mfa).toContain('<AppInputShell className="login-input mfa-code-shell"');
    expect(auth).not.toContain('.login-input{');
    expect(auth).not.toContain('.login-input input{');
  });

  it('keeps money and security text fields on the shared box owner',()=>{
    expect(controls).toContain('.money-input>.app-control{padding-right:34px');
    expect(quickBase).not.toContain('.money-input{height:');
    expect(security).toContain('.account-security-field>.app-text-input{width:100%}');
    expect(security).not.toMatch(/\.account-security-field>\.app-text-input\{[^}]*\b(?:min-height|border|border-radius|padding|background|box-shadow):/);
  });

  it('lets Quick Entry keep floating labels while inheriting shared box geometry',()=>{
    expect(quick).toContain('.generic-quick-modal{--qe-field-h:var(--control-height)}');
    expect(quick).not.toContain('--qe-font');
    expect(quick).not.toContain('--qe-field-h:47px');
    expect(quick).not.toContain('--qe-field-h:46px');
  });
});
