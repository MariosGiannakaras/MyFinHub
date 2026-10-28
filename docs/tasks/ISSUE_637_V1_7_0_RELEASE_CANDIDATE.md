# Issue #637 — MyFinHub v1.7.0 release candidate (Web/API/Windows)

## Authority and scope — 2026-10-28
Owner approved necessary corrections after the v1.7.0 vs Android-compatibility release-gate discussion. Interpret this as approval to prepare **v1.7.0** from the four already accepted develop PRs (#631, #634, #633, #632) and keep the stricter, owner-approved Card Vault write contract. **This is not evidence that Android has been fixed or an unconditional authorization to knowingly break Android writes.** Production promotion and Windows publication require independently verified release gates. Android source, release and issue ownership remain in the separate Android repository; do not change Android code here.

- Branch: `chore/637-v1-7-0-release-candidate`; parent develop `c7a28e67793e63c2ad2b172c95d84fd44552dd9f`.
- Production main at discovery: `62b8e943ab02919533b48f99638ecc0b54578952`; official v1.6.0 installer, tag and README download URL stay unchanged during candidate preparation.
- No new Supabase migrations, financial-data/Storage mutations, vault-key changes, production deployment, or Android repository edits.

## Source implementation checklist
Each numbered implementation counts as complete only when all sub-implementations are written and reviewed. Validation and deployment are tracked separately.

- [x] **I1 — Single v1.7.0 release identity (3/3)**:
  - [x] root and desktop manifest versions advance to 1.7.0, preserving existing package names/dependencies and installer naming;
  - [x] root and desktop lockfile root/linked-root versions align, without dependency resolution changes;
  - [x] existing release coherence and Windows publishing identity remain valid, with no v1.6.0 tag reuse or published download-link rewrite.
- [x] **I2 — Focused release/regression locks (2/2)**:
  - [x] reinforce release identity / published-version boundaries in existing version-coherence tests;
  - [x] reinforce strict Card Vault new-write / legacy decrypt cross-client failure-path tests without relaxing validated security.
- [x] **I3 — Truthful release notes and Android handoff (2/2)**:
  - [x] populate CHANGELOG [Unreleased] with exact approved four-PR delta, including compatibility caveat;
  - [x] document precise Android native-client acceptance contract and explicit go/no-go gate, preserving established API auth/AAL2/owner/PIN and legacy-data protections.
- [x] **I4 — Real-stack actual-browser regression selector (1/1)**:
  - [x] Align debit-card inline icon-only secure save selection to its existing accessible button name, with source regression lock. Root cause verified in Draft Real Stack #40626418731: new UI uses `aria-label="Αποθήκευση στοιχείων κάρτας"` while E2E attempted visible text `Αποθήκευση στοιχείων`; no app control removal or backend defect established.

**Implementations 4/4 completed · Sub-implementations 8/8 completed** — code/configuration and focused regression checks written, including real-browser selector repair; validation/CI and release remain separate.

## Validation / integration / production (not implementation counters)
- [x] Check live branch/ref and no overlapping implementation PR before final write.
- [ ] Narrow source tests, JSON and version coherence, card-vault source tests, real-browser selector source test, and lockfile metadata checks (Draft CI #40626418824 source/build PASS on prior head 40f5ba36; pending on repaired head).
- [ ] Draft PR CI preflight (prior Draft #40626418824 PASS; standalone CodeQL #40626418732 PASS; Real Stack #40626418731 failed at stale inline-card save selector — repaired in source, new exact-head result pending); one coherent Ready exact-head CI matrix (Chromium rendered UI, WebKit, CodeQL, Lighthouse, Windows installer, installed first-run and clean launch, Unified gate) with direct rendered evidence inspection.
- [ ] Opt-in 216-image final visual release acceptance when required, with direct review; do not misstate a skipped job as PASS.
- [ ] Confirm Android client writes match PAN exactly 16 digits, CVV exactly 3, current/future expiry (valid MM/YY, compatible MM/YYYY transport); protect legacy local-vault upload/migration and report partial secret sync failures accurately. On-device code/tests belong to separate Android owner. **Do not ship the strict backend to production while Android incompatibility remains unresolved or without a distinct explicit owner acceptance of those exact failure paths.**
- [ ] Independently validate current full PostgreSQL+Storage recoverability or obtain specific release-risk acceptance; old v1.6.0 waiver was not proof of restore.
- [ ] Review exact protected develop→main release PR and obtain explicit final owner production approval after all gates. Then event-driven Vercel READY + deployed SHA/Production Smoke; only thereafter publish a new v1.7.0 Windows tag, installer and SHA256, and finally reconcile public README links. No premature tag or installer reuse.

## Cross-client mismatch confirmed at source
Current `server/cardVaultCrypto.ts` strict write: exactly 16 numeric PAN digits (spaces normalized), CVV exactly 3 when supplied, genuine unexpired expiry with 01–12 month; valid future `MM/YYYY` is accepted and normalized to `MM/YY`. Legacy decrypt accepts older PAN/CVV lengths without rewriting. Current Android code accepts 12–19 PAN, 3–4 CVV, and does not reject expired expiry before PUT. For incompatible legacy local-vault migration PUT, Android retains its local encrypted secrets on failure, but shared server synchronization can remain partial. Android #345 shared PIN support is a separate uncompleted compatibility requirement. Preserve server's security/domain contract; require a reviewed Android fix (or explicit known-failure acceptance), not a silent server relaxation.

## Latest checkpoint and next safe action
One corrective batch for the deterministic Real Stack actual-browser harness regression was committed after Draft #40626418731. Keep PR #638 Draft until repaired exact-head Real Stack and Draft CI pass; if green, mark Ready once for full strict exact-head validation, inspect rendered evidence, and keep production/Android release gates separate. No running or skipped job is a claimed PASS. Production `main`, existing public Windows v1.6.0 assets and Android remain unchanged until release gates are satisfied.
