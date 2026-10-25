# Issue #578 — Card pointer tilt and bounded historical preservation audit (2026-10-16)

**Current checkpoint: Implementations 0/2 completed · Sub-implementations 0/6 completed (pending live rendered/CI acceptance).**

## Owner constraints / baseline
- Owner reports formerly working card mouse animation missing, requests restoration and retrospective check for removed features, explicitly prohibits unrelated changes.
- Branch `fix/578-card-pointer-tilt-regression` based on protected `develop@b20082e0876b16bad61a0728f0ccedd1d7c3d2c2`; `main@5343f0eddaee2641269d3b68b1763ab3cb51cfdc` is separate Production and must not be implicitly promoted.
- No other PRs open at discovery. #570 already restored **archive shred** in develop. That is not the 3D hover effect and must be preserved.
- Production read-only aggregate now reports **1 encrypted Card Vault row**; previously 0. This corroborates persistence existence, **not** a complete owner+AAL2 read/reload/delete proof. **No CARD_VAULT_KEY rotation or data mutation.** Outstanding recovery in #566 is more consequential now.

## Evidence-based source / recent history review
1. Two independent card renderers exist: `InteractivePaymentCard` for debit/prepaid and `CanonicalCreditCardStack` for credit. Both retain hover handlers, but they duplicate pointer geometry and have no actual mouse-hover rendered test; source-presence checks can pass while an interaction is ineffective. Debit recomputes `getBoundingClientRect` after each 3D transform (feedback into next pointer position), caches initial OS reduced-motion only once and does not explicitly cancel scheduled work; credit lacks the reduced-motion guard. Treat user-visible loss as reported, with runtime cause requiring new browser evidence, not conclusively explained by repository diff alone.
2. The generic `.payment-card:hover` rule competes for `transform` with imperative card-specific tilt. The accepted active geometry is card-specific; new fixes preserve it. Inline secure editor deliberately uses `transform:none!important` while editing, so no tilt should interrupt entering PAN/expiry/CVV; masked/revealed cards outside editing remain eligible.
3. `#567` merged responsive/card/editor changes to **develop**, while `#570/#571` restored debit/prepaid archive exit animation there. `#576/#577` merged genuine top-edge save feedback to develop. Current Production main is older: differences in its editor/action affordances or archive/save animation are **deployment divergence**, not evidence that develop removed them. No owner-approved production promotion for this issue.
4. Historical UI remediation #503 R-01..R-16, owner decisions #266 and shared-first UX rules remain authoritative; their accepted CI/screenshot proofs are historical, not fresh cross-app interactive certification. Do not arbitrarily revert layouts, controls, taxonomy or security based only on appearance changes between releases.

## Scoped fix / regression lock (implementation pending acceptance)
- One shared pure pointer-tilt math/motion-policy helper, called by both existing renderer owners; stable origin rectangle, frame coalescing, leave/cancel cleanup, Windows mouse/pen support and OS reduced-motion without a new user preference. No archive/state/finance/vault behavior changes.
- Focused Vitest math/renderer-source lock plus actual CDP hover/leave/reduced-motion checks and hover screenshots in the existing debit and credit remediation QA suites. These checks must pass in actual rendered desktop + representative breakpoint/theme runs. Examine artifacts before claiming PASS.
- This retrospective is bounded to confirmed owner-preservation risks in cards/motion and known accepted release deltas. Other alleged missing features need an explicit concrete behavior and reproduction evidence before code changes, per owner restriction.

## Next actions
- Run targeted `tests/card-pointer-tilt.test.ts`, source/type/build and focused Chromium cards+credit rendered suites; inspect generated mouse-tilt images and existing regression states. Address any evidence-confirmed defects as a coherent batch.
- Keep PR Draft while building, then Ready exact-head CI/CodeQL/WebKit/performance/Windows, check screenshots and merge to protected develop only after all required gates succeed.
- Do not claim historical features all verified merely from code search, and do not close #566 or release main.
