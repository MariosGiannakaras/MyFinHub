# MyFinHub brand assets

This folder contains the canonical web/desktop deployment artwork for the current MyFinHub identity.

## Brand Kit v2 source

The current artwork was selected from the owner-supplied `MyFinHub_Brand_Kit_v2_REPACKED.zip` reviewed on 2026-09-29.

The approved identity uses the blue wallet / `MF` symbol with explicit theme variants:

- light application tile: near-white `#F6F8FB`;
- dark application tile: charcoal/navy `#171B24`;
- application icons are symbol-only;
- logo lockups may combine the symbol with the `MyFinHub` wordmark.

The supplied PNG set was validated successfully and the light/dark artwork was visually inspected at native and small icon sizes.

## Web/desktop runtime contract

Stable runtime paths are intentionally preserved so branding can be replaced without changing application components:

- `icon-light-32.png` / `icon-dark-32.png`: 32×32 browser derivatives.
- `icon-light-192.png` / `icon-dark-192.png`: 192×192 web/auth/setup derivatives.
- `icon-32.png` / `icon-192.png`: light-theme compatibility aliases.
- `icon-512.svg` / `icon-dark-512.svg`: existing scalable wrappers referencing the corresponding 192×192 PNG.
- `public/brand/`: runtime copies.
- `public/favicon.png`: byte-identical to the light 32×32 derivative.
- `desktop/setup-brand.png`: byte-identical to the dark 192×192 derivative.
- Windows packaging continues to generate its 512×512 application PNG from `public/brand/icon-light-192.png`.
- `src/components/BrandMark.tsx` remains the application-wide light/dark presentation contract.

The 32×32 and 192×192 deployment PNGs are byte-for-byte copies of the corresponding supplied Brand Kit v2 web assets.

### Provenance

Supplied Brand Kit v2 inputs used for web/desktop:

| Asset | Source SHA-256 | Deployment SHA-256 |
| --- | --- | --- |
| light 32×32 | `b7f0aa48d17ba4c28ee2ab5ce321f0d718b949c2a68537cc5c005f8ea487ba72` | same |
| dark 32×32 | `8bc5766f9ffe2b5fea8f8d6533c44799e855bd7c840136f37fb8606b393a9696` | same |
| light 192×192 | `cb4997bf177b192ad7dd5ff8d2980490f0f01c854163d354fe392847a6f43c3e` | same |
| dark 192×192 | `3493abbc2b07af4b2f48f76b9532b9abe2818ffc15751524964b954ef8e556c6` | same |

## SVG and duplicate audit

The Brand Kit v2 SVG files are syntactically valid SVG/XML, but they are raster-in-SVG containers: each embeds PNG artwork through a data URI rather than describing the artwork with vector paths. They therefore do not provide a true vector source or a useful quality advantage for the current runtime, and the large supplied containers are not duplicated into the deployment set.

The supplied `myfinhub-logo-vertical-light.png` is byte-identical to `myfinhub-logo-horizontal-light.png`, and the corresponding dark pair is also byte-identical. The mislabelled duplicate `vertical` copies are intentionally not retained as separate assets.

iOS and Android packaging assets from the kit are outside this repository's branding scope. Android implementation and assets remain owned by the separate Android repository.

Compatibility-critical legacy `rheomiq_*` database identifiers and `RHEOMIQ_*` local-backend protocol names are persistence/protocol contracts, not visual brand assets, and remain unchanged.
