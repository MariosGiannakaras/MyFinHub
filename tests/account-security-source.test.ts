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
});
