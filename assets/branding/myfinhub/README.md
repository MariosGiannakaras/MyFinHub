# MyFinHub brand assets

This folder contains the canonical MyFinHub artwork used by the web/PWA and Windows desktop clients.

- `icon-32.png`: compact browser/favicon asset with the wallet + MF mark only.
- `icon-192.png`: compact PWA/setup asset with the wallet + MF mark only.
- `icon-512.png`: high-resolution Windows/PWA application artwork.

The compact variants intentionally omit the long wordmark so the mark remains readable at taskbar, Start Menu and browser-tab sizes. Product-facing runtime copies live under `public/brand/` and `public/favicon.png`; this folder is the easy-to-find source pack inside the repository.

Compatibility-critical legacy `rheomiq_*` database identifiers and `RHEOMIQ_*` local-backend protocol names are not brand assets and remain unchanged by the rebrand.
