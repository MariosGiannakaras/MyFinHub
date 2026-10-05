# MyFinHub content, localization and feedback audit

Reviewer: ChatGPT direct audit  
Scope: MyFinHub web/desktop application only  
Date: 2026-10-02

## Greek product-language contract

The reviewed product language is Greek. Direct inspection covered the 132-image route/Settings/auth/404 matrix and the source owners for authentication, navigation, finance forms, persistence/recovery, receipts, providers, security/device access and destructive confirmations.

Intentional non-Greek terms are limited to established technical, product or financial identifiers where translation would reduce clarity: **MyFinHub, Email, Authenticator, QR, MFA, OCR, IBAN, PIN, Visa, Mastercard, Pay & Save, Dashboard, JSON, Windows, Android** and keyboard shortcut labels. These are used as names/technical nouns rather than unexplained action copy.

The reviewed UI uses Greek for primary actions, validation, destructive confirmations, persistence state, empty states, recovery guidance and finance explanations. Date-only finance values use the shared Greek/local-date formatters; currency/amount presentation uses the shared money formatter and preserves the canonical EUR semantic value separately from the user-facing Greek label.

No material mixed-language action, contradictory finance term, capitalization defect or ambiguous income/expense/transfer/payment wording remains in the reviewed baseline. Long Greek labels and finance values are separately covered by geometry/extreme-content verification.

## Feedback and recovery message audit

| Message family | Directly reviewed owner(s) | Announcement/persistence contract | Recovery / safety contract |
| --- | --- | --- | --- |
| Field/form validation | `FormError`, Quick Entry and domain editors | assertive `role=alert`; stays local to the task until corrected/dismissed | actionable field wording; destructive actions remain separate |
| Save progress/success | `PersistenceNotice`, AppShell save state | loading/saving/saved use polite status; saved acknowledgement is intentionally transient | no destructive recovery action while healthy |
| Save failure/conflict | `PersistenceNotice`, `useFinance` | assertive alert; error/conflict persists until explicit recovery | reload latest stored version; no automatic failed-write retry or false success |
| Unexpected page/render failure | `PageErrorBoundary` | focused privacy-safe alert | retry page, Dashboard, or full reload; raw exception/finance payload is not rendered |
| Login/MFA | `LoginScreen`, `MfaScreen`, session hook | task-local alerts; busy state is explicit; finance remains locked until auth completes | retry credentials/code, enroll/re-auth, logout |
| Auth expiry/AAL2 downgrade/device revoke | auth-expiry/session runtime contracts | authenticated shell is removed or downgraded instead of leaving stale success state | deterministic login/MFA recovery |
| Receipt/OCR | `ReceiptInbox`, local OCR boundary | errors remain attached to the receipt flow; local draft survives | retry scan, improve image, or continue manually; missing assets do not delete the receipt |
| Provider/account metadata | provider/account Settings editors | task-local errors; success message emitted only after the requested operation completes | editor remains recoverable on partial provider/upload failure; failed Storage registration cleans up object |
| Device/security settings | `DeviceAccessSettings`, account-security surfaces | status/error copy stays in the owning security panel | refresh/retry; destructive revoke requires confirmation and explains required re-auth |
| Import/backup/history | Settings Data, history/persistence hooks | conflicts/errors are explicit and never converted into success | unsupported/future schema fails closed; import/reload/history recovery is explicit |
| Destructive confirmations | shared `ConfirmDialog` / alertdialog surfaces | owned modal semantics and focus | safe cancel path plus explicit destructive label |
| Network/upstream failure | shared API/user-message/persistence boundaries | stable public message; technical identifiers/raw upstream detail are redacted | retry only where safe; finance mutations are never silently replayed |

## Redaction contract

`userErrorMessage` rejects empty, overlong and technical exception strings and falls back to owned product copy when messages contain HTTP/SQL/Supabase/stack/error-class identifiers. Unexpected 5xx responses expose stable public error text/request IDs rather than upstream payloads. Page failures deliberately avoid rendering raw exceptions or finance payloads.

## Closure disposition

The localization/content and user-facing feedback checklist items are complete for the current audited product surfaces. They must be reopened only if a later change introduces new user-facing terminology/message families or if final rendered proof reveals a copy/announcement/recovery defect.
