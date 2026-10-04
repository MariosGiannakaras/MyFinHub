# Financial provider assets

MyFinHub uses **official provider artwork only**. Do not fabricate, redraw, or promote generic placeholders as verified branding.

## Production contract

- Canonical binaries live in Supabase Storage bucket `financial-provider-assets`.
- Active metadata lives in `public.rheomiq_financial_provider_assets`.
- Provider references (`logo_asset_key`, `wordmark_asset_key`) are nullable foreign keys. A provider may remain on the generic UI fallback until a verified official asset is installed.
- An asset can be `active=true` only when it has a Storage path, non-zero size, SHA-256, exact official source/download URLs, and `verified_at`.
- `legacy_content` is migration-only rollback/history material and must be NULL for active assets.
- Maximum object size is 2 MiB; accepted MIME types are PNG, JPEG, WebP and SVG.

## Official source pages

| Provider ID | Current brand | Official source |
| --- | --- | --- |
| `piraeus` | Τράπεζα Πειραιώς | https://www.piraeusgroup.gr/el/grafeio-typoy/press-kit |
| `alpha` | Alpha Bank | https://www.alpha.gr/en/group/media-centre |
| `national` | Εθνική Τράπεζα | https://www.nbg.gr/en/group/press-office/uliko-gia-ekproswpous-twn-mme |
| `eurobank` | Eurobank | https://www.eurobank.gr/el/omilos/grafeio-tupou |
| `revolut` | Revolut | https://developer.revolut.com/docs/open-banking-guidelines/logo-guidelines |
| `viva` | Viva.com | https://euhelp.viva.com/en/articles/4866218-can-i-use-the-viva-com-logo-on-my-website |
| `payzy` | Magenta Pay | https://www.magenta.pay/gr/ |
| `paypal` | PayPal | https://www.paypal.com/gr/webapps/mpp/logo-center |

The internal ID `payzy` is intentionally stable for backward compatibility even though the current customer-facing brand is Magenta Pay.

## Installation workflow

1. Download the current official asset from the provider's official page/official CDN.
2. Keep the exact source page URL and exact binary download URL.
3. Use a deterministic filename: `<provider>--<logo|wordmark>--<variant>.<ext>`.
4. Verify the file locally: MIME type, non-zero byte size, dimensions and SHA-256.
5. Upload it to `financial-provider-assets/providers/<provider-id>/<filename>`.
6. Upsert its metadata into `rheomiq_financial_provider_assets` with `source='official-provider'`, `legacy_content=NULL`, the Storage location, byte size, SHA-256, source URLs and `verified_at`.
7. Only after the Storage object exists, set the provider's matching `logo_asset_key` or `wordmark_asset_key`.
8. Run `rheomiq_database_health()` through the authenticated owner+AAL2 path; `missingStorageObjects` and `inactiveProviderAssetRefs` must remain zero.

## Current owner handoff

A downloadable helper kit is maintained outside Git history for this task because the repository should not contain arbitrary downloaded third-party brand binaries. The kit contains:

- official-source manifest;
- PowerShell and shell download helpers;
- local SHA-256/dimension verifier;
- SQL metadata generator;
- exact Storage upload/activation instructions.

Do not commit downloaded provider archives or copied brand binaries unless the owner explicitly decides the repository itself should redistribute them and the relevant brand terms permit that use.
