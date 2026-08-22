(() => {
  const bridge = window.myFinHubDesktop;
  const form = document.getElementById('setup-form');
  const url = document.getElementById('supabase-url');
  const key = document.getElementById('publishable-key');
  const vault = document.getElementById('vault-key');
  const version = document.getElementById('vault-version');
  const vaultHint = document.getElementById('vault-hint');
  const status = document.getElementById('status');
  const save = document.getElementById('save');
  const progress = document.getElementById('progress-bar');
  const progressShell = progress?.parentElement;
  const liveLine = document.getElementById('live-line');
  const steps = Array.from(document.querySelectorAll('.step'));
  const logItems = Array.from(document.querySelectorAll('#setup-log li'));
  const diagnosticPanel = document.getElementById('diagnostic-panel');
  const diagnosticCode = document.getElementById('diagnostic-code');
  const diagnosticStage = document.getElementById('diagnostic-stage');
  const diagnosticMessage = document.getElementById('diagnostic-message');
  const diagnosticDetail = document.getElementById('diagnostic-detail');
  const copyDiagnostics = document.getElementById('copy-diagnostics');

  const setStatus = (message, kind = '') => {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  };

  const renderDiagnostic = (error) => {
    if (!diagnosticPanel) return;
    if (!error) {
      diagnosticPanel.hidden = true;
      if (diagnosticCode) diagnosticCode.textContent = '';
      if (diagnosticStage) diagnosticStage.textContent = '';
      if (diagnosticMessage) diagnosticMessage.textContent = '';
      if (diagnosticDetail) diagnosticDetail.textContent = '';
      return;
    }
    diagnosticPanel.hidden = false;
    if (diagnosticCode) diagnosticCode.textContent = String(error.code || 'DESKTOP_STARTUP_FAILED');
    if (diagnosticStage) diagnosticStage.textContent = String(error.stage || 'startup');
    if (diagnosticMessage) diagnosticMessage.textContent = String(error.message || 'Η εκκίνηση απέτυχε.');
    if (diagnosticDetail) diagnosticDetail.textContent = String(error.detail || 'Δεν υπάρχει επιπλέον diagnostic detail.');
  };

  const setProgress = (value, step, message) => {
    const numeric = Math.max(0, Math.min(100, Number(value) || 0));
    const currentStep = Math.max(1, Math.min(4, Number(step) || 1));
    if (progress) progress.style.width = `${numeric}%`;
    if (progressShell) progressShell.setAttribute('aria-valuenow', String(numeric));
    if (liveLine && message) liveLine.textContent = message;
    steps.forEach((item, index) => {
      item.classList.toggle('done', index + 1 < currentStep);
      item.classList.toggle('active', index + 1 === currentStep);
    });
    logItems.forEach((item, index) => {
      const mappedStep = Math.min(4, index + 1);
      item.classList.toggle('done', mappedStep < currentStep);
      item.classList.toggle('active', mappedStep === currentStep);
    });
  };

  if (!bridge) {
    setStatus('Η ασφαλής desktop γέφυρα δεν είναι διαθέσιμη.', 'error');
    save.disabled = true;
    setProgress(0, 1, 'Η desktop γέφυρα δεν είναι διαθέσιμη.');
    return;
  }

  const applyState = (state) => {
    if (!state) return;
    setProgress(state.progress, state.step, state.message);
    renderDiagnostic(state.error);
    if (state.error) setStatus(`${state.error.message} Κωδικός: ${state.error.code}`, 'error');
    else if (state.message) setStatus(state.message, Number(state.progress) >= 100 ? 'ok' : '');
  };

  const unsubscribe = bridge.onSetupProgress?.((state) => applyState(state));
  window.addEventListener('beforeunload', () => unsubscribe?.(), { once: true });

  bridge.getSetupState().then((state) => {
    if (state?.supabaseUrl) url.value = state.supabaseUrl;
    if (state?.supabasePublishableKey) key.value = state.supabasePublishableKey;
    if (state?.cardVaultKeyVersion) version.value = String(state.cardVaultKeyVersion);
    if (vaultHint && state?.cardVaultConfigured) {
      vaultHint.textContent = 'Υπάρχει ήδη αποθηκευμένο card-vault key. Άφησε το πεδίο κενό για να διατηρηθεί ή δώσε νέο key για αντικατάσταση.';
    }
    applyState(state);
  }).catch((error) => {
    setStatus('Δεν ήταν δυνατή η φόρτωση των αποθηκευμένων ρυθμίσεων.', 'error');
    renderDiagnostic({ code: 'SETUP_STATE_LOAD_FAILED', stage: 'setup-ui', message: 'Η φόρτωση της κατάστασης ρύθμισης απέτυχε.', detail: String(error?.message || '') });
  });

  copyDiagnostics?.addEventListener('click', async () => {
    copyDiagnostics.disabled = true;
    try {
      const result = await bridge.copySetupDiagnostics();
      setStatus(result?.ok ? 'Τα ασφαλή διαγνωστικά αντιγράφηκαν στο πρόχειρο.' : 'Δεν υπάρχουν διαγνωστικά για αντιγραφή.', result?.ok ? 'ok' : 'error');
    } catch {
      setStatus('Η αντιγραφή διαγνωστικών απέτυχε.', 'error');
    } finally {
      copyDiagnostics.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    renderDiagnostic(null);
    setStatus('Έλεγχος ρυθμίσεων…');
    setProgress(15, 1, 'Έλεγχος μορφής των στοιχείων σύνδεσης…');
    try {
      const result = await bridge.saveSetup({
        supabaseUrl: url.value.trim(),
        supabasePublishableKey: key.value.trim(),
        cardVaultKey: vault.value.trim(),
        cardVaultKeyVersion: Number(version.value || 1),
      });
      vault.value = '';
      if (!result?.ok) {
        renderDiagnostic(result?.error);
        setStatus(`${result?.error?.message || 'Η ρύθμιση απέτυχε.'} Διόρθωσε τα στοιχεία ή πάτησε ξανά για επανάληψη.`, 'error');
        save.disabled = false;
        return;
      }
      setStatus('Το MyFinHub είναι έτοιμο.', 'ok');
      setProgress(100, 4, 'Ολοκληρώθηκε. Άνοιγμα MyFinHub…');
    } catch (error) {
      setStatus('Η διαδικασία ρύθμισης απέτυχε πριν ολοκληρωθεί. Μπορείς να διορθώσεις τα στοιχεία και να δοκιμάσεις ξανά.', 'error');
      renderDiagnostic({ code: 'SETUP_IPC_FAILED', stage: 'setup-ui', message: 'Η ασφαλής επικοινωνία της ρύθμισης απέτυχε.', detail: String(error?.message || '') });
      save.disabled = false;
    }
  });
})();