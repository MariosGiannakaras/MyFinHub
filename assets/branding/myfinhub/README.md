# MyFinHub brand assets

This folder contains the canonical runtime artwork for the current MyFinHub identity. The previous pre-rebrand RheomIQ wallet/`R` artwork is no longer a runtime source.

## Owner-supplied source set

The four source images supplied during the 2026-08-21 branding pass are JPEG/JFIF byte streams even though the client upload names used `.png`. Their source dimensions and SHA-256 fingerprints are:

- light square — 1536×1536 — `7ea970d91a5d0a01eaec49b8546e6d555ae60ea099644bc6c7265aabcf6c3a02`
- dark square — 1536×1536 — `02466161914d0836bb8336a043e402583751f5569ec360bf135d6bf0df059dc0`
- light horizontal wordmark — 1536×512 — `a82df276af4a5319daf2259ff8e51f6b660444699bea04b432b18eb122e7e69a`
- dark horizontal wordmark — 1536×512 — `8e3c3236ebd972d017de2c273623486e52ef8deb364c5b9e5b91a62047093d5d`

The source files have no alpha channel. Transparent runtime derivatives were generated from the supplied artwork; the source fingerprints above are the provenance record and must not be replaced by regenerated files.

## Runtime contract

- `icon-light-32.png` / `icon-dark-32.png`: native favicon-size derivatives.
- `icon-light-192.png` / `icon-dark-192.png`: native web/auth/setup derivatives.
- `icon-32.png` / `icon-192.png`: light-theme compatibility aliases.
- `icon-512.svg` / `icon-dark-512.svg`: scalable 512 wrappers referencing the corresponding 192 derivative; the web manifest uses the light wrapper.
- `public/brand/` contains the runtime copies.
- `public/favicon.png` is byte-identical to the light 32 derivative.
- `desktop/setup-brand.png` is byte-identical to the dark 192 derivative.
- Windows packaging generates its 512×512 PNG icon from `public/brand/icon-light-192.png` using high-quality System.Drawing interpolation during the packaging job.
- `src/components/BrandMark.tsx` is the application-wide light/dark presentation contract. Theme switching is explicit through `html[data-theme="light|dark"]`; it does not infer a dark logo from the operating-system preference while the application surface is still light.

The supplied horizontal images remain the design reference for the MyFinHub lockup. Runtime shell/auth lockups use the new square artwork together with the product word treatment so they remain responsive and theme-safe at small application sizes.

Compatibility-critical legacy `rheomiq_*` database identifiers and `RHEOMIQ_*` local-backend protocol names are persistence/protocol contracts, not visual brand assets, and remain unchanged.
