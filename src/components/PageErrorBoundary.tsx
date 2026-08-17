import { Component, type ErrorInfo, type ReactNode } from 'react';

export class PageErrorBoundary extends Component<{ resetKey: string; onDashboard: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately avoid rendering/logging finance payloads or raw exception details in the UI.
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="panel neo-raised workspace-error" role="alert" aria-labelledby="workspace-error-title">
      <h2 id="workspace-error-title">Η ενότητα δεν μπόρεσε να εμφανιστεί</h2>
      <p>Τα οικονομικά δεδομένα δεν τροποποιήθηκαν. Δοκίμασε ξανά την ενότητα ή φόρτωσε ξανά την εφαρμογή.</p>
      <div className="editor-actions">
        <button className="secondary" type="button" onClick={() => this.setState({ failed: false })}>Δοκιμή ξανά</button>
        <button className="secondary" type="button" onClick={this.props.onDashboard}>Dashboard</button>
        <button className="save-button" type="button" onClick={() => location.reload()}>Επαναφόρτωση</button>
      </div>
    </section>;
  }
}
