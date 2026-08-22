(() => {
  const bridge = window.myFinHubDesktop;
  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  const progress = document.getElementById('progress-bar');
  const progressShell = progress?.parentElement;
  const liveLine = document.getElementById('live-line');
  const diagnosticPanel = document.getElementById('diagnostic-panel');
  const diagnosticCode = document.getElementById('diagnostic-code');
  const diagnosticStage = document.getElementById('diagnostic-stage');
  const diagnosticMessage = document.getElementById('diagnostic-message');
  const diagnosticDetail = document.getElementById('diagnostic-detail');
  const copyDiagnostics = document.getElementById('copy-diagnostics');
  let recoveryState = null;

  const setStatus = (message, kind = '') => {
    status.textContent = message;
    status.className = `status ${kind}`.trim();
  };

  const renderDiagnostic = (error) => {
    if (!diagnosticPanel) return;
    if (!error) {
      diagnosticPanel.hidden = true;
      return;
    }
    diagnosticPanel.hidden = false;
    diagnosticCode.textContent = String(error.code || 'DESKTOP_STARTUP_FAILED');
    diagnosticStage.textContent = String(error.stage || 'startup');
    diagnosticMessage.textContent = String(error.message || 'Η εκκίνηση απέτυχε.');
    diagnosticDetail.textContent = String(error.detail || 'Δεν υπάρχει επιπλέον ασφαλές diagnostic detail.');
  };

  const applyState = (state) => {
    if (!state) return;
    recoveryState = { ...recoveryState, ...state };
    const numeric = Math.max(0, Math.min(100, Number(state.progress) || 0));
    if (progress) progress.style.width = `${numeric}%`;
    if (progressShell) progressShell.setAttribute('aria-valuenow', String(numeric));
    if (liveLine && state.message) liveLine.textContent = state.message;
    renderDiagnostic(state.error);
    if (state.error) setStatus(`${state.error.message} Κωδικός: ${state.error.code}`, 'error');
    else if (state.message) setStatus(state.message, numeric >= 100 ? 'ok' : '');
  };

  if (!bridge) {
    retry.disabled = true;
    copyDiagnostics.disabled = true;
    setStatus('Η ασφαλής desktop γέφυρα δεν είναι διαθέσιμη.', 'error');
    renderDiagnostic({ code: 'DESKTOP_BRIDGE_UNAVAILABLE', stage: 'recovery-ui', message: 'Η desktop γέφυρα δεν φορτώθηκε.', detail: 'Κλείσε και άνοιξε ξανά το MyFinHub. Αν επαναληφθεί, χρησιμοποίησε την επόμενη διορθωμένη έκδοση.' });
    return;
  }

  const unsubscribe = bridge.onSetupProgress?.((state) => applyState(state));
  window.addEventListener('beforeunload', () => unsubscribe?.(), { once: true });

  bridge.getSetupState().then((state) => applyState(state)).catch((error) => {
    setStatus('Δεν ήταν δυνατή η φόρτωση της κατάστασης εκκίνησης.', 'error');
    renderDiagnostic({ code: 'RECOVERY_STATE_LOAD_FAILED', stage: 'recovery-ui', message: 'Η φόρτωση της κατάστασης εκκίνησης απέτυχε.', detail: String(error?.message || '') });
  });

  retry.addEventListener('click', async () => {
    retry.disabled = true;
    renderDiagnostic(null);
    setStatus('Νέα προσπάθεια εκκίνησης…');
    try {
      if (!recoveryState?.supabaseUrl || !recoveryState?.supabasePublishableKey) {
        throw new Error('Application-owned runtime configuration is unavailable.');
      }
      const result = await bridge.saveSetup({
        supabaseUrl: recoveryState.supabaseUrl,
        supabasePublishableKey: recoveryState.supabasePublishableKey,
        cardVaultKey: '',
        cardVaultKeyVersion: Number(recoveryState.cardVaultKeyVersion || 1),
      });
      if (!result?.ok) {
        applyState({ progress: 8, message: result?.error?.message || 'Η νέα προσπάθεια απέτυχε.', error: result?.error });
        retry.disabled = false;
        return;
      }
      setStatus('Η εκκίνηση ολοκληρώθηκε.', 'ok');
    } catch (error) {
      renderDiagnostic({ code: 'DESKTOP_RETRY_FAILED', stage: 'recovery-ui', message: 'Η νέα προσπάθεια εκκίνησης δεν ολοκληρώθηκε.', detail: String(error?.message || '') });
      setStatus('Η νέα προσπάθεια απέτυχε. Τα διαγνωστικά παραμένουν διαθέσιμα.', 'error');
      retry.disabled = false;
    }
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
})();