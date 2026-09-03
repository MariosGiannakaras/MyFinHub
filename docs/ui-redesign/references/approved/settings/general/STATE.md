# Settings · General redesign state

- Surface: Settings → General
- Design: DESIGN APPROVED
- Implementation: VERIFIED
- Issue: #343
- PR: #344
- Branch: `feat/343-settings-general-tab`
- Approved reference: 1505×1045 PNG, SHA-256 `68dbdffc15ce65c755fca648b45250c353d2ce2410617ce90008d1e126367718`
- Base `develop`: `f0cbc033a887454cd3f1985de7bcdb78126c9a37`
- Validated product head: `ef62e870e7bf20399fe684235c6d06e3a63451da`
- Fresh evidence head: `b8094dad4bcd7137a5c20e8376540b77abff80e1` (automated `visual-qa` refresh sourced from `ef62e870`)
- Documentation head: `78b3d8488b765ece3c13fb8de5f522ebb6cb7437` and later docs-only `[skip ci]` descendants do not change product behavior.
- Validation: CI #1636, CodeQL #1595, Cross-engine smoke #851, Performance smoke #866, Windows Desktop #1239, Windows First Run #252 and Windows Clean Launch #253 all passed.
- Fresh Actual: desktop 1440×1000 and mobile 375×812 evidence from the exact validated product head was personally inspected against the approved target.
- Last completed: removed the duplicate global shortcuts panel, kept one canonical Settings General shortcuts surface, made legacy rendered-QA paths tab-aware, and completed fresh Approved ↔ Actual verification.
- Next action: deliver the verified branch to `develop`; the overall Settings surface remains in progress until the remaining tabs are separately designed, approved and implemented.
- Approved ↔ Actual: PASS
