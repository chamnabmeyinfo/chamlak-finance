import React, { Component, ErrorInfo, ReactNode } from 'react';
import { CategoryIcon } from './components/CategoryIcon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Props;

  public state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React App:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.setItem('finance_tracker_is_guest', 'true');
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <CategoryIcon name="AlertTriangle" size={32} />
          </div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            An unexpected application error occurred. Click below to reload and restore your workspace safely.
          </p>
          <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-xs font-mono text-rose-300 max-w-lg overflow-x-auto mb-6 text-left">
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
          >
            <CategoryIcon name="RefreshCcw" size={14} />
            Reload & Continue
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
