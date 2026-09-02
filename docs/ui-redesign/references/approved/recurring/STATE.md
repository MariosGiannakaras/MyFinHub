State: IMPLEMENTED AND VALIDATED
Implementation: COMPLETE

Approved target SHA-256: e0d6faab90eacd9602b62a4eb034cbb5229a8da2e8ee84ca7eef5f794506fdc2
Issue: #329
Branch: feat/329-recurring-approved-target
PR: #331
Superseded draft PR: #330

Implementation: target-like desktop heading, two-card summary, category-grouped recurring workspace, aligned canonical linked-loan obligations and compact inactive history are implemented. Canonical recurring calculations, payment/lifecycle handlers, editor validation and shared FinanceIcon preferences remain authoritative.

Exact-head validation: PASS on code commit b2b407fdfd874287f8b9b2569590e3951b3bd8c6. CI run #1583 passed npm audits, application and API checks, and the full rendered frontend QA. CodeQL #1542, Cross-engine smoke #802, Performance smoke #817 and Windows Desktop #1187 also passed.

Approved ↔ Actual: PASS. Fresh desktop evidence preserves the approved page hierarchy and density while using authoritative repository shell/data instead of literal target fixtures. Fresh mobile and recurring-editor evidence was visually inspected after the mobile-preservation correction: the full Πάγια & Συνδρομές heading, summary card text hierarchy, recurring cards, linked-loan copy/actions and editor remain usable without the previously observed text run-together regression.
