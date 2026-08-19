import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('Windows desktop source contract',()=>{
  it('keeps the renderer isolated from Node and manages a loopback-only backend',()=>{
    const main=read('desktop/main.cjs');
    expect(main).toContain("const LOOPBACK = '127.0.0.1'");
    expect(main).toContain("env.RHEOMIQ_PORT = '0'");
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).toContain('webSecurity: true');
    expect(main).toContain('windowsHide: true');
    expect(main).toContain('delete env.SUPABASE_SECRET_KEY');
    expect(main).toContain('delete env.SUPABASE_SERVICE_ROLE_KEY');
    expect(main).toContain('safeStorage.encryptString');
    expect(main).not.toContain('nodeIntegration: true');
  });

  it('uses the existing server with an actual ephemeral port and packaged dist path',()=>{
    const server=read('server/index.ts');
    expect(server).toContain("process.env.RHEOMIQ_DIST_DIR?.trim()");
    expect(server).toContain("process.env.RHEOMIQ_DESKTOP === '1'");
    expect(server).toContain('listener.address()');
    expect(server).toContain('RHEOMIQ_DESKTOP_READY=');
  });

  it('creates normal Windows shortcuts and never packages runtime secrets',()=>{
    const manifest=JSON.parse(read('desktop/package.json'));
    expect(manifest.build.nsis.createDesktopShortcut).toBe('always');
    expect(manifest.build.nsis.createStartMenuShortcut).toBe(true);
    expect(manifest.build.extraResources).toEqual(expect.arrayContaining([
      expect.objectContaining({to:'app/dist'}),
      expect.objectContaining({to:'app/server/server.mjs'}),
      expect.objectContaining({to:'app/runtime/node.exe'}),
    ]));
    const serialized=JSON.stringify(manifest);
    expect(serialized).not.toMatch(/SUPABASE_(SECRET|SERVICE_ROLE)|CARD_VAULT_KEY/);
  });

  it('verifies bootstrap downloads and limits plaintext provisioning to a one-time user file',()=>{
    const installer=read('desktop/install-windows.ps1');
    expect(installer).toContain("Get-FileHash -Algorithm SHA256");
    expect(installer).toContain("SHASUMS256.txt");
    expect(installer).toContain("pending-provision.json");
    expect(installer).toContain('Protect-FileForCurrentUser');
    expect(installer).toContain('Remove-PendingProvision');
    expect(installer).not.toMatch(/sb_secret_[A-Za-z0-9_-]{8,}/);
  });
});
