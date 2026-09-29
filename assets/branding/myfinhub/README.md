# MyFinHub brand assets

This folder contains the canonical web/desktop artwork for the current MyFinHub identity.

## Pure Vector source

The current canonical artwork comes from the owner-supplied `MyFinHub_Brand_Kit_PureVector.zip`, reviewed on 2026-09-29.

The approved identity uses the blue wallet / `MF` symbol with explicit light and dark application tiles.

## Vector verification

The SVGs used here are true, self-contained vector artwork.

Independent inspection confirmed that the canonical app/logo SVGs contain paths, shapes, gradients and SVG filters, with:

- no `<image>` elements;
- no embedded base64 PNG/JPEG payloads;
- no external image/file references;
- no text/font dependencies;
- no scripts.

The light and dark app-icon SVGs each contain 11 paths, 7 rectangles, 2 circles and 10 gradients. Rendering those SVG masters at 32×32 produces pixels identical to the supplied 32×32 PNG exports.

## Canonical masters

- `icon-512.svg`: light application icon, true vector master.
- `icon-dark-512.svg`: dark application icon, true vector master.
- `symbol.svg`: transparent standalone wallet / MF symbol.
- `logo-light.svg`: square light logo lockup.
- `logo-dark.svg`: square dark logo lockup.
- `logo-horizontal.svg`: transparent horizontal lockup usable on light or dark surfaces.

The source kit's horizontal light/dark SVGs are byte-identical. Its files named `vertical-light` and `vertical-dark` are also byte-identical to that same horizontal artwork and use the same 1800×650 viewBox, so those mislabelled duplicates are intentionally not retained.

## Runtime derivatives

Stable runtime paths are preserved so the branding refresh does not disturb unrelated application behavior:

- `icon-light-32.png` / `icon-dark-32.png`: supplied 32×32 vector exports.
- `icon-light-192.png` / `icon-dark-192.png`: supplied 192×192 vector exports.
- `icon-light-512.png` / `icon-dark-512.png`: supplied 512×512 vector exports.
- `icon-32.png` / `icon-192.png`: light-theme compatibility aliases.
- `public/brand/icon-512.svg` / `icon-dark-512.svg`: runtime copies of the true vector app masters.
- `public/favicon.png`: byte-identical to the light 32×32 export.
- `desktop/setup-brand.png`: byte-identical to the dark 192×192 export.
- `src/components/BrandMark.tsx`: renders the true vector light/dark app masters.
- Windows packaging uses the supplied 512×512 light PNG export from the vector master instead of enlarging the 192×192 derivative.

### Source SHA-256

| Asset | SHA-256 |
| --- | --- |
| light app SVG | `47fbe6c11a2660cb0ea07e82fb17e4193a33d449e39f5dac54ab3b92c79c5b3a` |
| dark app SVG | `77371a2d05a8e67528771a9b1fbf59e2b4c5b703c0e4f198bec6bb5268a42141` |
| symbol SVG | `91e5d8058e4874bc21bde0d1ace80782df0c8ec5d6ef8edd9f10b6904100940c` |
| light square logo SVG | `f8231c73d6f84d42b96d144ee4d1dff7d145553f9e629b985caa9bd99abe66dc` |
| dark square logo SVG | `e2c3153f28c8ad91743e3688a97576bcae9dec88a777ff9a2108c6380205396d` |
| horizontal logo SVG | `c564a01c7ea368f161e3f52201ac8e4449264e215a4358041003d6cdd3b693e5` |
| light 32×32 PNG | `0f5e21c0b3e09ad744f5a3b9b2f7df4b88aea4aef8db5a3563374ca5c418028d` |
| dark 32×32 PNG | `7dee23b9e7223d9a8351cf312958f4ab5ec42879ac5566fd22748ebcde539d46` |
| light 192×192 PNG | `13ae3f111b9e03bd45a3622cc745abe4374c006c9888106b4117a8ac858377f2` |
| dark 192×192 PNG | `43cc32b1540e03a1aedb827782d5e02c9b0a79ce0c445c27fb27aef2d1e53ac9` |
| light 512×512 PNG | `5e1d00a9f73afd2986db24f766a2b1c7c6cd05165bfaa22b306c8bf21f4becde` |
| dark 512×512 PNG | `22083c29f4be5ee0d8df075b330496846b2e52c6a6544b041d560ac8ced1f764` |

iOS and Android packaging assets from the kit are outside this repository's branding scope. Android implementation and assets remain owned by the separate Android repository.

Compatibility-critical legacy `rheomiq_*` database identifiers and `RHEOMIQ_*` local-backend protocol names are persistence/protocol contracts, not visual brand assets, and remain unchanged.
