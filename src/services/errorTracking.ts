import * as Sentry from "@sentry/react"

// Initialize Sentry for error tracking
export const initSentry = () => {
  // Only initialize in production or if explicitly enabled
  const isDevelopment = import.meta.env.MODE === 'development'
  const sentryDSN = import.meta.env.VITE_SENTRY_DSN

  if (!sentryDSN) {
    console.log('Sentry DSN not configured. Error tracking disabled.')
    return
  }

  Sentry.init({
    dsn: sentryDSN,
    environment: import.meta.env.MODE,
    enabled: !isDevelopment || import.meta.env.VITE_ENABLE_SENTRY === 'true',
    
    // Set sample rate for performance monitoring
    tracesSampleRate: isDevelopment ? 0.1 : 1.0,
    
    // Capture unhandled promise rejections
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Session Replay sample rate
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Ignore specific errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Network request failed',
    ],

    // Before sending error to Sentry
    beforeSend(event, hint) {
      // Filter out errors from browser extensions
      if (event.exception) {
        const error = hint.originalException
        if (error && typeof error === 'object' && 'message' in error) {
          const message = (error as Error).message
          if (message.includes('extension://') || message.includes('chrome-extension://')) {
            return null
          }
        }
      }

      // Add user context if available
      const userEmail = localStorage.getItem('userEmail')
      if (userEmail) {
        event.user = {
          ...event.user,
          email: userEmail,
        }
      }

      return event
    },
  })

  // Expose Sentry globally for ErrorBoundary
  window.Sentry = Sentry
}

// Helper function to manually log errors
export const logError = (error: Error, context?: Record<string, any>) => {
  if (window.Sentry) {
    window.Sentry.captureException(error, {
      extra: context,
    })
  } else {
    console.error('Error:', error, 'Context:', context)
  }
}

// Helper function to log messages
export const logMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
  if (window.Sentry) {
    window.Sentry.captureMessage(message, level)
  } else {
    console[level](message)
  }
}

// Set user context for error tracking
export const setUserContext = (user: { id: string; email: string; name?: string }) => {
  if (window.Sentry) {
    window.Sentry.setUser(user)
  }
}

// Clear user context on logout
export const clearUserContext = () => {
  if (window.Sentry) {
    window.Sentry.setUser(null)
  }
}

// Add breadcrumb for debugging
export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  if (window.Sentry) {
    window.Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    })
  }
}

// Declare Sentry on Window
declare global {
  interface Window {
    Sentry?: typeof Sentry
  }
}
