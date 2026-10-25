# Android native API authentication contract

Status: merged into `develop` via PR #197; included in the MyFinHub v1.2.0 release batch tracked by #199  
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
- `POST /api/card-secrets` — reveal PAN/expiry/CVV for one card
- `PUT /api/card-secrets` — save PAN/expiry/CVV for one card
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
8. PAN/expiry/CVV remain inside the encrypted server card vault and outside FinanceData/backups.

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
- send CVV only to the authenticated owner+AAL2 `/api/card-secrets` endpoint; never include it in FinanceData, logs or diagnostics.

## Regression contract

The merged native path is covered by tests for at least:

- valid owner AAL2 bearer read;
- valid owner AAL2 bearer mutation without browser Origin metadata;
- invalid bearer with a valid cookie still fails closed;
- AAL1 bearer denied;
- non-owner bearer denied without cookie clearing;
- cookie mutation still requires same-origin;
- no permissive CORS header introduced;
- stale revision conflict preserved;
- existing cookie refresh/failure resilience preserved;
- card-secret owner/AAL2 and encrypted-vault restrictions preserved.

PR #197 passed CI #801, CodeQL #755, Cross-engine/WebKit #93, Performance #87 and Windows Desktop #453 on exact head `e0d4ee10ec42688008a4d8436c0df8e42f7a94f2`, with zero unresolved review threads before squash merge.

The Android repository may connect production finance data only after this contract has been promoted through the normal MyFinHub release process and the resulting production deployment has been verified.

## Draft future contract — shared PIN rollout (#621, PR #622)

**Unreleased; Android application changes live in the separate `MyFinHub-Android-App` repository and are NOT part of this PR.** The native owner+AAL2 bearer authentication described above remains mandatory. A shared PIN is an additional requirement, never an alternative to password/TOTP, owner UID, RLS, device revocation or revision controls.

Before the shared PIN can be enabled in production, the Android owner must implement and validate:

1. `GET /api/auth/app-lock` after verified owner+AAL2 bearer login to learn `enabled`, `idleMinutes` and retry policy.
2. `POST /api/auth/app-lock` with bearer auth and JSON `{action:"verify",pin:"<four digits>"}`; on success receive a 256-bit random `unlockToken` bound to the current Supabase Auth `session_id`. Invalid PIN/rate limiting must not imply valid access.
3. Retain `unlockToken` in protected in-memory session state; never store it in logs, screenshots, normal finance backups, localStorage or unencrypted preferences. Attach `X-MyFinHub-App-Unlock: <unlockToken>` to every protected finance API request, including card-secret operations.
4. For user interaction, call `POST /api/auth/app-lock` with `{action:"touch",unlockToken}` at bounded intervals; only real activity may extend the configured 1/5/15/30/60-minute session timeout.
5. On idle, app background/resume, explicit lock, device revocation, logout, PIN change, token expiry, or server `423 APP_LOCK_REQUIRED`, clear local token and protect the UI. For explicit lock, `POST /api/auth/app-lock` with `{action:"lock",unlockToken}`; the server revokes all tickets for that Auth session, including any reused bearer copies.
6. On app restart, show PIN before fetching or rendering financial content. Keep secure login/TOTP session renewal unchanged. Apply the same responsive accessibility, feedback and reduced-motion principles appropriate to native Android.
7. If PIN is forgotten, the server-side recovery route requires new email/password and a fresh GoTrue TOTP challenge; the verified authenticator timestamps must be recent, and the temporary recovery Auth sessions use local-only logout. The Android owner must decide native recovery UI separately; no Android code is changed here.

The source PR now enforces PIN tickets on **all** finance bearer requests when shared PIN is configured. There is intentionally **no UA/platform bypass**. Enabling shared PIN in production before native integration could make an existing Android installation unable to access finance; do not promote the migration or activate the feature until the native readiness/rollout checklist has been accepted. Public/nonfinancial Android update discovery remains accessible so older clients can fetch the compatible update. This section is a **handoff contract**, not a claim that native support already exists or that Web/Windows have passed final tests.
