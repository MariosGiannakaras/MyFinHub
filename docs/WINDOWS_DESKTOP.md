# RheomIQ for Windows

## Runtime model

The Windows edition is a packaged desktop client, not a PWA and not a shortcut to Vercel.

- Electron owns the native `RheomIQ` application window and Windows shortcuts.
- A bundled **Node.js 22.x** executable starts the existing Express backend as a hidden child process.
- The local backend binds only to `127.0.0.1` on an operating-system-selected ephemeral port. It is started before the window opens and stopped with the desktop process.
- The packaged Vite build is served from that local backend, so the renderer and API keep the same-origin HttpOnly-cookie boundary used by local web development.
- The local backend talks directly to the same Supabase project as the Vercel API, using `SUPABASE_URL`, the publishable key, the signed-in owner's JWT and PostgreSQL RLS. It does not need or receive a Supabase service-role key.
- Owner identity and TOTP `aal2` remain mandatory for finance reads/writes.

The Vercel application remains unchanged and continues to be the web/mobile client. Desktop and web are two clients of the same Supabase state and optimistic revision model.

## What synchronizes automatically

**Finance data does. Application code does not.**

Transactions, balances, cards, settings and other finance state live in the shared Supabase database. A successful save from either desktop or web writes the same canonical state; the other client reads that state on its normal load/reload path. Optimistic revision conflicts remain enabled, so an already-open stale client is not allowed to overwrite a newer save silently.

The React UI, Electron host and local Express backend are application code bundled into the installed Windows package. They are intentionally local so normal desktop use does not depend on Vercel. A code/UI/backend change therefore requires a new desktop build/release; it cannot safely be replaced at runtime by whatever JavaScript happens to be on Vercel without turning the desktop client back into a remote web shell.

## First installation from a repository checkout

Run from Windows by double-clicking:

```text
INSTALL_RHEOMIQ_WINDOWS.bat
```

The bootstrapper:

1. reads `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CARD_VAULT_KEY` and `CARD_VAULT_KEY_VERSION` from the process environment or the repository `.env` when available;
2. prompts only for missing required values and optionally for the card-vault key;
3. locates Node.js 22 or downloads the pinned Node.js 22 runtime and verifies the official SHA-256 manifest before use;
4. performs deterministic `npm ci` installs, security/tests, production build and Windows packaging;
5. writes a short-lived per-user provisioning file with a restricted ACL;
6. runs the NSIS installer, which creates the RheomIQ Desktop and Start Menu shortcuts;
7. on first launch Electron imports the card-vault key into Windows-protected Electron `safeStorage`/DPAPI and deletes the plaintext provisioning file.

Normal daily use after installation is simply the RheomIQ shortcut. No terminal, external browser, Vercel process, Node command or manual backend startup is required.

## Card-vault key

PAN/expiry ciphertext remains in the shared Supabase card vault. A desktop installation that needs to reveal or update those secrets must use the **same existing `CARD_VAULT_KEY` and key version** as the server-side Vercel runtime. Do not generate or rotate a replacement key merely for desktop installation; existing ciphertext would no longer be decryptable without a migration/re-encryption plan.

The Windows installer never commits the key, never writes it into the packaged app and never exposes it as a `VITE_*` value. After one-time provisioning, the local copy is encrypted with Windows-backed Electron `safeStorage`. CVV remains the separate device-local encrypted browser vault and is never sent to Supabase or the local backend.

If `CARD_VAULT_KEY` is intentionally omitted, the rest of RheomIQ can run, but server-vault PAN/expiry reveal/save is unavailable on that desktop until the key is provisioned.

## Updating application code

A repository checkout can always be rebuilt by rerunning:

```text
INSTALL_RHEOMIQ_WINDOWS.bat
```

That installs the code currently checked out locally. Git fetch/pull is needed only if the user chooses this source-build path and wants newer source code; it is **never** needed to synchronize finance data.

Once a signed desktop release has been published, the same BAT can update without Git or a source build:

```text
INSTALL_RHEOMIQ_WINDOWS.bat --latest
```

`--latest` downloads the newest GitHub Release x64 installer and its `.sha256` companion, verifies the checksum and reinstalls it. Runtime configuration and Windows-protected card-vault secrets are preserved in the per-user application-data directory.

## Signed release workflow

`.github/workflows/desktop-windows.yml` validates the Windows package on `windows-latest`, including the real packaged executable and local-backend startup. Normal PR validation produces a short-retention installer artifact but does not publish it.

A public desktop release must:

1. be based on a commit already present on `main`;
2. use a tag matching the desktop package version, for example `desktop-v1.0.0`;
3. have repository secrets `WINDOWS_SIGNING_PFX_BASE64` and `WINDOWS_SIGNING_PFX_PASSWORD` configured;
4. produce an Authenticode signature that Windows reports as `Valid` before the release is uploaded.

The workflow then publishes the signed installer plus SHA-256 checksum as a GitHub Release. It fails closed rather than publishing an unsigned update if signing credentials are missing.

A future in-app unattended updater can be layered on the same signed release channel. It should not be enabled by disabling Windows signature verification or by accepting unsigned replacement binaries.

## Development

Windows desktop development uses the same Node.js 22 project contract:

```text
npm ci
npm ci --prefix desktop
npm run desktop:dev
```

`desktop:dev` builds the web client, bundles the existing Express backend, uses the current Node 22 executable as the local backend runtime and launches Electron with the root `.env` configuration. The renderer still runs with `nodeIntegration: false`, `contextIsolation: true` and Electron sandboxing.

## Generated files

The following are build artifacts and stay out of Git:

```text
desktop/.build/
release/desktop/
```

Desktop runtime configuration is stored under the current Windows user's Electron application-data directory, not in the repository or Vercel.
