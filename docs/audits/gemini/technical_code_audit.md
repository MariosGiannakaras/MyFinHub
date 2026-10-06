# MyFinHub UI/UX Technical Code Audit

This document outlines the technical root causes and proposed solutions for the visual defects identified in the visual audit.

### 1. Dashboard (Επισκόπηση)
* **Επικάλυψη κειμένου σε Κύριους Λογαριασμούς (Τίτλος vs Ποσό):**
  * **Αιτία:** Στο `src/styles/dashboard-approved-target.css`, η κλάση `.approved-account-identity strong` έχει `-webkit-line-clamp: 2`. Όταν το όνομα σπάει σε 2 γραμμές, το ύψος του header μεγαλώνει. Ωστόσο, το balance (`.account-metric-overlay` με την κλάση `.approved-balance`) πιθανότατα έχει `position: absolute` χωρίς να σέβεται το δυναμικό ύψος του header, με αποτέλεσμα να "καβαλάει" το κείμενο από κάτω του.
  * **Λύση:** Το `.account-metric-overlay` πρέπει να γίνει μέρος του normal document flow (π.χ. `position: static` ή `relative` με σωστό padding/margin) ώστε να σπρώχνεται προς τα κάτω όταν ο τίτλος μεγαλώνει.
* **Μηδενικό Contrast σε Λοιπούς Λογαριασμούς (Alpha / Revolut):**
  * **Αιτία:** Στο `dashboard-approved-target.css`, το κείμενο στους δευτερεύοντες λογαριασμούς είναι hardcoded: `small { color: #3f5579; }` και `b { color: #142d68; }`. Στο Dark Theme αυτά τα χρώματα (σκούρο μπλε) πάνω σε σκούρο background είναι αόρατα!
  * **Λύση:** Πρέπει να αντικατασταθούν με CSS variables του theme, π.χ. `color: var(--muted)` και `color: var(--ink)` αντίστοιχα.
* **Low Contrast στο "Σύνοψη Οικονομικών":**
  * **Αιτία:** Παρόμοιο πρόβλημα. Tα labels όπως το `↓ 100% από Σεπ` χρησιμοποιούν πολύ σκούρο χρώμα (πιθανώς το default negative class χωρίς dark-mode override).

### 2. Συναλλαγές (Transactions)
* **Truncation στο Side Panel (Λεπτομέρειες Συναλλαγής):**
  * **Αιτία:** Το side panel επαναχρησιμοποιεί CSS classes της λίστας (π.χ. `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`) για το "Λογαριασμός" και την "Περιγραφή".
  * **Λύση:** Στο context των *λεπτομερειών*, το text πρέπει υποχρεωτικά να κάνει wrap (`white-space: normal; word-break: break-word;`), ώστε ο χρήστης να μπορεί να διαβάσει όλη την πληροφορία που δεν χωρούσε στο grid.

### 3. Κάρτες (Cards)
* **Critical Contrast Failure στην κίτρινη κάρτα Πειραιώς:**
  * **Αιτία:** Το layout της χρεωστικής κάρτας (`PaymentCard.tsx` ή παρόμοιο) έχει hardcoded λευκό χρώμα για τα νούμερα, το CVV και τα labels (`color: #fff`). Όταν το background της κάρτας είναι το `#ffd600` της Πειραιώς, το WCAG contrast ratio πέφτει στο πάτωμα.
  * **Λύση:** Πρέπει να προστεθεί logic που ελέγχει αν το `surfaceTone` ή το brand είναι "piraeus" (ή αν είναι φωτεινό χρώμα) και να εφαρμόζει `color: #000` (ή μια `.dark-text` class) στα περιεχόμενα της κάρτας.
* **Αόρατο κείμενο "Δεν υπάρχουν κάρτες" & Headers:**
  * **Αιτία:** Τα headers των τραπεζών και τα empty states έχουν hardcoded light-theme χρώματα (`#142d68` κλπ).
  * **Λύση:** Χρήση `var(--ink)` και `var(--muted)`.

### 4. Πιστωτική (Credit)
* **Μαύρο κείμενο "Πειραιώς Credit" σε σκούρο πράσινο φόντο:**
  * **Αιτία:** Το αντίστροφο από πριν! Το label της κάρτας είναι hardcoded σε μαύρο, ενώ η συγκεκριμένη κάρτα έχει σκούρο πράσινο background.
  * **Λύση:** Το label χρειάζεται CSS `color: #fff` ή `var(--ink-inverse)` όταν βρίσκεται μέσα σε dark surface.

### 5. Δόσεις & Δάνεια (Loans)
* **Ασυμμετρία/Misalignment στα στατιστικά δόσεων:**
  * **Αιτία:** Τα texts κάτω από την μπάρα προόδου βρίσκονται σε container χωρίς σωστό flexbox (π.χ. λείπει το `justify-content: space-between` ή το `flex: 1` στα παιδιά) με αποτέλεσμα να μην στοιχίζονται ομοιόμορφα σε σχέση με την ίδια την μπάρα.

### 6. Πάγια (Recurring)
* **Cramped Actions:**
  * **Αιτία:** Στο column "Ενέργειες", το μεγάλο κουμπί "Πληρωμή" και τα 3 icon-buttons (`Edit`, `Pause`, `Delete`) βρίσκονται μέσα σε ένα flex/grid container που είτε δεν έχει καθόλου `gap`, είτε έχει πολύ μικρό `gap` (π.χ. 2px).
  * **Λύση:** Προσθήκη `gap: 8px; align-items: center; justify-content: flex-end;` στο container των actions για να αναπνεύσουν τα targets.

### 7. Αναφορές (Reports)
* **Αόρατο λευκό κείμενο σε light-gray cards:**
  * **Αιτία:** Τα summary cards ("Υπέρβαση" / "Τελική χρήση") στο τμήμα προϋπολογισμών, παίρνουν ένα light gray background (`background: #e2e8f0;` ή παρόμοιο) αλλά κληρονομούν (inherit) το γενικό λευκό/ανοιχτόχρωμο κείμενο (`color: #fff`) του Dark Theme.
  * **Λύση:** Τα συγκεκριμένα cards πρέπει να κάνουν override το color σε σκούρο (π.χ. `color: #1a202c;`) *ανεξάρτητα* από το theme του application.
