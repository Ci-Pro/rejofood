"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary untuk catch runtime errors di component tree.
 * Mencegah "This page couldn't load" — tampilkan error message yang helpful.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="font-display text-lg font-700 text-foreground">Terjadi kesalahan</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Komponen gagal dimuat. Coba refresh halaman.
          </p>
          {this.state.error?.message && (
            <p className="mt-2 rounded-lg bg-muted/50 p-2 font-mono text-[0.65rem] text-muted-foreground">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-700 text-primary-foreground hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
