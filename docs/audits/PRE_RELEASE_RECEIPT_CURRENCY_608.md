# Receipt OCR mixed-currency guard — issue #608
Baseline: develop@579ccdb202870ab0a15e896737c23260595003df; release candidate PR #605 remains unreleased.
## Verified defect
An explicit USD grand total was mislabeled EUR if another OCR line mentioned EUR. The owner-required foreign-source gate in ReceiptInbox could then be bypassed.
## Fix and proof
- Select explicit currency from the chosen total line, prioritizing non-EUR if total has no currency marker and document contains multiple currency words.
- Three focused parser regressions (mixed USD total with EUR conversion, EUR total with incidental USD, unmarked total with foreign source evidence).
- Preserve current receipt draft, confidence, EUR manual correction and no auto-posting behavior.
## Validation
- [ ] exact-head draft source CI/CodeQL success.
- [ ] full required Ready CI and safe develop integration, then reconcile release #605.
No production, Android, database or server mutation. #588 12/12 implementations · 24/24 sub-implementations and #601 4/4 · 8/8 unaffected.
