# MyFinHub — GPT UI/UX Visual Audit

## Scope and evidence

This is an independent visual-first audit of the **latest Antigravity interactive-verification evidence**, inspected directly at the screenshots' original resolution. It intentionally does **not** reuse the older `visual-qa/final/` 216-image matrix as evidence for these findings.

Audited screenshots:

- `docs/audits/gemini/screenshots/evidence_01_dashboard.png`
- `docs/audits/gemini/screenshots/evidence_02_transactions.png`
- `docs/audits/gemini/screenshots/evidence_02b_transactions_sep2026.png`
- `docs/audits/gemini/screenshots/evidence_03_savings.png`
- `docs/audits/gemini/screenshots/evidence_04_cards.png`
- `docs/audits/gemini/screenshots/evidence_05_credit.png`
- `docs/audits/gemini/screenshots/evidence_06_loans.png`
- `docs/audits/gemini/screenshots/evidence_07_lending.png`
- `docs/audits/gemini/screenshots/evidence_08_recurring.png`
- `docs/audits/gemini/screenshots/evidence_09_planning.png`
- `docs/audits/gemini/screenshots/evidence_10_reports.png`
- `docs/audits/gemini/screenshots/evidence_11_settings.png`
- `docs/audits/gemini/screenshots/evidence_11b_settings_user_access.png`
- `docs/audits/gemini/screenshots/evidence_12_attention.png`

The supplied interactive evidence is desktop-oriented. This report therefore does not claim independent mobile/tablet visual proof from this screenshot set.

Severity used below:

- **High** — materially harms readability, hierarchy, accessibility or core task comprehension.
- **Medium** — clear quality/consistency defect that does not block the task.
- **Low** — polish/localization issue with limited task impact.

## Executive summary

The screenshots do not show a generally broken layout: major desktop regions are contained and the main tables/panels do not exhibit broad page-level horizontal overflow. The dominant quality problem is instead **density and hierarchy drift**: many desktop surfaces reserve large amounts of space while simultaneously rendering important labels at very small sizes. There are also several specific contrast defects, one explicit information-truncation defect, a card-workspace clipping/affordance problem, and a primary-account ordering mismatch.

The most important corrections are:

1. restore the required Dashboard account order;
2. remove sub-11px desktop micro-typography from information-bearing text;
3. fix light-card and Reports budget-card contrast in dark theme;
4. allow full text in transaction details;
5. replace visually empty large Dashboard/Transactions regions with deliberate empty states;
6. rebalance the Loans and Recurring wide-desktop layouts.

## Findings

### V-01 — High — Dashboard primary-account order does not match the product hierarchy

**Evidence:** `evidence_01_dashboard.png`

The three primary cards are rendered left-to-right as:

1. Πειραιώς Μισθοδοσίας
2. Πειραιώς Αποταμίευση / Pay & Save
3. Μετρητά

The required hierarchy is **Μετρητά → Μισθοδοσίας → Αποταμιευτικός**. Because these are the highest-salience cards on the landing page, this is not a cosmetic ordering detail: it changes the information architecture and the user's first scan path.

### V-02 — High — Desktop typography is over-compressed across multiple core surfaces

**Evidence:** `evidence_01_dashboard.png`, `evidence_02b_transactions_sep2026.png`, `evidence_04_cards.png`, `evidence_06_loans.png`, `evidence_08_recurring.png`, `evidence_09_planning.png`, `evidence_10_reports.png`, `evidence_12_attention.png`

A repeated visual pattern is large 2K-width containers paired with very small information text. The affected content is not decorative metadata only; it includes table headers, account names, dates, status text, budget descriptions, action labels and financial context.

Examples:

- Dashboard movement/category/KPI secondary labels are visibly tiny.
- Transactions table headers and filter/date text are undersized relative to the available width.
- Cards bank headings and empty-state descriptions are miniature.
- Loans metadata beneath the progress bar is difficult to scan.
- Recurring table headers, secondary labels and action text are extremely small.
- Reports uses very small secondary text throughout the KPI, budget and support sections.
- Attention and Planning use a large canvas but retain compact metadata sizing.

