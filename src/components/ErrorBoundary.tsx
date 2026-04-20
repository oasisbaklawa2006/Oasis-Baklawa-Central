import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  networkStabilizing: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private readonly networkFailureWindowMs = 10_000;
  private readonly networkFailureThreshold = 5;
  private networkFailureTimestamps: number[] = [];
  private originalConsoleError = console.error;
  private originalConsoleWarn = console.warn;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, networkStabilizing: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Ignore browser-extension noise (AdBlock, password managers, etc.)
    const msg = `${error?.message ?? ""} ${error?.stack ?? ""}`;
    if (/chrome-extension:\/\/|moz-extension:\/\/|safari-extension:\/\//i.test(msg)) {
      return {};
    }
    // Network / fetch / websocket failures → degrade to Static Mode (cached data),
    // do NOT blank the screen.
    if (/Failed to fetch|NetworkError|WebSocket.+(closed|failed)|ERR_NETWORK|Load failed/i.test(msg)) {
      return { networkStabilizing: true };
    }
    return { hasError: true, error };
  }

  componentDidMount() {
    const onWindowError = (event: ErrorEvent) => {
      this.trackNetworkFailure(event.message || event.error?.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
      this.trackNetworkFailure(reason);
    };

    console.error = (...args) => {
      this.trackNetworkFailure(args);
      this.originalConsoleError(...args);
    };

    console.warn = (...args) => {
      this.trackNetworkFailure(args);
      this.originalConsoleWarn(...args);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    this.cleanupListeners = () => {
      console.error = this.originalConsoleError;
      console.warn = this.originalConsoleWarn;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }

  componentWillUnmount() {
    this.cleanupListeners?.();
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private cleanupListeners?: () => void;

  private trackNetworkFailure(input: unknown) {
    if (this.state.networkStabilizing) return;

    const message = Array.isArray(input)
      ? input.map((entry) => this.stringifyEntry(entry)).join(" ")
      : this.stringifyEntry(input);

    if (!/(UnableToConnectToProject|signal timed out|WebSocket.+closed|CHANNEL_ERROR|TIMED_OUT|Failed to fetch|NetworkError)/i.test(message)) {
      return;
    }

    const now = Date.now();
    this.networkFailureTimestamps = this.networkFailureTimestamps
      .filter((timestamp) => now - timestamp <= this.networkFailureWindowMs)
      .concat(now);

    if (this.networkFailureTimestamps.length >= this.networkFailureThreshold) {
      this.setState({ networkStabilizing: true });
    }
  }

  private stringifyEntry(entry: unknown) {
    if (entry instanceof Error) return `${entry.name} ${entry.message}`;
    if (typeof entry === "string") return entry;
    try {
      return JSON.stringify(entry);
    } catch {
      return String(entry ?? "");
    }
  }

  render() {
    if (this.state.networkStabilizing) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
            <h2 className="text-xl font-bold text-foreground">Network Stabilizing...</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Live connection retries were paused after repeated failures. Standard fetching remains active.
            </p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-xl w-full rounded-2xl border border-border bg-card p-8 shadow-lg">
            <h2 className="mb-2 text-xl font-bold text-foreground">
              {this.props.fallbackTitle || "Something went wrong"}
            </h2>
            <p className="mb-4 font-mono text-sm text-muted-foreground">
              {this.state.error?.message}
            </p>
            <details className="whitespace-pre-wrap text-xs text-muted-foreground">
              <summary className="mb-2 cursor-pointer font-semibold">Stack trace</summary>
              {this.state.error?.stack}
              {this.state.errorInfo?.componentStack}
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
