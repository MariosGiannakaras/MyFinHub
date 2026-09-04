import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../server/http.js';
import { parseAccountSecurityWrite } from '../server/accountSecurityHandler.js';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const code=(fn:()=>unknown)=>{try{fn();return ''}catch(error){return error instanceof ApiError?error.code:'UNKNOWN'}};

describe('account security settings',()=>{
  it('normalizes email changes and rejects invalid/extra fields',()=>{
    expect(parseAccountSecurityWrite({action:'email',email:' Owner@Example.COM '})).toEqual({action:'email',email:'owner@example.com'});
    expect(code(()=>parseAccountSecurityWrite({action:'email',email:'not-an-email'}))).toBe('INVALID_EMAIL');
    expect(code(()=>parseAccountSecurityWrite({action:'email',email:'owner@example.com',role:'admin'}))).toBe('INVALID_ACCOUNT_CHANGE');
  });

  it('requires a distinct current/new password pair',()=>{
    expect(parseAccountSecurityWrite({action:'password',currentPassword:'old-password',newPassword:'new-password'})).toEqual({action:'password',currentPassword:'old-password',newPassword:'new-password'});
    expect(code(()=>parseAccountSecurityWrite({action:'password',currentPassword:'short',newPassword:'new-password'}))).toBe('INVALID_CURRENT_PASSWORD');
    expect(code(()=>parseAccountSecurityWrite({action:'password',currentPassword:'same-password',newPassword:'same-password'}))).toBe('PASSWORD_UNCHANGED');
    expect(code(()=>parseAccountSecurityWrite({action:'password',currentPassword:'old-password',newPassword:'short'}))).toBe('INVALID_NEW_PASSWORD');
  });

  it('protects account mutations behind owner, AAL2 and same-origin session checks',()=>{
    const handler=read('server/accountSecurityHandler.ts');
    const route=read('api/auth/account.ts');
    expect(handler).toContain('requireSession(req, res)');
    expect(handler).toContain('isOwner(session.accessToken)');
    expect(handler).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(handler).toContain('assertMutationSessionOrigin(req, session)');
    expect(handler).toContain("current_password: change.currentPassword");
    expect(handler).toContain("`${url}/auth/v1/user`");
    expect(route).toContain('handleAccountSecurityRequest');
    expect(handler).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(handler).not.toContain('SUPABASE_SECRET_KEY');
  });

  it('keeps the desktop PIN local, salted, slow-hashed and DPAPI protected',()=>{
    const appLock=read('desktop/app-lock-main.cjs');
    const preload=read('desktop/preload.cjs');
    const bootstrap=read('desktop/bootstrap.cjs');
    const desktopPackage=read('desktop/package.json');
    expect(appLock).toContain("const PIN_PATTERN = /^\\d{6}$/");
    expect(appLock).toContain('crypto.randomBytes(16)');
    expect(appLock).toContain('crypto.scrypt');
    expect(appLock).toContain('crypto.timingSafeEqual');
    expect(appLock).toContain('safeStorage.encryptString');
    expect(appLock).toContain('safeStorage.decryptString');
    expect(appLock).toContain("'app-lock.json'");
    expect(appLock).not.toContain('localStorage');
    expect(appLock).not.toContain('indexedDB');
    expect(preload).toContain('getAppLockState: () =>');
    expect(preload).toContain('verifyAppPin: (pin) =>');
    expect(preload).toContain('setAppPin: (value) =>');
    expect(preload).toContain('disableAppPin: (pin) =>');
    expect(bootstrap).toContain('registerAppLockIpc()');
    expect(desktopPackage).toContain('app-lock-main.cjs');
  });

  it('gates only already-authenticated desktop sessions before App renders',()=>{
    const gate=read('src/components/DesktopAppLockGate.tsx');
    const main=read('src/main.tsx');
    expect(gate).toContain('getAppLockState');
    expect(gate).toContain('getSession');
    expect(gate).toContain("session.authenticated?'locked':'unlocked'");
    expect(gate).toContain("'myfinhub:app-lock-now'");
    expect(gate).toContain('verifyAppPin');
    expect(main).toContain('<DesktopAppLockGate><App/></DesktopAppLockGate>');
  });
});