This creates a “zoomed-out admin dashboard” appearance rather than a personal-finance UI optimized for fast reading.

### V-03 — Medium — Dashboard empty data regions look unfinished rather than intentionally empty

**Evidence:** `evidence_01_dashboard.png`

Two large regions are visually hollow:

- **Κινήσεις μήνα** keeps a full-height panel containing only headers/footer navigation when there are no October rows.
- **Κατηγορίες εξόδων** reserves a large chart/table area while showing essentially only `0,00 €` and column headings.

The result reads as missing rendering rather than a valid zero-data state. Empty states should explain why the area is empty and, where useful, what the next action is; they should not preserve chart/table-sized dead space.

### V-04 — High — Dashboard secondary-account and secondary-trend contrast is too low

**Evidence:** `evidence_01_dashboard.png`

In **Λοιποί λογαριασμοί**, Alpha and Revolut names/balances are very dark and faint against the dark surface. Similar low-emphasis treatment appears in small comparison/trend copy elsewhere on the Dashboard.

These values are finance information, not decorative captions. The combination of tiny size and subdued color makes them effectively secondary to the container chrome rather than readable account data.

### V-05 — Medium — Provider marks produce harsh white/glowing rectangles on dark surfaces

**Evidence:** `evidence_01_dashboard.png`, `evidence_09_planning.png`

Several provider images—most visibly Piraeus marks—have a strong white halo/rectangular glow that is much brighter than the surrounding dark UI. The marks visually dominate adjacent account names and make the brand treatment inconsistent with the otherwise restrained dark-theme surfaces.

This is especially noticeable in the first Dashboard account cards and provider/account marks in Planning.

### V-06 — Medium — Transactions empty state has insufficient hierarchy

**Evidence:** `evidence_02_transactions.png`

The empty October result is represented by one small sentence floating in a very large area. There is no icon, concise title, contextual explanation, or action/reset affordance. On a dense financial-management page this reads like content failed to load rather than a deliberate “no matching transactions” state.

The filter controls also consume substantial horizontal space while their text remains visually weak.

### V-07 — High — Transaction details truncate the exact information the panel is meant to reveal

**Evidence:** `evidence_02b_transactions_sep2026.png`

In **Λεπτομέρειες συναλλαγής**, at least the following values are visibly ellipsized:

- **Λογαριασμός**: the account route is cut after `Πειραιώς Μισθοδοσίας → Πειραιώς...`.
- **Περιγραφή**: long content is also constrained rather than allowed to expand naturally.

Ellipsis is appropriate in a compact table row, but not in the dedicated details panel. The panel's purpose is to expose the full value that could not fit in the table.

### V-08 — Medium — Savings layout mixes excessive whitespace with cramped transfer information

**Evidence:** `evidence_03_savings.png`

The top action cards are broad and tall relative to their small amount of copy, leaving large unused areas. In contrast, the transfer route inside **Αυτός ο μήνας** is compressed into small labels/icons around the source → destination relationship.

The hierarchy is inverted: container space is abundant, while the financially meaningful route is presented as micro-copy.

### V-09 — High / accessibility — Card content contrast is inadequate on bright card designs

**Evidence:** `evidence_04_cards.png`

The rendered Piraeus yellow debit card shows white/light PAN dots, `VALID THRU`, CVV values/labels and other secondary card text on a very bright yellow background. The Alpha light-blue card similarly uses near-white information text over a bright cyan/blue surface.

Even without assigning a numerical WCAG ratio from a screenshot, the rendered contrast is visibly insufficient for small text. This is an accessibility-critical presentation problem because the affected content includes card identity and secure-detail labels.

### V-10 — Medium — Cards bank workspace clips the right edge without a clear desktop overflow affordance

**Evidence:** `evidence_04_cards.png`

