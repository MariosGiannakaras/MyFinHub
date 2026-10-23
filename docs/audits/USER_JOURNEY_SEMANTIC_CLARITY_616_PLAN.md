# Owner-approved semantic user-journey implementation — issue #616
Branch `feat/616-semantic-user-journey-clarity`, base `develop@a177b92fdbecacf09dee093a04bd7c3b4bdeb382`. The owner confirms Recurring is the only originating UI for **paying a recurring obligation**; generic Quick Entry still permits independent expenses sharing category/label. No inferred financial dedup. The other audited UX enhancements are accepted as directional improvements. Never change production main/DB/Android implicitly.
## 5 coherent implementation/acceptance groups
- [ ] 1. Preserve recurring-linked transaction edits and make dedicated Recurring payment origin explicit, tested (including Attention and global command returning to the Recurring owning page).
- [ ] 2. Explain actual/known-due/estimated flows and provide safe report/alert-to-source navigation.
- [ ] 3. Clarify local receipts, backup exclusions, import irreversibility and cross-store partial successes.
- [ ] 4. Explain dependency blockers for categories/accounts/cards without deleting/remapping finance history.
- [ ] 5. Clarify common-pool savings goals and rule/provenance, verify responsive/focus/dark/light/error states.
**Accepted Implementations 0/5** at source-batch checkpoint; counts advance only after real tests, rendered artifact review and protected integration. New plan has no explicit subitem denominator, so do not invent one.
## First coherent source slice, pending tests
Files: QuickAdd + recurring helper/test, App command/Attention Recurring focus navigation, Settings Data, Receipt Inbox, Account deletion blockers, Savings pool warning, Reports transaction and upcoming source navigation. Paid Recurring from Attention or global search now navigates to the focused Recurring row; its dedicated Pay CTA owns the transaction. No new financial write path/schema; preserve privacy, owner+AAL2, revision/redo, card-vault and save-line semantics.
## Mandatory next actions
1. Draft CI exact-head source/unit/type/format/bundle and CodeQL; fix actual failures as one batch, don't weaken limits.
2. Focused synthetic browser: linked recurring edited through Transactions remains paid after reload, unrelated generic expense remains independent; Reports correct-month open, account blocker, savings multiple goals, Backup and local receipt copy. Capture and directly inspect desktop 1440, tablet 834, mobile 375, light/dark, error/focus states.
3. One final Ready full CI/WebKit/Lighthouse/Windows/Real Stack & visual evidence, protected merge to develop and postmerge check.
4. Reconcile accepted delta into already green release PR #605, new exact-head release gates. Do not promote main/deploy.
Taxonomy implementation #601 closed by explicit owner decision; release-only owner+AAL2 activation tracked at #617 and remains unperformed, live 18/6.
Roadmap #588 **Implementations 12/12 completed · Sub-implementations 24/24 completed**, taxonomy source **4/4 · 8/8**.
