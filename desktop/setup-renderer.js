(() => {
  const bridge = window.myFinHubDesktop;
  const form = document.getElementById('setup-form');
  const url = document.getElementById('supabase-url');
  const key = document.getElementById('publishable-key');
  const vault = document.getElementById('vault-key');
  const version = document.getElementById('vault-version');
  const status = document.getElementById('status');
  const save = document.getElementById('save');

  const setStatus = (message, kind = '') => {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  };

  if (!bridge) {
    setStatus('Η ασφαλής desktop γέφυρα δεν είναι διαθέσιμη.', 'error');
    save.disabled = true;
    return;
  }

  bridge.getSetupState().then((state) => {
    if (state?.supabaseUrl) url.value = state.supabaseUrl;
    if (state?.supabasePublishableKey) key.value = state.supabasePublishableKey;
    if (state?.cardVaultKeyVersion) version.value = String(state.cardVaultKeyVersion);
  }).catch(() => setStatus('Δεν ήταν δυνατή η φόρτωση προεπιλεγμένων ρυθμίσεων.', 'error'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    setStatus('Αποθήκευση ασφαλούς ρύθμισης…');
    try {
      await bridge.saveSetup({
        supabaseUrl: url.value.trim(),
        supabasePublishableKey: key.value.trim(),
        cardVaultKey: vault.value.trim(),
        cardVaultKeyVersion: Number(version.value || 1),
      });
      vault.value = '';
      setStatus('Η ρύθμιση αποθηκεύτηκε. Εκκίνηση MyFinHub…', 'ok');
    } catch {
      setStatus('Η ρύθμιση δεν είναι έγκυρη. Έλεγξε URL, publishable key και προαιρετικό card-vault key.', 'error');
      save.disabled = false;
    }
  });
})();
