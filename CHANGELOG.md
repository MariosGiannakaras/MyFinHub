# Changelog

All notable MyFinHub changes are recorded here. Release artifacts remain available from [GitHub Releases](https://github.com/MariosGiannakaras/MyFinHub/releases).

## [Unreleased]

### Changed

- Restored the authentic original wallet/`R` application mark from pre-rebrand repository history across browser, PWA, setup and Windows packaging assets.
- Replaced the repository README with an application-style landing page containing a prominent Windows download, release links, checksum access, installation instructions and user-facing feature overview.
- Added this maintained changelog.

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

[Unreleased]: https://github.com/MariosGiannakaras/MyFinHub/compare/myfinhub-v1.0.0...develop
[1.0.0]: https://github.com/MariosGiannakaras/MyFinHub/releases/tag/myfinhub-v1.0.0
