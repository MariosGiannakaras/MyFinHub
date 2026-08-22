(() => {
  const bridge = window.myFinHubDesktop;
  const form = document.getElementById('setup-form');
  const url = document.getElementById('supabase-url');
  const key = document.getElementById('publishable-key');
  const vault = document.getElementById('vault-key');
  const version = document.getElementById('vault-version');
  const status = document.getElementById('status');
  const save = document.getElementById('save');
  const progress = document.getElementById('progress-bar');
  const progressShell = progress?.parentElement;
  const liveLine = document.getElementById('live-line');
  const steps = Array.from(document.querySelectorAll('.step'));
  const logItems = Array.from(document.querySelectorAll('#setup-log li'));
  const diagnostic = document.getElementById('diagnostic');
  const diagnosticCode = document.getElementById('diagnostic-code');
  const diagnosticStage = document.getElementById('diagnostic-stage');
  const diagnosticMessage = document.getElementById('diagnostic-message');
  const diagnosticDetail = document.getElementById('diagnostic-detail');
  const copyDiagnostics = document.getElementById('copy-diagnostics');

  const setStatus = (message, kind = '') => {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  };

  const setProgress = (value, step, message) => {
    const numeric = Math.max(0, Math.min(100, Number(value) || 0));
    if (progress) progress.style.width = `${numeric}%`;
    if (progressShell) progressShell.setAttribute('aria-valuenow', String(numeric));
    if (liveLine && message) liveLine.textContent = message;
    steps.forEach((item, index) => {
      item.classList.toggle('done', index + 1 < step);
      item.classList.toggle('active', index + 1 === step);
    });
    logItems.forEach((item, index) => {
      const mappedStep = Math.min(4, index + 1);
      item.classList.toggle('done', mappedStep < step);
      item.classList.toggle('active', mappedStep === step);
    });
  };

  const renderFailure = (failure) => {
    if (!diagnostic || !failure) return;
    diagnostic.hidden = false;
    diagnosticCode.textContent = String(failure.code || 'DESKTOP_STARTUP_FAILED');
    diagnosticStage.textContent = `στάδιο: ${String(failure.stage || 'startup')}`;
    diagnosticMessage.textContent = String(failure.message || 'Η εκκίνηση απέτυχε.');
    diagnosticDetail.textContent = String(failure.detail || 'Δεν δόθηκε επιπλέον τεχνική λεπτομέρεια.');
  };

  const clearFailure = () => {
    if (diagnostic) diagnostic.hidden = true;
    if (diagnosticCode) diagnosticCode.textContent = '';
    if (diagnosticStage) diagnosticStage.textContent = '';
    if (diagnosticMessage) diagnosticMessage.textContent = '';
    if (diagnosticDetail) diagnosticDetail.textContent = '';
  };

  if (!bridge) {
    setStatus('Η ασφαλής desktop γέφυρα δεν είναι διαθέσιμη.', 'error');
    save.disabled = true;
    setProgress(0, 1, 'Η desktop γέφυρα δεν είναι διαθέσιμη.');
    return;
  }

  const unsubscribe = bridge.onSetupProgress?.((state) => {
    setProgress(state?.progress, state?.step, state?.message);
    if (state?.failure) renderFailure(state.failure);
    if (state?.message) setStatus(state.message, state?.error ? 'error' : state?.progress >= 100 ? 'ok' : '');
  });
  window.addEventListener('beforeunload', () => unsubscribe?.(), { once: true });

  bridge.getSetupState().then((state) => {
    if (state?.supabaseUrl) url.value = state.supabaseUrl;
    if (state?.supabasePublishableKey) key.value = state.supabasePublishableKey;
    if (state?.cardVaultKeyVersion) version.value = String(state.cardVaultKeyVersion);
    if (state?.hasStoredCardVaultKey) vault.placeholder = 'Υπάρχει ήδη προστατευμένο key — άφησέ το κενό για διατήρηση';
    if (state?.lastStartupFailure) {
      renderFailure(state.lastStartupFailure);
      setStatus(`${state.lastStartupFailure.code} — ${state.lastStartupFailure.message}`, 'error');
      setProgress(8, 1, 'Η προηγούμενη εκκίνηση απέτυχε. Διόρθωσε τις ρυθμίσεις ή δοκίμασε ξανά.');
    } else {
      setProgress(8, 1, 'Έτοιμο για έλεγχο των στοιχείων σύνδεσης.');
    }
  }).catch(() => setStatus('Δεν ήταν δυνατή η φόρτωση προεπιλεγμένων ρυθμίσεων.', 'error'));

  copyDiagnostics?.addEventListener('click', async () => {
    try {
      const result = await bridge.copySetupDiagnostics?.();
      setStatus(result?.ok ? 'Τα ασφαλή διαγνωστικά αντιγράφηκαν.' : 'Δεν υπάρχουν διαγνωστικά για αντιγραφή.', result?.ok ? 'ok' : 'error');
    } catch {
      setStatus('Δεν ήταν δυνατή η αντιγραφή των διαγνωστικών.', 'error');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    clearFailure();
    setStatus('Έλεγχος ρυθμίσεων…');
    setProgress(10, 1, 'Έλεγχος μορφής και σύνδεσης με Supabase…');
    try {
      const result = await bridge.saveSetup({
        supabaseUrl: url.value.trim(),
        supabasePublishableKey: key.value.trim(),
        cardVaultKey: vault.value.trim(),
        cardVaultKeyVersion: Number(version.value || 1),
      });
      vault.value = '';
      if (!result?.ok) {
        renderFailure(result?.error);
        setStatus(result?.error ? `${result.error.code} — ${result.error.message}` : 'Η εκκίνηση απέτυχε.', 'error');
        setProgress(8, 1, 'Η ρύθμιση παραμένει ανοιχτή. Διόρθωσε τα στοιχεία ή δοκίμασε ξανά.');
        save.disabled = false;
        return;
      }
      setStatus('Το MyFinHub είναι έτοιμο.', 'ok');
      setProgress(100, 4, 'Ολοκληρώθηκε. Άνοιγμα MyFinHub…');
    } catch {
      setStatus('Η διαδικασία ρύθμισης απέτυχε πριν επιστρέψει ασφαλή διαγνωστικά. Δοκίμασε ξανά.', 'error');
      setProgress(8, 1, 'Η ρύθμιση παραμένει ανοιχτή για νέα προσπάθεια.');
      save.disabled = false;
    }
  });
})();
