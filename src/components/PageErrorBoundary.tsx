import { Component, createRef, type ErrorInfo, type ReactNode } from 'react';

export class PageErrorBoundary extends Component<{ resetKey: string; onDashboard: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private errorRef = createRef<HTMLElement>();

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately avoid rendering/logging finance payloads or raw exception details in the UI.
    requestAnimationFrame(() => this.errorRef.current?.focus({ preventScroll: true }));
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  private recoverDashboard = () => {
    // Parent recovery must be scheduled before reopening the child tree. If the
    // current route is already Dashboard, clearing the boundary first would
    // immediately render the same failed child once more before the parent had
    // a chance to clear its crash state.
    this.props.onDashboard();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return <section ref={this.errorRef} className="panel neo-raised workspace-error" role="alert" aria-labelledby="workspace-error-title" tabIndex={-1}>
      <h2 id="workspace-error-title">Η ενότητα δεν μπόρεσε να εμφανιστεί</h2>
      <p>Τα οικονομικά δεδομένα δεν τροποποιήθηκαν. Δοκίμασε ξανά την ενότητα ή, αν το πρόβλημα συνεχίζεται, επαναφόρτωσε την εφαρμογή.</p>
      <div className="editor-actions">
        <button className="secondary" type="button" onClick={() => this.setState({ failed: false })}>Δοκιμή ξανά</button>
        <button className="secondary" type="button" onClick={this.recoverDashboard}>Dashboard</button>
        <button className="save-button" type="button" onClick={() => location.reload()}>Επαναφόρτωση εφαρμογής</button>
      </div>
    </section>;
  }
}
