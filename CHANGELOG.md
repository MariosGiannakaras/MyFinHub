# Changelog

All notable MyFinHub changes are recorded here. Release artifacts remain available from [GitHub Releases](https://github.com/MariosGiannakaras/MyFinHub/releases).

## [Unreleased]

## [1.0.2] - 2026-08-20

### Fixed

- Restored the user-supplied Cards v15 prototype as the visual and interaction contract for the Cards workspace instead of redesigning card geometry, bank stacking, icons or core interactions.
- Removed the effective per-bank card cap so any number of active cards can coexist under the same bank.
- Archive/restore now preserves the same card identity and recoverable secret state: PAN/expiry remain in the encrypted server vault and same-device CVV remains in the encrypted local vault instead of being deleted on archive.
- Multiple active credit cards can now coexist with independent per-card limits, debt, available balance, purchases, repayments and history.
- Legacy credit events created before card IDs existed remain financially readable through deterministic backward-compatible attribution; production history is not destructively rewritten.

### Security

- CVV/CVC remains rejected by every server request and persistence boundary and is never written to FinanceData, Supabase, backups, logs or analytics.
- PAN/expiry continue to use the owner + AAL2 encrypted card vault with explicit deletion support.

### Validation

- Added regression coverage for 3+ cards under one bank, multiple active credit identities, per-card credit debt/limits, legacy event attribution and card-state validation.
- The feature branch passed application/API checks, 136 unit/server tests, rendered frontend QA, CodeQL and the real Windows package gate including packaged `MyFinHub.exe` smoke, interactive NSIS Setup and SHA-256 verification.

### Notes

- v1.0.2 changes card persistence/functionality while preserving the supplied Cards presentation contract. The only conditional credit-page UI addition is a selector when more than one credit card exists, because a target card must be chosen for per-card debt and transactions.
- The Windows build remains unsigned for personal use, so Windows may display Unknown publisher / Microsoft Defender SmartScreen.

## [1.0.1] - 2026-08-20

### Changed

- Restored the authentic original wallet/`R` application mark from pre-rebrand repository history across browser, PWA, setup and Windows packaging assets.
- Replaced the repository README with an application-style landing page containing a prominent Windows download, release links, checksum access, installation instructions and user-facing feature overview.
- Added this maintained changelog and documented the provenance of the authentic application artwork.

### Notes

- v1.0.1 is a branding/documentation patch over v1.0.0; finance data, database schema and authentication boundaries are unchanged.
- The Windows build remains unsigned for personal use, so Windows may display Unknown publisher / Microsoft Defender SmartScreen.

## [1.0.0] - 2026-08-19

### Added

- First controlled MyFinHub Windows desktop release.
- Interactive NSIS installer producing `MyFinHub-Setup-1.0.0-x64.exe`.
- Standalone `MyFinHub.exe` Electron host with bundled Node.js runtime and hidden local Express backend.
- First-run desktop configuration flow for Supabase connectivity and optional card-vault key import.
- Controlled in-app desktop updater backed by GitHub Releases with exact installer/checksum asset matching and SHA-256 verification.
- Shared Cards/Credit identity, credit-card workspace, loans/installments flows and recurring finance integration.
- MyFinHub visible product naming across the web/PWA and Windows desktop surfaces while retaining compatibility-critical legacy persistence/protocol identifiers.

### Security

- Owner-only finance access remains protected by Supabase Auth, mandatory TOTP MFA/AAL2 checks and PostgreSQL RLS.
- PAN/expiry remain in the ciphertext-only card vault; CVV remains device-local.
- Windows release validation includes packaged executable startup/backend smoke, NSIS Setup build and installer checksum verification.

### Notes

- v1.0.0 is an unsigned personal-use Windows build. Windows may display Unknown publisher / Microsoft Defender SmartScreen.

[Unreleased]: https://github.com/MariosGiannakaras/MyFinHub/compare/myfinhub-v1.0.2...develop
[1.0.2]: https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.0.2
[1.0.1]: https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.0.1
[1.0.0]: https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.0.0