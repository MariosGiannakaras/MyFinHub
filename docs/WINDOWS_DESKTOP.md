# MyFinHub for Windows

## Runtime model

The Windows edition is a packaged desktop client, not a PWA and not a shortcut to Vercel.

- Electron owns the native `MyFinHub` application window, executable and Windows shortcuts.
- A bundled **Node.js 22.x** executable starts the existing Express backend as a hidden child process.
- The local backend binds only to `127.0.0.1` on an operating-system-selected ephemeral port. It is started by the desktop host and stopped with the application.
- The packaged Vite build is served from that local backend, preserving the same-origin HttpOnly-cookie boundary used by the existing local runtime.
- The backend talks directly to the same Supabase project as the Vercel API through the publishable key, authenticated owner JWT and PostgreSQL RLS. Service-role/secret credentials are removed from the desktop runtime environment.
- Owner identity and mandatory TOTP `aal2` remain required for finance reads/writes.

The Vercel application remains the web/mobile client. Desktop and web are two clients of the same canonical Supabase state and optimistic revision model.

Compatibility-critical legacy internal names such as `RHEOMIQ_DESKTOP_READY`, other `RHEOMIQ_*` local-backend environment variables and existing `rheomiq_*` database objects intentionally remain unchanged. They are protocol/persistence identifiers, not visible product branding.

## What synchronizes automatically

**Finance data synchronizes through Supabase; installed application code is updated through desktop releases.**

Transactions, balances, cards, settings and the rest of the finance state use the shared Supabase database. A successful save from desktop or web writes the same canonical state. Optimistic revisions prevent a stale already-open client from silently overwriting a newer save.

The React bundle, Electron host and local Express backend are intentionally local so ordinary desktop use does not depend on Vercel. UI/backend changes therefore arrive as a new Windows release, while finance data never needs Git fetches or reinstallations.

## Normal installation

The release artifact is a standard interactive NSIS installer:

```text
MyFinHub-Setup-<version>-x64.exe
```

It installs per Windows user by default, creates **Desktop** and **Start Menu** shortcuts and launches MyFinHub when installation finishes. The executable is `MyFinHub.exe` and the desktop identity is `app.myfinhub.desktop`.

On first launch, if local runtime configuration is missing, MyFinHub opens its own setup window instead of requiring a terminal. The setup UI shows steps, an animated progress/status surface and a live explanation of the background work: configuration validation, Windows-protected secret storage, local-backend startup and final application launch. UI motion respects `prefers-reduced-motion`.

Required configuration:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Optional card-secret support additionally uses the **existing** shared values:

```text
CARD_VAULT_KEY
CARD_VAULT_KEY_VERSION
```

The card-vault key is encrypted through Electron `safeStorage` / Windows DPAPI for the current Windows account. It is never compiled into the package, sent to the renderer bundle or committed to Git. CVV remains the separate device-local encrypted vault and never enters the server-side desktop boundary.

## In-app updates

A packaged MyFinHub installation checks the controlled GitHub Release channel automatically after startup and periodically while running. Automatic checks **do not** force a download or installation.

The Windows section in **Ρυθμίσεις** exposes the current version and update state. When a newer release is available the user explicitly chooses:

1. **Λήψη ενημέρωσης**
2. after verification, **Εγκατάσταση & επανεκκίνηση**

The updater accepts only a tightly controlled release shape:

- release tag `myfinhub-v<semver>`;
- exact asset `MyFinHub-Setup-<version>-x64.exe`;
- exact companion `MyFinHub-Setup-<version>-x64.exe.sha256`;
- GitHub/release-asset HTTPS hosts only;
- bounded installer size;
- streamed SHA-256 verification before the installer can become ready.

It never accepts an arbitrary update URL or an unverified binary. Update progress is shown in-app and on the Windows taskbar. Installation closes the running app only after verification, starts the installer and then relaunches MyFinHub.

## Unsigned personal-use releases

A paid Windows code-signing certificate is **not required** for this personal-use application. The release workflow supports unsigned builds and records that fact explicitly. The tradeoff is normal Windows reputation behavior: an unsigned build may show **Unknown publisher** or Microsoft SmartScreen, particularly on first installation or after a new build.

Authenticode signing remains optional. If both signing repository secrets are later configured, the same workflow signs and verifies the installer before publishing it. Partial signing configuration fails the release rather than silently falling back.

Integrity for both signed and unsigned updates is still enforced by the controlled GitHub Release source, strict naming/allowlisting and SHA-256 verification described above.

## Release workflow

`.github/workflows/desktop-windows.yml` validates the Windows package on a real `windows-latest` runner. PR validation includes:

- deterministic root + desktop dependency installation;
- security/test/build gates;
- PowerShell fallback-bootstrap validation;
- unpacked Windows package build;
- real `MyFinHub.exe` process smoke with the hidden local backend;
- interactive NSIS Setup build;
- installer size/checksum validation;
- short-retention installer/checksum artifacts as CI evidence.

A public desktop release is produced only from a tag such as:

```text
myfinhub-v1.0.0
```

The tagged commit must already be present on `main` and the tag version must match `desktop/package.json`. The release then publishes the installer plus its `.sha256` companion.

## Source-build fallback

The repository keeps a fallback bootstrap for development/recovery:

```text
INSTALL_MYFINHUB_WINDOWS.bat
```

This can build/install the checked-out source and can locate or download a verified Node.js 22 build runtime. It is **not** required for ordinary released installations.

The fallback `--latest` mode remains available for recovery or machines where the application cannot start:

```text
INSTALL_MYFINHUB_WINDOWS.bat --latest
```

Normal users should use `MyFinHub-Setup-*.exe` once and then the in-app updater. Git and Node are not required on the user machine for that path.

## Development and generated files

Windows desktop development:

```text
npm ci
npm ci --prefix desktop
npm run desktop:dev
```

Generated packaging output remains outside Git:

```text
desktop/.build/
release/desktop/
```

Canonical MyFinHub brand assets used by browser/PWA/desktop builds are also kept in the repository under:

```text
assets/branding/myfinhub/
```
