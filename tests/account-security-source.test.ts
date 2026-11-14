import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync(new URL('../src/components/AccountSecuritySettings.tsx',import.meta.url),'utf8');

describe('account security settings source contracts',()=>{
  it('validates the new password policy without imposing today\'s policy on the legacy current password',()=>{
    expect(source).toContain("if(!currentPassword){setAuthMessageTone('error');setAuthMessage('Συμπλήρωσε τον τρέχοντα κωδικό.')");
    expect(source).not.toContain('currentPassword.length<8');
    expect(source).toContain('accountPasswordPolicyError(newPassword)');
    expect(source).toContain('newPassword!==confirmPassword');
    expect(source).toContain('newPassword===currentPassword');
    expect(source).toContain("role={authMessageTone==='error'?'alert':'status'}");
    expect(source).toContain("aria-live={authMessageTone==='error'?'assertive':'polite'}");
    expect(source).toContain("role={pinMessageTone==='error'?'alert':'status'}");
    expect(source).toContain("aria-live={pinMessageTone==='error'?'assertive':'polite'}");
  });
  it('displays real owner-session/profile state and never fabricates device recency (#649 I15.04)',()=>{
    const ui=source;
    const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');
    const handler=readFileSync(new URL('../server/accountSecurityHandler.ts',import.meta.url),'utf8');
    const device=readFileSync(new URL('../src/components/DeviceAccessSettings.tsx',import.meta.url),'utf8');
    const deviceHandler=readFileSync(new URL('../server/deviceSessionsHandler.ts',import.meta.url),'utf8');
    const registry=readFileSync(new URL('../server/deviceSessionRegistry.ts',import.meta.url),'utf8');
    expect(settings).toContain('<AccountSecuritySettings currentEmail={currentEmail} />');
    expect(ui).toContain("getSession().then(session=>{if(alive)setDisplayEmail(session.email||'')})");
    expect(ui).toContain('const result=await changeAccountEmail(email)');
    expect(ui).toContain('if(result.pendingEmail)');
    expect(ui).toContain("setPendingEmail(result.pendingEmail)");
    expect(ui).toContain('await changeAccountPassword(currentPassword,newPassword)');
    expect(handler).toContain('requireSession(req, res)');
    expect(handler).toContain('isOwner(session.accessToken)');
    expect(handler).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(handler).toContain('assertMutationSessionOrigin(req, session)');
    expect(device).toContain('activityLabel(device.lastSeenAt)');
    expect(device).toContain("if(!Number.isFinite(timestamp))return 'Μη διαθέσιμη';");
    expect(device).not.toContain("return 'Πρόσφατα';");
    expect(deviceHandler).toContain('lastSeenAt: row.last_seen_at');
    expect(deviceHandler).toContain('firstSeenAt: row.first_seen_at');
    expect(deviceHandler).toContain('requireSession(req, res)');
    expect(deviceHandler).toContain('isOwner(session.accessToken)');
    expect(deviceHandler).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(deviceHandler).toContain('assertMutationSessionOrigin(req, session)');
    expect(registry).toContain('const TOUCH_INTERVAL_MS = 5 * 60_000');
  });

});
