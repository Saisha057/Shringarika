import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo,
    })

    // Auto-reload for Vite HMR/dynamic import errors
    if (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('ERR_CONNECTION_REFUSED') ||
        error.message.includes('dynamically imported module')) {
      console.log('🔄 Detected Vite HMR error - Auto-reloading in 2 seconds...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }

    // Log to Sentry if available
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      })
    }

    // Log to custom error tracking service
    this.logErrorToService(error, errorInfo)
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Send error to backend for logging
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      fetch(`${API_URL}/errors/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch(err => console.error('Failed to log error:', err))
    } catch (err) {
      console.error('Error logging failed:', err)
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-wider">SOMETHING WENT WRONG</h1>
                <p className="text-neutral-600 text-sm mt-1">
                  We apologize for the inconvenience. An error has occurred.
                </p>
              </div>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-neutral-50 rounded border border-neutral-300">
                <h2 className="text-sm font-bold tracking-wider mb-2">ERROR DETAILS:</h2>
                <p className="text-sm text-red-600 mb-2 font-mono">{this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="text-xs text-neutral-700 overflow-auto max-h-40 bg-neutral-100 p-2 rounded">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-black text-white py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
              >
                GO TO HOME PAGE
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 border border-black py-3 rounded-full text-sm tracking-wider hover:bg-black hover:text-white transition-colors"
              >
                RELOAD PAGE
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-200 text-center text-sm text-neutral-600">
              <p>
                If this problem persists, please contact our support team at{' '}
                <a href="mailto:support@shringarika.com" className="text-black underline">
                  support@shringarika.com
                </a>
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Extend Window interface for Sentry
declare global {
  interface Window {
    Sentry?: any
  }
}
