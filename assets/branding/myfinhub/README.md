# MyFinHub brand assets

This directory contains the canonical web/desktop artwork for the owner-approved MyFinHub PureVector identity.

## Source and vector verification

The source is `MyFinHub_Brand_Kit_PureVector.zip`, reviewed on 2026-09-29. The canonical SVGs are real self-contained vector artwork made from SVG paths/shapes, gradients and filters. They contain no `<image>` elements, embedded PNG/JPEG/base64 payloads, external image references, font dependencies or scripts. Rendering the supplied app-icon SVG masters at 32×32 matches the supplied 32×32 PNG exports pixel-for-pixel.

The source kit's horizontal light/dark SVG lockups are byte-identical. Files labelled `vertical-light` and `vertical-dark` contain the same 1800×650 horizontal artwork, so those duplicate/mislabelled files are not retained.

## Canonical masters

- `app-icon-light.svg` / `app-icon-dark.svg`: exact supplied 1024×1024 light/dark app-icon vector masters.
- `symbol.svg`: exact transparent wallet / MF symbol vector.
- `logo-light.svg` / `logo-dark.svg`: square logo lockups.
- `logo-horizontal.svg`: the single non-duplicate horizontal lockup.
- `favicon-light.svg` / `favicon-dark.svg`: browser aliases of the corresponding true-vector app masters.
- `icon-512.svg` / `icon-dark-512.svg`: true-vector 512×512 runtime presentations.

## Platform asset matrix

Browser tabs use the true SVG light/dark favicons when supported, with 32×32 and 16×16 PNG fallbacks. `public/favicon.png` remains a 32×32 compatibility alias.

PWA installation keeps explicit 192×192 and 512×512 PNG `any` icons plus the scalable SVG icon. Dedicated `icon-maskable-192.png` and `icon-maskable-512.png` use the transparent PureVector symbol on a full-bleed `#F6F8FB` field with the artwork kept inside the maskable safe region. The normal precomposed app tile is deliberately not mislabeled as `maskable`.

Windows packaging gives electron-builder the true-vector `public/brand/icon-512.svg`, allowing it to generate the Windows ICO size set from vector input. The packaged/runtime BrowserWindow icon remains `public/brand/icon-512.png`, byte-identical to the supplied light 512×512 export, because the runtime consumes a native bitmap path. `desktop/setup-brand.png` remains the dark 192×192 setup/recovery mark. No upscaling from 192×192 is performed.

`src/components/BrandMark.tsx` renders the light/dark true-vector app artwork for in-application branding.

## Compatibility aliases

Stable paths `icon-32.png`, `icon-192.png`, `public/favicon.png` and `public/brand/icon-512.png` are retained where they protect existing browser/desktop call sites. They are exact aliases, not independent artwork.

Android-specific adaptive/themed/store assets are maintained in `MariosGiannakaras/MyFinHub-Android-App`. iOS assets are intentionally excluded: MyFinHub currently targets only web/PWA, Windows desktop and Android.

Compatibility-critical `rheomiq_*` database identifiers and `RHEOMIQ_*` desktop/backend protocol variables are persistence/protocol contracts rather than visible branding and remain unchanged.
