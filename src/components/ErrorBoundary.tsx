import React from 'react';
import { logError } from '../services/loggerService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ errorInfo: info });
    logError('React error boundary caught error', 'ErrorBoundary', error);
    console.error('Error boundary caught:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">页面出错了</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{this.state.error?.message || '发生了未知错误'}</p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={this.handleRetry}
                className="px-4 py-2 bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors"
              >
                重试
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white dark:text-gray-200 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-400 transition-colors"
              >
                刷新页面
              </button>
            </div>
            {this.state.errorInfo && (
              <details className="mt-6 text-left text-sm text-gray-500 dark:text-gray-400">
                <summary>查看详情</summary>
                <pre className="mt-2 p-4 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-x-auto">{this.state.errorInfo.componentStack}</pre>
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
