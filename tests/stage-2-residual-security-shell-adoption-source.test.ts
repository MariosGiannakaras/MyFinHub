import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell=readFileSync(new URL('../src/components/AppShell.tsx',import.meta.url),'utf8');
const login=readFileSync(new URL('../src/components/LoginScreen.tsx',import.meta.url),'utf8');
const mfa=readFileSync(new URL('../src/components/MfaScreen.tsx',import.meta.url),'utf8');

describe('Stage 2 residual security and shell action adoption',()=>{
  it('uses shared primitives for the global Quick Add and history close while preserving shell semantics',()=>{
    expect(shell).toContain("from './Button'");
    expect(shell).toContain("from './IconButton'");
    expect(shell).toContain('<Button type="button" variant="primary" data-global-quick-entry="desktop"');
    expect(shell).toContain('onClick={onQuickAdd}');
    expect(shell).toContain('<IconButton type="button" aria-label="Κλείσιμο ιστορικού"');
    expect(shell).toContain('onClick={()=>setHistoryOpen(false)}');
    expect(shell).not.toContain('primary-action');
    expect(shell).not.toContain('<button type="button" className="icon-button" aria-label="Κλείσιμο ιστορικού"');
  });

  it('uses shared primary Button for login submit without changing submit or disabled behavior',()=>{
    expect(login).toContain("from './Button'");
    expect(login).toContain('<Button variant="primary" className="login-submit" type="submit" disabled={busy||!ready}');
    expect(login).toContain('onSubmit={submit}');
    expect(login).toContain('if(busy||!ready)return');
    expect(login).not.toContain('primary-action');
    expect(login).toContain('className="login-password-toggle"');
  });

  it('uses shared primary Button for MFA enrollment and verification while preserving auth guards',()=>{
    expect(mfa).toContain("from './Button'");
    expect(mfa.match(/<Button variant="primary"/g)).toHaveLength(2);
    expect(mfa).toContain('<Button variant="primary" className="login-submit" type="button" disabled={busy} aria-busy={busy} onClick={startEnrollment}>');
    expect(mfa).toContain('<Button variant="primary" className="login-submit" type="submit" disabled={busy || code.length !== 6}');
    expect(mfa).toContain('if (busy || !/^\\d{6}$/.test(code)) return');
    expect(mfa).toContain('await onVerify(code, enrollment?.factorId)');
    expect(mfa).toContain('className="ghost-button login-logout"');
    expect(mfa).not.toContain('primary-action');
  });
});
