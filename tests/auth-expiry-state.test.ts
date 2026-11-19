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

  it('guards stale AAL2 responses after hard expiry and newer MFA refresh in the actual browser (#649 I03.03)',()=>{
    const hook=readFileSync(new URL('../src/hooks/useSession.ts',import.meta.url),'utf8');
    const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');
    const runtime=readFileSync(new URL('../scripts/ui-ux-runtime-qa.mjs',import.meta.url),'utf8');
    const workflow=readFileSync(new URL('../.github/workflows/fb-focused-rendered-qa.yml',import.meta.url),'utf8');
    expect(hook).toContain('const transitionEpoch = useRef(0)');
    expect(hook).toContain('if (epoch !== transitionEpoch.current) return false');
    expect(hook).toContain('++transitionEpoch.current;\n      clearAppUnlockToken();');
    // Both PIN capability invalidation and owner-scoped cache reset are
    // mandatory when authenticated AAL2 provenance is lost.
    expect(hook).toContain('if (!session.authenticated) {');
    expect(hook).toContain("clearAppUnlockToken();\n      window.dispatchEvent(new Event('myfinhub:auth-scope-reset'))");
    expect(qa).toContain('__myfinhubQaHoldNextSession');
    expect(qa).toContain('__myfinhubQaReleaseSession');
    expect(runtime).toContain('stale AAL2 response reopened expired workspace');
    expect(runtime).toContain('stale AAL2 response overrode MFA downgrade');
    expect(workflow).toContain('<!-- run-649-session-race-qa -->');
    expect(workflow).toContain("'ui-ux-runtime'");
  });

  it('keeps rendered MFA downgrade verification aligned with the current MFA challenge contract',()=>{
    const runtime=readFileSync('scripts/ui-ux-runtime-qa.mjs','utf8');
    expect(runtime).toContain("document.querySelector('#mfa-title')");
    expect(runtime).toContain("document.querySelector('#mfa-code')");
    expect(runtime).toContain("includes('Επαλήθευση')");
    expect(runtime).not.toContain("Έλεγχος δύο παραγόντων");
  });

});
