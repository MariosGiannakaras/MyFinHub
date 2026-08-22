# Android native API authentication contract

Status: implementation branch for issue #196  
Consumer: `MariosGiannakaras/MyFinHub-Android-App`

## Purpose

The Android application is a native client of the existing MyFinHub finance API. It does not receive a second finance backend and it does not access durable finance state with a service-role credential.

The native client authenticates with Supabase Auth, completes TOTP MFA to obtain an `aal2` access JWT, and supplies that JWT explicitly as:

```http
Authorization: Bearer <supabase-access-jwt>
```

No real token belongs in source, tests, documentation, logs, screenshots or issue/PR content.

## Explicit opt-in

Bearer authentication is disabled by default in `requireSession`. Only routes that explicitly call:

```ts
requireSession(req, res, { allowBearer: true })
```

participate in the native finance contract.

Current native-enabled boundaries:

- `GET /api/data`
- `PUT /api/data`
- `POST /api/backup`
- `POST /api/import`
- `POST /api/card-secrets` — reveal PAN/expiry for one card
- `PUT /api/card-secrets` — save PAN/expiry for one card
- `DELETE /api/card-secrets` — delete PAN/expiry for one card

Browser auth/session/MFA/login/logout endpoints are not native bearer endpoints. The Android application performs password/TOTP authentication through Supabase Auth and then consumes the finance API with the resulting user access JWT.

## Session provenance

`requireSession` returns session provenance:

```ts
type SessionSource = 'cookie' | 'bearer'
```

This is security-relevant. Handlers must preserve the distinction instead of converting a bearer request into a cookie session.

### Bearer precedence and failure

On a route that opts into bearer support:

1. if `Authorization` is absent, the existing cookie access/refresh flow runs unchanged;
2. if `Authorization: Bearer ...` is present, that credential is authoritative for the request;
3. a malformed or Supabase-rejected bearer fails with `AUTH_REQUIRED`;
4. the request must not fall back to a valid ambient cookie after bearer rejection;
5. temporary upstream Auth failures remain service failures rather than being misclassified as invalid credentials.

This prevents an invalid native credential from borrowing a browser session that happens to be present in the same HTTP request context.

## Mutation CSRF/origin boundary

Cookie and bearer mutations have different credential transport semantics.

### Cookie source

Cookies are ambient credentials. Existing browser/Windows mutation requests continue through `assertSameOrigin` and remain protected by `Origin`, `Sec-Fetch-Site`, host and forwarded-protocol checks.

### Bearer source

The bearer credential is explicitly supplied in `Authorization`. Native bearer mutations therefore do not require browser Origin metadata after bearer authentication has succeeded.

This is **not** a CORS relaxation. No `Access-Control-Allow-Origin: *` or other permissive cross-origin browser policy is added. Browser JavaScript remains governed by the existing origin boundary.

Handlers use `assertMutationSessionOrigin(req, session)` rather than bypassing origin checks ad hoc.

## Authorization after authentication

Bearer authentication is only the first gate. Existing authorization and integrity requirements remain authoritative:

1. Supabase Auth validates the access token;
2. `isOwner(accessToken)` requires the configured single owner;
3. `accessTokenAal(accessToken)` must be `aal2` for finance/card-secret access;
4. Supabase database operations use the publishable key plus that user JWT, preserving RLS/RPC enforcement;
5. `PUT /api/data` still requires `If-Match` and rejects stale revisions;
6. existing server-side request validation, bounded bodies, backups and audit behavior remain unchanged;
7. card-secret operations retain owner+AAL2 validation, body whitelisting, rate limiting and server-vault rules;
8. CVV remains forbidden from server persistence.

No service-role or Supabase secret key is required or allowed in the Android APK.

## Cookie isolation

Bearer failures do not manipulate browser cookie state. In particular, a non-owner bearer request returns `AUTH_REQUIRED` without clearing unrelated access/refresh cookies.

Cookie sessions retain the existing cleanup behavior after genuine cookie/refresh rejection or cookie-session owner rejection.

## Android client behavior

The Android app should:

- authenticate with Supabase Auth and complete TOTP until the access JWT is `aal2`;
- store session material only through the Android secure-storage boundary defined by the Android repository;
- send the access JWT only over HTTPS in `Authorization`;
- treat `401 AUTH_REQUIRED` as session invalidation/re-authentication;
- treat `403 MFA_REQUIRED` as insufficient assurance and complete/repeat MFA as appropriate;
- preserve the current revision returned by `/api/data` and send it through `If-Match` for mutations;
- handle `409 REVISION_CONFLICT` by reloading/reconciling rather than overwriting;
- never send CVV to a server endpoint.

## Regression contract

Before this native path can be merged/released, tests must cover at least:

- valid owner AAL2 bearer read;
- valid owner AAL2 bearer mutation without browser Origin metadata;
- invalid bearer with a valid cookie still fails closed;
- AAL1 bearer denied;
- non-owner bearer denied without cookie clearing;
- cookie mutation still requires same-origin;
- no permissive CORS header introduced;
- stale revision conflict preserved;
- existing cookie refresh/failure resilience preserved;
- card-secret owner/AAL2/CVV restrictions preserved.

The Android repository must not connect production finance data until this contract is merged, deployed and verified through the normal MyFinHub release process.
