import { Component, type ErrorInfo, type ReactNode } from "react";
import { I } from "./icons";

interface Props {
  children: ReactNode;
  /** Changing this key (e.g. the route) clears a previous error. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** Keeps one broken screen from taking down the whole app, and offers a way back. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunkFailed = /Loading chunk|dynamically imported module|Failed to fetch/i.test(this.state.error.message);
    return (
      <div role="alert" className="max-w-md mx-auto px-6 py-24 text-center">
        <I.warning className="w-12 h-12 mx-auto text-orange" aria-hidden />
        <h1 className="t-title1 text-ink mt-5">{chunkFailed ? "This screen couldn't load" : "Something went wrong on this screen"}</h1>
        <p className="t-body text-ink-2 mt-2">
          {chunkFailed ? "You may be offline, or the app was just updated. Reloading usually fixes it." : "Your decks and progress are safe. Reload to try again, or go back to Today."}
        </p>
        <div className="flex justify-center gap-2 mt-8">
          <button type="button" onClick={() => window.location.reload()} className="btn btn-filled h-11 px-5">
            Reload
          </button>
          <a href="/" className="btn btn-gray h-11 px-5">
            Go to Today
          </a>
        </div>
      </div>
    );
  }
}
