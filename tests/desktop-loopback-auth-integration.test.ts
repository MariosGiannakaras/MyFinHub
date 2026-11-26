import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs the actual bundled-server entrypoint in the same production-mode
// HTTP loopback configuration that packaged Windows passes to Express.
// No real credentials, Supabase network calls or financial state are involved.
describe('packaged Windows synthetic local authentication boundary (#641)', () => {
  it('reaches local login/MFA/logout handlers while rejecting cross-origin posts', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'myfinhub-auth-loopback-'));
    writeFileSync(join(tempDir, 'index.html'), '<!doctype html><title>QA</title>');
    writeFileSync(join(tempDir, '404.html'), '<!doctype html><title>QA 404</title>');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      RHEOMIQ_DESKTOP: '1',
      RHEOMIQ_HOST: '127.0.0.1',
      RHEOMIQ_PORT: '0',
      RHEOMIQ_DIST_DIR: tempDir,
      SUPABASE_URL: 'https://desktop-auth-qa.invalid',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_only',
    };
    delete env.SUPABASE_SECRET_KEY;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.CARD_VAULT_KEY;
    const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--serve-dist'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let diagnostics = '';
    const ready = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Synthetic Windows auth backend did not reach readiness')), 15_000);
      server.stdout.on('data', chunk => {
        const output = String(chunk);
        const match = /RHEOMIQ_DESKTOP_READY=(http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      server.stderr.on('data', chunk => { diagnostics = (diagnostics + String(chunk)).slice(-1200); });
      server.on('error', error => { clearTimeout(timer); reject(error); });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('Synthetic auth backend exited: ' + code + ' ' + diagnostics)); });
    });
    try {
      const origin = await ready;
      const post = async (route: string, requestOrigin = origin, site = 'same-origin') => {
        const response = await fetch(origin + route, {
          method: 'POST',
          headers: {
            origin: requestOrigin,
            'sec-fetch-site': site,
            'content-type': 'application/json',
          },
          // Invalid fixture is rejected before any upstream authentication request.
          body: JSON.stringify({ email: 'invalid-fixture', password: 'invalid' }),
          signal: AbortSignal.timeout(4000),
        });
        return { status: response.status, body: await response.json() };
      };
      const health = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(4000) });
      expect(health.status).toBe(200);
      const login = await post('/api/auth/login');
      expect(login.status).toBe(401);
      expect(login.body.code).toBe('INVALID_CREDENTIALS');
      const mfa = await post('/api/auth/mfa/verify');
      expect(mfa.status).toBe(401);
      expect(mfa.body.code).toBe('INVALID_MFA_CODE');
      const logout = await post('/api/auth/logout');
      expect(logout.status).toBe(200);
      expect(logout.body.authenticated).toBe(false);
      const otherPort = await post('/api/auth/login', origin.replace(/:\d+$/, ':65534'));
      expect(otherPort.status).toBe(403);
      expect(otherPort.body.code).toBe('ORIGIN_MISMATCH');
      const crossSite = await post('/api/auth/login', 'https://other.example', 'cross-site');
      expect(crossSite.status).toBe(403);
      expect(crossSite.body.code).toBe('CROSS_SITE_REQUEST');
    } finally {
      server.kill();
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 25_000);
});
