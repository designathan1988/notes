import { Component, type ReactNode } from 'react';
/** A failed lazy import must leave navigation and retained drafts available. */
export class LazyBoundary extends Component<
  { children: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="empty-state" role="alert">
        <h2>{this.props.name} could not be opened</h2>
        <p>Reconnect and reload this view. Your saved local drafts are kept.</p>
        <button className="button" onClick={() => location.reload()}>
          Reload view
        </button>
      </section>
    );
  }
}
