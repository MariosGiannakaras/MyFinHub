import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyAuthExpired } from '../src/lib/authExpiry.js';
import { readFileSync } from 'node:fs';

describe('client auth-state expiry signals',()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it('signals hard expiry only for 401 auth/device revocation',()=>{
    const dispatchEvent=vi.fn();
    vi.stubGlobal('window',{dispatchEvent});
    notifyAuthExpired(401,'AUTH_REQUIRED');
    notifyAuthExpired(401,'DEVICE_ACCESS_REVOKED');
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    expect(dispatchEvent.mock.calls.every(([event])=>event.type==='rheomiq:auth-expired')).toBe(true);
  });

  it('signals MFA resynchronization for protected 403 without treating it as logout',()=>{
    const dispatchEvent=vi.fn();
    vi.stubGlobal('window',{dispatchEvent});
    notifyAuthExpired(403,'MFA_REQUIRED');
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0][0].type).toBe('rheomiq:mfa-required');
  });

  it('ignores unrelated 4xx responses',()=>{
    const dispatchEvent=vi.fn();
    vi.stubGlobal('window',{dispatchEvent});
    notifyAuthExpired(403,'FORBIDDEN');
    notifyAuthExpired(409,'REVISION_CONFLICT');
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('wires MFA-required events to a session refresh rather than stale authenticated UI',()=>{
    const source=readFileSync(new URL('../src/hooks/useSession.ts',import.meta.url),'utf8');
    expect(source).toContain("window.addEventListener('rheomiq:mfa-required', mfaRequired)");
    expect(source).toContain('const mfaRequired = () => { void refresh(); };');
    expect(source).toContain("window.removeEventListener('rheomiq:mfa-required', mfaRequired)");
  });

  it('keeps rendered MFA downgrade verification aligned with the current MFA challenge contract',()=>{
    const runtime=readFileSync('scripts/ui-ux-runtime-qa.mjs','utf8');
    expect(runtime).toContain("document.querySelector('#mfa-title')");
    expect(runtime).toContain("document.querySelector('#mfa-code')");
    expect(runtime).toContain("includes('Επαλήθευση')");
    expect(runtime).not.toContain("Έλεγχος δύο παραγόντων");
  });

});
