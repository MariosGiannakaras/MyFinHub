# MyFinHub Android private update distribution

This document defines the server/storage side of the private Android self-update channel. The Android app is not distributed through Google Play. The owner's Samsung Galaxy S24 Ultra is the only supported device.

## Runtime architecture

1. The authenticated Android app calls `GET /api/android-update` with its normal Supabase bearer access token.
2. The endpoint validates the token through the existing native session path, verifies the configured owner, and requires AAL2.
3. The endpoint reads only the newest enabled row from `public.rheomiq_android_releases` using the same owner JWT and publishable key. No service-role key is required at runtime.
4. The response contains version metadata plus an authenticated private Storage URL in bucket `android-releases`.
5. The Android client downloads that URL with the same bearer token. Storage RLS independently requires the owner and AAL2.
6. The client verifies the APK's version, package identity, SHA-256 digest and signing certificate before asking Android PackageInstaller to install it.

The private Storage URL is not a public download link. It is usable only with an authorized owner session and therefore becomes unusable when that credential is expired or revoked. Do not replace it with a public bucket or a public GitHub Release asset.

## Release metadata

`public.rheomiq_android_releases` stores only distribution metadata:

- `version_code` — strictly increasing Android versionCode.
- `version_name` — user-facing release version.
- `storage_path` — object path inside the private `android-releases` bucket.
- `sha256` — lowercase/uppercase hexadecimal SHA-256 of the exact APK bytes.
- `size_bytes` — exact APK byte size.
- `mandatory` — whether the client should treat the update as required by product policy.
- `notes` — concise release notes shown by the Android UI.
- `published_at` — publication timestamp.
- `enabled` — whether the release is eligible to be returned as latest.

Authenticated Android users have SELECT-only access, and only when they are the configured owner with AAL2. There is intentionally no authenticated insert/update/delete policy.

## Publishing boundary

Production APK publishing is an **offline signing-handoff operation**. It must not be automated with a runtime service-role credential and must not occur before the physical Galaxy S24 Ultra Phase 6 acceptance and explicit product-owner signing authorization.

After that boundary is explicitly crossed, a release publisher must:

1. build the exact accepted Android release state with the long-lived production signing identity;
2. verify package identity, versionCode/versionName and signing certificate;
3. calculate SHA-256 and exact byte size locally;
4. upload the APK to a new immutable path such as `1.4.0/MyFinHub-1.4.0.apk` in the private `android-releases` bucket using an offline/admin mechanism;
5. insert the matching metadata row only after the upload has completed and been independently verified;
6. never overwrite an already published APK path; publish a new version/path instead;
7. keep signing keys, passwords, service-role credentials and other administrative secrets outside the repository and outside the APK.

A release can be withdrawn by setting its metadata row `enabled = false` or deleting the private object through the offline/admin path. The Android runtime has no authority to publish or mutate releases.

## API response

When no production release exists yet:

```json
{ "available": false }
```

When a release exists:

```json
{
  "available": true,
  "release": {
    "versionCode": 14,
    "versionName": "1.4.0",
    "downloadUrl": "https://<project>.supabase.co/storage/v1/object/authenticated/android-releases/1.4.0/MyFinHub-1.4.0.apk",
    "sha256": "<64 hex characters>",
    "sizeBytes": 42000000,
    "mandatory": false,
    "notes": "Release notes",
    "publishedAt": "2026-09-03T12:00:00.000Z"
  }
}
```

Responses are private/no-store. The download request itself must also carry the normal owner bearer token.

## Session continuity

Installing an update over the same Android application ID with the same production signing identity is an application update, not an uninstall. The updater must never clear the Android encrypted session store, local PIN verifier or device-local CVV vault merely because a new APK is installed.

After an update restarts the process, the normal Android startup contract remains:

`stored encrypted session -> biometric/PIN local unlock when configured -> server session validate/refresh -> product`

Email/password/TOTP are required again only when the server session is genuinely invalid, expired or revoked, or when application data was explicitly cleared/uninstalled.
