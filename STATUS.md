# MyFinHub status

## Current production

MyFinHub v1.3.0 web/production integration is complete.

- Canonical redesigned application promoted to release-only `main`.
- Vercel production deployment is READY on the validated production tree.
- Production device-session registry and provider-brand refresh migrations are applied.
- Owner + AAL2 + active-device RLS/session enforcement is active.
- Final integration gates passed: CI, CodeQL, Cross-engine, Performance, Windows Desktop, Windows First Run and Windows Clean Launch.
- Final persistent visual evidence contains 63 PNGs plus its manifest under `visual-qa/final/**`.
- Production recurring/workbook reconciliation is complete.

The stable published Windows installer remains v1.2.2 until the controlled v1.3.0 tag workflow finishes.

Release-closeout tracker: **#288**.

## Windows v1.3.0 closeout

**Tasks 0/3 · Subtasks 4/9**

Completed:

- verified root and desktop package version `1.3.0`;
- verified the Windows release contract: `myfinhub-v1.3.0`, tag commit already on `main`, validated NSIS installer and SHA-256 asset pair;
- corrected durable v1.3 documentation for the canonical server card vault, durable history and current production state;
- prepared the v1.3.0 release notes and release-closeout metadata.

Remaining:

1. land this release-closeout metadata on the final `main` commit;
2. create `myfinhub-v1.3.0` on that exact commit;
3. require the Windows tag workflow to publish and verify `MyFinHub-Setup-1.3.0-x64.exe` plus its `.sha256`;
4. update the README download/release links only after publication is independently verified;
5. close #288.

## Durable security and finance invariants

- Single-owner authentication remains email/password + mandatory TOTP/AAL2.
- Finance access remains API-authorized and RLS-backed.
- PAN/expiry/CVV are excluded from FinanceData and normal backups and live only in the encrypted owner+AAL2 server card vault.
- `CARD_VAULT_KEY`, service-role credentials and other privileged secrets are never distributed in browser, Windows or Android clients.
- Optimistic revisions, backups, audit/history boundaries and the canonical finance/accounting engine remain authoritative.
- No database reset, destructive re-import or historical rewrite is part of the Windows release closeout.

## Delivery workflow

Routine implementation remains **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` is release-only. Windows desktop publication is allowed only from a matching `myfinhub-v<version>` tag that points to a commit already on `main`.
