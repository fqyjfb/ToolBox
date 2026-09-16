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
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full text-center">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
              页面出现错误
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
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
                className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                刷新页面
              </button>
            </div>
            {this.state.errorInfo && (
              <details className="mt-4 text-left text-sm text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer">查看详情</summary>
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-x-auto text-xs">
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