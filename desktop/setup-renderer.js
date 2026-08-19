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

  if (!bridge) {
    setStatus('Η ασφαλής desktop γέφυρα δεν είναι διαθέσιμη.', 'error');
    save.disabled = true;
    setProgress(0, 1, 'Η desktop γέφυρα δεν είναι διαθέσιμη.');
    return;
  }

  const unsubscribe = bridge.onSetupProgress?.((state) => {
    setProgress(state?.progress, state?.step, state?.message);
    if (state?.message) setStatus(state.message, state?.error ? 'error' : state?.progress >= 100 ? 'ok' : '');
  });
  window.addEventListener('beforeunload', () => unsubscribe?.(), { once: true });

  bridge.getSetupState().then((state) => {
    if (state?.supabaseUrl) url.value = state.supabaseUrl;
    if (state?.supabasePublishableKey) key.value = state.supabasePublishableKey;
    if (state?.cardVaultKeyVersion) version.value = String(state.cardVaultKeyVersion);
    setProgress(8, 1, 'Έτοιμο για έλεγχο των στοιχείων σύνδεσης.');
  }).catch(() => setStatus('Δεν ήταν δυνατή η φόρτωση προεπιλεγμένων ρυθμίσεων.', 'error'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    setStatus('Έλεγχος ρυθμίσεων…');
    setProgress(15, 1, 'Έλεγχος HTTPS Supabase URL και publishable key…');
    try {
      await bridge.saveSetup({
        supabaseUrl: url.value.trim(),
        supabasePublishableKey: key.value.trim(),
        cardVaultKey: vault.value.trim(),
        cardVaultKeyVersion: Number(version.value || 1),
      });
      vault.value = '';
      setStatus('Το MyFinHub είναι έτοιμο.', 'ok');
      setProgress(100, 4, 'Ολοκληρώθηκε. Άνοιγμα MyFinHub…');
    } catch {
      setStatus('Η ρύθμιση δεν είναι έγκυρη. Έλεγξε URL, publishable key και προαιρετικό card-vault key.', 'error');
      setProgress(8, 1, 'Η ρύθμιση χρειάζεται διόρθωση πριν συνεχίσουμε.');
      save.disabled = false;
    }
  });
})();
