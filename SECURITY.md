# Security policy

RheomIQ is a single-owner personal finance application. Security reports must not include passwords, API keys, access or refresh tokens, TOTP secrets, database credentials, or exported personal finance data.

## Reporting a vulnerability

Do not open a public GitHub issue with exploit details or sensitive evidence. Use the repository Security area / private vulnerability reporting when available. If private reporting is not enabled, keep the evidence private until a secure reporting channel is available.

For ordinary bugs that do not expose a security boundary, use the bug issue form and include only non-sensitive request IDs, error messages, and reproduction steps.

## Security boundaries

Production finance access is intended for one configured owner and requires email/password authentication plus TOTP MFA (`aal2`). Authorization is enforced in both the HTTP API and PostgreSQL RLS. The browser and native clients must never receive a Supabase service-role/secret key.

### Browser and Windows session boundary

The production web client and packaged Windows client use the existing HttpOnly/Secure cookie session flow. Ambient-cookie state-changing requests remain protected by the same-origin/CSRF checks. Supporting Android must not weaken, bypass, or replace this browser/desktop boundary.

### Native Android bearer boundary

Approved native finance endpoints may explicitly opt in to `Authorization: Bearer <Supabase access JWT>` authentication. This path is intentionally narrow:

- bearer support is disabled by default for `requireSession` callers and must be enabled explicitly by the finance/card endpoint;
- an explicit bearer credential is authoritative for that request: if it is malformed, expired, or rejected, the server must fail closed and must not fall back to ambient cookies;
- bearer requests still require the configured owner UID, `aal2`, existing Supabase RLS/RPC authorization, validation and optimistic revision rules;
- explicit bearer mutation requests do not depend on browser `Origin`/`Sec-Fetch-*` metadata, while cookie mutation requests still require same-origin validation;
- this distinction does not authorize permissive CORS; the API does not add a cross-origin browser access policy for Android;
- rejecting a bearer owner check must not clear or mutate unrelated browser cookies;
- browser auth/MFA/session endpoints remain cookie-oriented unless a separately reviewed change explicitly expands them.

PAN/expiry remain protected by the existing server-side card vault. CVV remains device-local and is never accepted by server persistence boundaries.

Changes to authentication, authorization, session handling, Supabase policies/functions, native bearer routing, or production deployment configuration require explicit security verification in the pull request checklist before merge.
