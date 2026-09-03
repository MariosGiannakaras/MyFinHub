# Settings · General approved target

Owner approved the Settings → General concept on 2026-09-03 after requesting a different structure and removal of duplicate information.

Exact approved reference:

- 1505×1045 PNG
- SHA-256 `68dbdffc15ce65c755fca648b45250c353d2ce2410617ce90008d1e126367718`

## Presentation contract

This approval applies only to the **General** tab, not to the remaining Settings tabs.

The General tab keeps the established MyFinHub application shell and verified page/card language, and contains one concise settings workspace with:

1. the real text-size preference (`compact`, `normal`, `large`);
2. the real theme preference (`system`, `light`, `dark`);
3. one consolidated application/update panel instead of duplicate application-info and Windows-update cards;
4. the existing global keyboard shortcuts from the canonical shortcut registry;
5. the agreed Settings tab navigation as the structural shell for subsequent tab-by-tab redesign work.

The reference is structural, not a literal fixture. Existing MyFinHub branding, shell, runtime values and supported platform state remain authoritative.

## Backend/functionality constraint

Only capabilities that exist in the current repository may be interactive. In particular:

- do not invent a “last update check” value because the current desktop bridge does not expose one;
- do not add email/password change controls to General;
- do not add notification/privacy/security preferences that are not implemented;
- existing Settings functionality outside General must remain reachable while those tabs await their own approvals.

Where a future tab represents a capability that does not yet exist (for example owner email/password changes), the navigation must not pretend that the backend already supports it.
