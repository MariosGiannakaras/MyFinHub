# Financial-provider asset recovery

Status: active completion-audit item. This document exists so the remaining binary-asset work is explicit and reproducible.

## Current architecture

- `rheomiq_financial_providers` is the live authenticated identity/selection registry.
- `BankBrandMark` renders bundled local assets selected by the provider registry.
- `rheomiq_financial_provider_assets.content` is **not currently read by the app runtime**.
- The public Supabase Storage bucket `financial-provider-assets` currently contains no objects.
- Do not describe the database as the binary rendering source of truth until the missing canonical binaries are restored and a reviewed runtime asset path exists.

## Verified recovery state

| asset_key | Expected SHA-256 | Live content | Current result |
| --- | --- | ---: | --- |
| piraeus-wordmark-green-on-white | 73fc3353377d38ab00abbb97f2859da0f143595a80bf0f7e3c8b64611632b2ec | 7,989 bytes | Recovered from the exact repository binary; hash verified and backfilled. |
| piraeus-logo-green-on-yellow | 423c287f37d79ef1997f07bd035df5beef8694106a76758bb3d992a9efbf9351 | 0 bytes | Current repo fallback has a different SHA-256. Original binary required. |
| piraeus-wordmark-green-on-yellow | 0bb7e36c015935cd8e6c98ed26533863d080fce211b3e31eadd9084aa8430796 | 0 bytes | Original binary required. |
| alpha-logo-white-on-blue | 601f2857b9bc41a586b7c2a6e74ee58796b7752047830ecb5e69f1d10b6c0887 | 0 bytes | Current repo fallback has a different SHA-256. Original binary required. |
| alpha-wordmark-color | 246ea6f9449b5dc224c6e2b287365f63d1a4ce1ca92988e0da91809f435452f1 | 0 bytes | Current repo fallback has a different SHA-256. Original binary required. |
| revolut-logo-black-on-white | d78f8bc2fc508898ab555ffd71560cf2a542021a314a399a8312a88a5387d15e | 0 bytes | Current bundled SVG is not this JPEG binary. Original binary required. |
| revolut-logo-white-on-black | 8209601026f4841b0b218bae8f28963942c9515458dc1528a85a934705274dfa | 0 bytes | Original binary required. |
| revolut-wordmark-black-on-white | 86d958f1448269c301795e3642515efab23cea47cb6b793c4bfeeffe31a8e693 | 0 bytes | Original binary required. |
| payzy-logo-color | 8c6cd9445b20b11fdcfb8310c537eccf1e1318dd537f13c80062bbd90f62e30e | 0 bytes | Current bundled PNG is not the canonical JPEG binary. Original binary required. |
| viva-logo-navy-on-white | 32fe6a7ab3c9f4c0313e7811453541b06ac82a31c45ba341f2ad7573f7c5c688 | 0 bytes | Current bundled PNG is not the canonical JPEG binary. Original binary required. |

## Safe recovery rule

For an existing canonical row, never fill `content` merely because an image looks correct. The exact bytes must hash to the row's stored SHA-256. A migration must abort on mismatch and must target exactly one expected row.

If the original binary is permanently unavailable and a replacement asset is desired, that is a **new canonical asset revision**, not a backfill. The reviewed change must update the binary, SHA-256, MIME type/dimensions/source metadata and provider key mapping together. It must not silently retain the old canonical hash.

## User action required for unresolved originals

Provide the original owner-approved files, without recompressing/resaving them if possible. Once available, compare each file against the expected SHA-256 above. Matching files can be backfilled safely. Non-matching files require an explicit replacement decision and a new reviewed canonical record/migration.

## Completed migration

`supabase/migrations/20260930095500_backfill_verified_piraeus_wordmark.sql` embeds only the exact verified Piraeus wordmark bytes, checks the SHA-256 in PostgreSQL before update, requires exactly one target row, and has been applied successfully to production.
