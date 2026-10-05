# Financial-provider asset recovery

Status: active completion-audit item. This document is the handoff for canonical provider binaries and must match the live production rows.

## Current architecture

- `rheomiq_financial_providers` is the live authenticated identity/selection registry.
- `BankBrandMark` renders bundled local assets selected by that registry.
- `rheomiq_financial_provider_assets.content` is **not currently read by the app runtime**.
- The public Supabase Storage bucket `financial-provider-assets` currently contains no objects.
- Therefore DB asset content is recovery/integrity data today, not yet the runtime rendering source of truth.

## Verified live recovery state

| asset_key | Live SHA-256 | Live content | Source / status |
| --- | --- | ---: | --- |
| piraeus-wordmark-green-on-white | 73fc3353377d38ab00abbb97f2859da0f143595a80bf0f7e3c8b64611632b2ec | 7,989 bytes | Exact original repository binary matched the pre-existing owner-provided hash and was backfilled without changing metadata. |
| payzy-logo-color | 0a22f6d45422e0086b018c5bbe8f6d6c1cfbd6f80ffd014dda699c8cdb2e74f1 | 1,582 bytes | Explicit canonical replacement with the exact bundled PNG (127×54); metadata/hash changed atomically and source is `repository-canonical`. |
| viva-logo-navy-on-white | c7aed8524a3d980dded8cb121371397208b13cf9bb21b362d176550fd10aea8e | 923 bytes | Explicit canonical replacement with the exact bundled PNG (283×42); metadata/hash changed atomically and source is `repository-canonical`. |
| piraeus-logo-green-on-yellow | 423c287f37d79ef1997f07bd035df5beef8694106a76758bb3d992a9efbf9351 | 0 bytes | Current repo fallback has a different SHA-256. Original binary or explicit replacement decision required. |
| piraeus-wordmark-green-on-yellow | 0bb7e36c015935cd8e6c98ed26533863d080fce211b3e31eadd9084aa8430796 | 0 bytes | Original binary or explicit replacement decision required. |
| alpha-logo-white-on-blue | 601f2857b9bc41a586b7c2a6e74ee58796b7752047830ecb5e69f1d10b6c0887 | 0 bytes | Current repo fallback has a different SHA-256. Original binary or explicit replacement decision required. |
| alpha-wordmark-color | 246ea6f9449b5dc224c6e2b287365f63d1a4ce1ca92988e0da91809f435452f1 | 0 bytes | Current repo fallback has a different SHA-256. Original binary or explicit replacement decision required. |
| revolut-logo-black-on-white | d78f8bc2fc508898ab555ffd71560cf2a542021a314a399a8312a88a5387d15e | 0 bytes | Current bundled SVG is not this historical JPEG binary. Original binary or explicit replacement decision required. |
| revolut-logo-white-on-black | 8209601026f4841b0b218bae8f28963942c9515458dc1528a85a934705274dfa | 0 bytes | Original binary or explicit replacement decision required. |
| revolut-wordmark-black-on-white | 86d958f1448269c301795e3642515efab23cea47cb6b793c4bfeeffe31a8e693 | 0 bytes | Original binary or explicit replacement decision required. |

Every non-empty live row has been re-checked with PostgreSQL `digest(content,'sha256')` and matches its live `sha256`.

## Safe recovery rule

There are two legitimate paths:

1. **Backfill an existing canonical row** only when the exact bytes hash to the row's existing SHA-256. The migration must abort on mismatch and must target exactly the expected row.
2. **Create/declare a canonical replacement** when the historical original is unavailable but the approved bundled asset is the desired source. In that case binary, SHA-256, MIME type, dimensions and source metadata must change atomically. Never put replacement bytes under an old hash.

Do not synthesize, redraw, recompress or download a look-alike merely to populate the table.

## User action required for unresolved originals

If the historical Piraeus/Alpha/Revolut owner-approved originals should be preserved, provide the original files without resaving/recompressing them. Matching files can be verified against the live hashes above and backfilled. If the originals are unavailable and the current bundled assets should become canonical instead, that replacement needs an explicit product decision and a reviewed migration just like Payzy/Viva.

## Applied migrations

- `supabase/migrations/20260930095835_backfill_verified_piraeus_wordmark.sql` — exact-hash Piraeus wordmark backfill.
- `supabase/migrations/20260930100713_backfill_canonical_payzy_viva_assets.sql` — explicit canonical replacement for the exact repository Payzy/Viva PNGs.
