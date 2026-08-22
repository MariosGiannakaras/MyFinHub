# Windows startup diagnostics and recovery

MyFinHub for Windows keeps the desktop host, local Express backend and packaged frontend on the local machine. The first-run setup connects that installation to the same Supabase project used by the web application.

## First-run sequence

The setup window now reports the real main-process stages rather than an estimated renderer-only animation:

1. validate the Supabase URL, publishable/anon key and optional card-vault key format;
2. perform an HTTPS preflight against the configured Supabase Auth endpoint using the publishable/anon key;
3. persist public Supabase configuration for the current Windows account;
4. encrypt a newly supplied `CARD_VAULT_KEY` through Electron `safeStorage` / Windows DPAPI;
5. start the bundled Node.js local backend on `127.0.0.1` and wait for its authenticated readiness marker;
6. load the packaged MyFinHub frontend from that loopback backend.

The setup window closes only after those stages complete successfully.

## Recovery behavior

A startup failure no longer immediately quits with a generic dialog. The setup window remains available (or is reopened for an existing installation) with:

- a stable error code;
- the failing stage;
- a user-facing explanation;
- bounded technical detail captured from the local backend where relevant;
- a button to copy safe diagnostics;
- editable Supabase configuration and a normal retry path.

Leaving `CARD_VAULT_KEY` blank during a retry preserves an already stored encrypted key. Supplying a new key replaces the locally stored encrypted value for subsequent card-vault operations; it does not migrate ciphertext that was created with a different key.

## Startup codes

Current startup classifications include:

- `CONFIG_INVALID` / `CONFIG_LOAD_FAILED` / `CONFIG_WRITE_FAILED` — invalid, unreadable or unwritable desktop configuration;
- `SUPABASE_PREFLIGHT_REJECTED` — Supabase rejected the URL/key combination;
- `SUPABASE_PREFLIGHT_TIMEOUT` / `SUPABASE_PREFLIGHT_FAILED` / `SUPABASE_PREFLIGHT_UNAVAILABLE` — network/project preflight failure;
- `SECURE_STORAGE_UNAVAILABLE` / `SECURE_STORAGE_WRITE_FAILED` / `SECURE_STORAGE_READ_FAILED` — Windows DPAPI / Electron safe-storage boundary failure;
- `DESKTOP_RUNTIME_MISSING` — bundled `node.exe` is missing, for example after an incomplete install or local security software quarantine;
- `DESKTOP_BUNDLE_INCOMPLETE` — packaged server/frontend resources are incomplete;
- `BACKEND_SPAWN_FAILED` / `BACKEND_STARTUP_TIMEOUT` / `BACKEND_EXITED_DURING_STARTUP` — local backend process failed before readiness;
- `BACKEND_STOPPED` — the backend stopped after it had reached readiness;
- `WINDOW_LOAD_FAILED` — Electron could not load the packaged frontend from the ready loopback backend;
- `PENDING_PROVISION_FAILED` — a controlled first-run provision file could not be applied.

## Diagnostic privacy

Copied diagnostics are intentionally local and minimal. The diagnostic formatter redacts:

- the exact publishable key supplied during setup;
- `sb_publishable_*` and `sb_secret_*` key-shaped values;
- bearer tokens and JWT-shaped values;
- 64-character hexadecimal key material, including the supported hex form of `CARD_VAULT_KEY`.

The startup diagnostic path does not persist backend stderr, finance data, PAN/expiry/CVV, authentication cookies/tokens or card-vault plaintext. Captured backend output is bounded in memory and used only to explain the current failure.

## Reinstallation

Use a verified GitHub Release installer if a diagnostic reports a missing runtime or incomplete bundle. Reinstallation is not the default advice for configuration or network errors: correct the shown configuration/preflight problem and retry from the setup window first.
