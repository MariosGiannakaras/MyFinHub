# MyFinHub brand assets

This folder contains the canonical application artwork used by the web/PWA and Windows desktop clients.

The mark is **not newly designed artwork**. The source-of-truth is the original pre-rebrand RheomIQ wallet/`R` icon recovered byte-for-byte from repository history.

- `icon-192.png`: exact historical 192×192 source artwork (Git blob `803dec3521524d1054f6b542415fdbcc520c7041`).
- `icon-32.png`: native 32×32 favicon derivative generated from the authentic source.
- `icon-512.png`: native 512×512 Windows/PWA derivative generated from the authentic source.

Product-facing runtime copies live under `public/brand/` and `public/favicon.png`; `desktop/setup-brand.png` uses the same authentic 192×192 source.

The visible product name remains **MyFinHub**. Compatibility-critical legacy `rheomiq_*` database identifiers and `RHEOMIQ_*` local-backend protocol names are persistence/protocol contracts, not brand assets, and remain unchanged.
