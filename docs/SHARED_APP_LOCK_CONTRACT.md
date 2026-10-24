# MyFinHub shared application privacy lock (draft #622)

## Scope and security boundary
- A four-digit owner-selected PIN is shared by the Web and Windows clients through the same authenticated server API. This does **not** replace Supabase Auth, mandatory TOTP, owner UID, AAL2, current-device revocation or RLS. It must never authorize access to those boundaries by itself.
- The app privacy lock prevents casual access to an unattended on-screen finance workspace. When locked, the React finance tree is unmounted rather than merely visually blurred. It is **not yet a separate per-request backend authorization gate**: a browser session's normal Auth cookies remain valid under current finance APIs. Full server-enforced per-session PIN grants require separate design and Android/native compatibility acceptance before calling this an authorization barrier.
- The PIN is never stored in browser localStorage/IndexedDB or returned by the API. The DB table and verifier have no authenticated grants; a narrowly scoped SECURITY DEFINER RPC compares a bcrypt verifier after strict owner+AAL2+active-device checks, with database-shared failed-attempt throttling. Never expose the hash to client access.
- Both Web and Windows show a PIN gate on a fresh authenticated page opening when shared PIN is enabled. On inactivity the UI locks, and after a backgrounded tab resumes past timeout it locks. The normal web login/TOTP flow remains available when there is no authenticated session.
- Windows legacy DPAPI PIN is retained and used only if the global PIN is not configured. The old PIN is not silently uploaded to the server, and enabling the global PIN is an explicit owner action. Remove/retire the legacy fallback only after an accepted migration policy.
- If the owner loses the PIN, self-service high-assurance recovery is **not yet implemented**. Do not release the shared PIN feature without approving and testing an MFA-backed recovery flow that does not let an already-unlocked cookie bypass it.

## Owner-facing configuration
Settings → Χρήστης & Πρόσβαση → PIN & αυτόματο κλείδωμα. Choices: 1, 5, 15, 30, 60 minutes (default 5); configuring a new global PIN requires confirmation. Changing, disabling, and updating the timeout require the current PIN. A forced "Κλείδωμα τώρα" event locks on the same client.

## API contract (Web, desktop, future Android)
All requests use the existing authenticated owner session with AAL2/current-device policy and publishable key; browser routes use same-origin cookies, same-origin mutation guard. No service-role key.
- `GET /api/auth/app-lock` → `{ok:true,enabled:boolean,idleMinutes:number,retryAfterMs:number}`.
- `POST /api/auth/app-lock`, JSON `{action:'configure',newPin:'1234',idleMinutes:5}` (when unset), `{action:'verify',pin:'1234'}`, `{action:'change',pin:'1234',newPin:'2345'}`, `{action:'timeout',pin:'1234',idleMinutes:15}`, `{action:'disable',pin:'1234'}`. Failed verification is a 200 JSON `ok:false,error:'APP_LOCK_WRONG_PIN'|'APP_LOCK_RATE_LIMITED',retryAfterMs` so UI can count down; upstream/security transport errors are HTTP errors and must fail closed.
- PIN values have exactly four ASCII digits; idle timeout accepts the five canonical choices. Never log request PINs or include them in telemetry.
- The authenticated bearer variant of PIN endpoints is **not enabled** by the current API. The separate Android app must not assume it can use cookies or that the lock screen has been integrated. Android must be explicitly coordinated and tested before claiming the same PIN functions across *all* platforms.

## Device registry additions
`GET /api/auth/devices` returns optional `nickname`, `defaultLabel`, `systemName`, `browserName`, `deviceType`, existing platform/version/firstSeenAt/lastSeenAt/current. System and browser labels are coarse client/UA-reported hints, not verified hardware identity, and never include raw IP/user-agent. `POST /api/auth/devices` `{action:'rename',sessionId:'<canonical-UUID>',nickname:'My Laptop'}` updates an active owner's nickname; empty string clears it. Nicknames are not rewritten by normal device heartbeat or platform updates.

## Validation and release
Migrations `20261024150000` (device metadata) and `20261024160000` (shared PIN) are forward-only and require pre-deployment migration verification. Narrow unit/source checks, live database RPC/RLS/lockout race checks, rendered mobile/desktop QA, native Windows packaging and full exact-head CI are required. Do not merge/deploy this draft until these pass; keep unrelated financial history and Android source intact.
