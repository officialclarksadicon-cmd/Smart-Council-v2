import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Smart Council ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)] p-6"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 sm:p-8 space-y-4 text-center shadow-xl">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#ef4444]/15 text-[#ef4444]">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Something went wrong
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              The portal encountered a temporary display issue. Your session and
              data remain safe.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="gemini-cta inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Reload Portal</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
