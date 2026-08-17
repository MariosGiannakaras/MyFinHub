# Security policy

RheomIQ is a single-owner personal finance application. Security reports must not include passwords, API keys, access or refresh tokens, TOTP secrets, database credentials, or exported personal finance data.

## Reporting a vulnerability

Do not open a public GitHub issue with exploit details or sensitive evidence. Use the repository Security area / private vulnerability reporting when available. If private reporting is not enabled, keep the evidence private until a secure reporting channel is available.

For ordinary bugs that do not expose a security boundary, use the bug issue form and include only non-sensitive request IDs, error messages, and reproduction steps.

## Security boundaries

Production finance access is intended for one configured owner and requires email/password authentication plus TOTP MFA (`aal2`). Authorization is enforced in both the HTTP API and PostgreSQL RLS. The browser must never receive a Supabase service-role/secret key.

Changes to authentication, authorization, session handling, Supabase policies/functions, or production deployment configuration require explicit security verification in the pull request checklist before merge.