The bank-by-bank workspace extends beyond the visible region and the rightmost Eurobank column is visibly cut at the screenshot edge. Partial next-item visibility can be a valid carousel cue, but here there is no strong desktop scrollbar, fade, pagination indicator or other affordance explaining that horizontal navigation is expected.

Additionally, multiple empty bank columns keep full column geometry, making the workspace much wider than the useful content requires.

### V-11 — Medium — Credit-card caption is too faint on the dark Piraeus card

**Evidence:** `evidence_05_credit.png`

The small `Πειραιώς Credit` caption beneath the large Piraeus mark is barely legible against the dark teal card. The primary PAN has acceptable emphasis, but the card identity caption is too small and too muted to act as a reliable label.

The surrounding card stage also allocates much more area than the card itself needs, reducing visual efficiency, though the primary defect is the caption readability.

### V-12 — Medium — Loans progress/meta composition is visually unbalanced on wide desktop

**Evidence:** `evidence_06_loans.png`

A single loan row spans almost the entire content width, while:

- the segmented progress bar occupies only a relatively short portion on the left;
- the four progress statistics are clustered below that same narrow area;
- the amount/actions live far to the right;
- a large middle region carries no information.

Nothing overlaps, but the relationship between progress, statistics and actions is weak. The layout looks stretched rather than deliberately distributed.

### V-13 — High — Recurring page wastes wide-screen space while compressing the table and actions

**Evidence:** `evidence_08_recurring.png`

The two top summary cards stop at roughly the left half of the content area, leaving a very large blank region to the right. Below them, the recurring table uses tiny headers/meta text and an **Ενέργειες** cell containing `Πληρωμή` plus multiple icon buttons packed into a narrow column.

This is a strong hierarchy mismatch: the page has abundant unused width but chooses micro-typography and compressed controls for its densest operational area.

### V-14 — High / accessibility — Reports budget summary has dark-theme contrast failures

**Evidence:** `evidence_10_reports.png`

Within **Προϋπολογισμοί · εικόνα περιόδου**, the status summary cards with light pastel backgrounds render very pale/light text. The third/fourth cards are the clearest examples: text and background are too close in luminance, making the cards difficult to read.

The Reports page also compounds the issue with very small trend, navigation and budget-support text. This is one of the most visible accessibility defects in the evidence set.

### V-15 — Low/Medium — Settings has minor localization and inactive-state consistency drift

**Evidence:** `evidence_11_settings.png`

The Settings screen is structurally clean, but two details reduce polish:

- inactive tabs/supporting text are small and low-emphasis;
- the theme choices mix Greek UI with the literal labels `Light` and `Dark`.

The second point is not a functional defect, but it is inconsistent with an otherwise Greek-localized settings surface.

### V-16 — Medium — User & Access form states are visually inconsistent

**Evidence:** `evidence_11b_settings_user_access.png`

In **Αλλαγή κωδικού**, the current-password field has a visibly different/lighter filled surface than the new-password and confirmation fields. The difference resembles browser autofill/credential styling rather than an intentional application state, so the three fields do not read as one coherent form.

The PIN dot indicators lower on the screen are also very faint against the dark surface.

## Surfaces without additional structural defects in this evidence

- **Lending (`evidence_07_lending.png`)**: no confirmed clipping/overlap was found. It is affected by the general small-text/density issue, but its desktop structure is coherent.
- **Planning (`evidence_09_planning.png`)**: no separate page-level containment failure was found beyond the provider-mark treatment and dense typography already recorded.
- **Attention (`evidence_12_attention.png`)**: no overlap/clipping was found; its principal weakness is scanability from small metadata/action typography, covered by V-02.

## Visual priority

Recommended visual remediation order, based only on this evidence:

1. V-01 account hierarchy.
2. V-09 and V-14 contrast/accessibility defects.
3. V-07 details-panel truncation.
4. V-02/V-04 typography and finance-data readability.
5. V-10/V-13/V-12 wide-desktop layout balance.
6. V-03/V-06 deliberate empty states.
7. V-05/V-08/V-11/V-15/V-16 polish and consistency.
