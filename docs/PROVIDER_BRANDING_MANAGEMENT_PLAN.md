# Provider Branding Management Plan — #481

## Goal

Make provider branding owner-managed from MyFinHub itself. Existing providers can have their artwork replaced without a repo change or redeploy, and a newly created provider can be created together with the artwork required by account/card surfaces.

**Tasks 5/5 · Subtasks 18/18**

## 1. Provider asset model + secure write API — 4/4

- [x] Return every active provider asset (`logo`, `wordmark`, `card-mark`) with role, variant and public Storage URL while keeping the current primary `logoUrl` / `wordmarkUrl` compatibility fields.
- [x] Add owner+AAL2 create-only provider mutation plus explicit asset/primary updates using the authenticated user's JWT; duplicate provider IDs fail closed and never silently overwrite an existing provider.
- [x] Add bounded binary upload/replace through the existing `/api/account-metadata` function family. Validate provider id, role, variant, MIME, filename, path and size before forwarding bytes to Supabase Storage.
- [x] Register uploaded assets and safely update primary logo/wordmark selection. Existing primary assets remain valid until a replacement upload and metadata write both succeed.

## 2. Runtime asset selection — 3/3

- [x] Theme-aware account/provider surfaces: prefer universal, then resolved light/dark, then primary/fallback.
- [x] Card surfaces: select `card-mark` by the actual card background contrast rather than global app theme.
- [x] Keep graceful fallback order so incomplete custom providers never render a broken image.

## 3. Settings provider management — 4/4

- [x] Add provider-management UI with previews for current logo/wordmark/card variants and Replace actions.
- [x] Support Logo Universal/Light/Dark, Wordmark Light/Dark and Card Mark Light/Dark uploads with progress/error/success states.
- [x] Add create-provider metadata flow for bank/fintech/wallet/payment.
- [x] In the same creation flow, let the owner select the provider images before saving; create provider metadata first, upload the selected files sequentially, then refresh the shared provider catalog.

## 4. Validation and handoff — 2/2

- [x] Add API/source/unit tests for owner+AAL2 boundaries, size/MIME/path validation, create/update semantics and runtime variant resolution.
- [x] Add rendered Settings/account/card evidence in light/dark, inspect it, update #481 + repository checkpoint, then run the appropriate integrated gates.

## UX contract

Provider management belongs under Settings near Account Management because the provider registry is shared by account creation and Cards.

Existing provider:
- preview identity and provider type;
- preview each available artwork role/variant;
- replace an individual image;
- changing artwork updates all surfaces using that provider after catalog refresh.

Create provider:
1. Name / short name.
2. Type: bank, fintech, wallet or payment provider.
3. Optional ISO country code.
4. Stable provider id generated from the name, editable before creation, collision-checked.
5. Artwork picker in the same form:
   - Logo Universal
   - Logo Light
   - Logo Dark
   - Wordmark Light
   - Wordmark Dark
   - Card Mark Light
   - Card Mark Dark
   - At least one Logo and one Wordmark are required; theme/card variants remain optional
6. One Create action performs provider creation then selected image uploads; partial upload failure is surfaced explicitly and the provider remains editable rather than silently rolling back an already-created identity.

## Asset resolution contract

For ordinary application surfaces:
```
compact/account mark:
  logo/universal
  -> logo/<resolved app theme>
  -> primary logo
  -> generic mark

wordmark:
  wordmark/<resolved app theme>
  -> wordmark/universal
  -> primary wordmark
  -> selected logo fallback
  -> generic mark
```

For payment cards:
```
card mark:
  card-mark/<card contrast: light|dark>
  -> card-mark/universal
  -> wordmark/<card contrast>
  -> primary wordmark
  -> logo/universal
  -> generic mark
```

Here `light` / `dark` describe the background the artwork must work on. Card selection therefore follows card contrast, not global application theme.

## Security / storage contract

- Existing public bucket remains `financial-provider-assets`.
- Writes require authenticated owner + AAL2.
- Browser/Windows never receives secret/service-role credentials.
- Existing API-function count is preserved; provider management extends `/api/account-metadata`.
- Active asset rows must reference a real object under `providers/<provider-id>/...`.
- Allowed MIME: PNG, JPEG, WebP, SVG.
- Individual provider images remain capped at 2 MiB.
- SVG is accepted only as inert image content; it is rendered through `<img>`, never injected as application HTML.
- Provider artwork is user-managed; source/provenance URLs are optional.
- Visa/Mastercard remain repo-owned card-network assets and are not managed here.

## Branch dependency

Implementation branch: `feat/481-provider-brand-management`.

It is currently stacked on `chore/478-db-production-readiness` / #479 because #481 depends on the Storage-first provider schema. After #479 lands, #481 must be reconciled onto current `develop` before final validation/merge.


## 5. UX refinement — provider editor and reusable asset library — 5/5

The first implementation proved the backend/runtime contract, but the rendered review exposed an interaction-design problem: artwork management was expanded directly inside Settings and the create flow exposed seven native file inputs. That is functionally valid but not the intended product UX.

- [x] Use one Provider Editor for both existing and new providers. The editor has two tabs: **Στοιχεία** and **Εικόνες**. Settings itself shows a compact provider list plus Edit/Create actions, not all artwork slots.
- [x] Introduce explicit **asset bindings**. An uploaded asset is stored once in the provider's asset library; logo/wordmark/card slots reference that asset. The same image can therefore be used in multiple slots without duplicate files.
- [x] In the **Εικόνες** tab, each slot can choose from already-uploaded assets or upload a new one. Uploads are app-owned controls; native browser file controls remain hidden.
- [x] App branding uses Default + optional Light UI / Dark UI overrides. Card branding uses Default + optional Light-card / Dark-card overrides; application theme is irrelevant to cards.
- [x] Run a new UX-oriented rendered suite that verifies the actual edit/create task, asset picker, reuse semantics, mobile/desktop layout and light/dark presentation. Do not mark this phase complete from geometry-only checks.

### Refined slot model

```
App identity
  Logo
    Default
    Light UI override (optional)
    Dark UI override (optional)

  Wordmark
    Default
    Light UI override (optional)
    Dark UI override (optional)

Cards
  Card mark
    Default
    Light-card override (optional)
    Dark-card override (optional)
```

Default Logo and Default Wordmark are required for a complete provider, but they may reference the **same uploaded asset**. Card mark is optional and falls back to wordmark/logo.

### Asset-library behavior

- Upload once → receive one provider-scoped asset.
- Assign the same asset to any number of slots.
- Existing-provider picker shows all active uploaded assets for that provider.
- Reassigning a slot does not delete the previous asset from the library.
- An uploaded asset can be removed only when no slot references it; deletion UX is a later safe enhancement, not part of slot reassignment.
- Existing production assets are backfilled into bindings so nothing is lost.
