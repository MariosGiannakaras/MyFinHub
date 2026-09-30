# Provider Branding Management Plan — #481

## Goal

Make provider branding owner-managed from MyFinHub itself. Existing providers can have their artwork replaced without a repo change or redeploy, and a newly created provider can be created together with the artwork required by account/card surfaces.

**Tasks 0/4 · Subtasks 0/13**

## 1. Provider asset model + secure write API — 0/4

- [ ] Return every active provider asset (`logo`, `wordmark`, `card-mark`) with role, variant and public Storage URL while keeping the current primary `logoUrl` / `wordmarkUrl` compatibility fields.
- [ ] Add owner+AAL2 provider create/update mutation contract using the authenticated user's JWT; never use or expose a service-role key.
- [ ] Add bounded binary upload/replace through the existing `/api/account-metadata` function family. Validate provider id, role, variant, MIME, filename, path and size before forwarding bytes to Supabase Storage.
- [ ] Register uploaded assets and safely update primary logo/wordmark selection. Existing primary assets remain valid until a replacement upload and metadata write both succeed.

## 2. Runtime asset selection — 0/3

- [ ] Theme-aware account/provider surfaces: prefer universal, then resolved light/dark, then primary/fallback.
- [ ] Card surfaces: select `card-mark` by the actual card background contrast rather than global app theme.
- [ ] Keep graceful fallback order so incomplete custom providers never render a broken image.

## 3. Settings provider management — 0/4

- [ ] Add provider-management UI with previews for current logo/wordmark/card variants and Replace actions.
- [ ] Support Logo, Wordmark Light, Wordmark Dark, Card Mark Light and Card Mark Dark uploads with progress/error/success states.
- [ ] Add create-provider metadata flow for bank/fintech/wallet/payment.
- [ ] In the same creation flow, let the owner select the provider images before saving; create provider metadata first, upload the selected files sequentially, then refresh the shared provider catalog.

## 4. Validation and handoff — 0/2

- [ ] Add API/source/unit tests for owner+AAL2 boundaries, size/MIME/path validation, create/update semantics and runtime variant resolution.
- [ ] Add rendered Settings/account/card evidence in light/dark, inspect it, update #481 + repository checkpoint, then run the appropriate integrated gates.

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
   - Logo (recommended/required for polished result)
   - Wordmark Light
   - Wordmark Dark
   - Card Mark Light
   - Card Mark Dark
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
