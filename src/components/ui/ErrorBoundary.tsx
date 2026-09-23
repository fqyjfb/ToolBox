import { Component, ErrorInfo, ReactNode } from 'react';
import { logError } from '../../services/loggerService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    logError(`Error Boundary caught error: ${error.message}`, 'ErrorBoundary', error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.children !== prevProps.children && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="bg-surface rounded-lg shadow-sm border border-content p-6 max-w-md w-full text-center">
            <h2 className="text-xl font-semibold text-content-primary mb-2">
              页面出现错误
            </h2>
            <p className="text-content-secondary mb-4 text-sm">
              {this.state.error?.message || '抱歉，页面加载时发生了错误。请尝试刷新页面。'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-primary text-button-text rounded-md hover:bg-primary-hover transition-colors"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-surface-secondary text-content-primary hover:bg-menu-hover transition-colors"
              >
                刷新页面
              </button>
            </div>
            {this.state.errorInfo && (
              <details className="mt-4 text-left text-sm text-content-secondary">
                <summary className="cursor-pointer">查看详情</summary>
                <pre className="mt-2 p-3 bg-surface-secondary rounded-lg overflow-x-auto text-xs">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;