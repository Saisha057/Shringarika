/**
 * SECURITY UTILITIES
 * 
 * Features:
 * - HTTPS enforcement
 * - CSRF token generation
 * - Secure storage
 * - Content Security Policy helpers
 * - XSS prevention
 */

/**
 * Enforce HTTPS in production
 */
export const enforceHTTPS = () => {
  if (import.meta.env.PROD && window.location.protocol === 'http:') {
    window.location.href = window.location.href.replace('http:', 'https:')
  }
}

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Store CSRF token securely
 */
export const storeCSRFToken = () => {
  const token = generateCSRFToken()
  sessionStorage.setItem('csrf_token', token)
  return token
}

/**
 * Get CSRF token
 */
export const getCSRFToken = (): string | null => {
  return sessionStorage.getItem('csrf_token')
}

/**
 * Secure localStorage wrapper
 * Adds encryption for sensitive data
 */
export class SecureStorage {
  private prefix = 'secure_'

  /**
   * Simple XOR encryption (for demo purposes)
   * In production, use proper encryption libraries
   */
  private encrypt(text: string, key: string): string {
    let encrypted = ''
    for (let i = 0; i < text.length; i++) {
      encrypted += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      )
    }
    return btoa(encrypted)
  }

  private decrypt(encrypted: string, key: string): string {
    const text = atob(encrypted)
    let decrypted = ''
    for (let i = 0; i < text.length; i++) {
      decrypted += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      )
    }
    return decrypted
  }

  private getKey(): string {
    // In production, derive this from user session or environment
    return 'user_session_key_' + (sessionStorage.getItem('user_id') || 'anonymous')
  }

  setItem(key: string, value: string): void {
    try {
      const encrypted = this.encrypt(value, this.getKey())
      localStorage.setItem(this.prefix + key, encrypted)
    } catch (error) {
      console.error('SecureStorage: Failed to store item', error)
    }
  }

  getItem(key: string): string | null {
    try {
      const encrypted = localStorage.getItem(this.prefix + key)
      if (!encrypted) return null
      return this.decrypt(encrypted, this.getKey())
    } catch (error) {
      console.error('SecureStorage: Failed to retrieve item', error)
      return null
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(this.prefix + key)
  }

  clear(): void {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key)
      }
    })
  }
}

export const secureStorage = new SecureStorage()

/**
 * Detect and prevent common attacks
 */
export const detectAttack = (input: string): boolean => {
  // SQL Injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/i,
    /(--|\/\*|\*\/|;)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i
  ]

  // XSS patterns
  const xssPatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi
  ]

  // Check SQL injection
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      console.warn('Potential SQL injection detected:', input)
      return true
    }
  }

  // Check XSS
  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      console.warn('Potential XSS attack detected:', input)
      return true
    }
  }

  return false
}

/**
 * Content Security Policy helper
 */
export const setCSPMeta = () => {
  const meta = document.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://shringarika.onrender.com wss://shringarika.onrender.com https://srdljxbumxkgjxoqqrzs.supabase.co wss://srdljxbumxkgjxoqqrzs.supabase.co https://*.supabase.co wss://*.supabase.co https://checkout.razorpay.com https://api.razorpay.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
  document.head.appendChild(meta)
}

/**
 * Sanitize URL to prevent open redirect attacks
 */
export const sanitizeURL = (url: string): string => {
  try {
    const parsed = new URL(url, window.location.origin)
    
    // Only allow same-origin URLs or whitelisted domains
    const allowedDomains = [window.location.hostname, 'www.example.com']
    
    if (!allowedDomains.includes(parsed.hostname)) {
      console.warn('Blocked redirect to external domain:', parsed.hostname)
      return '/'
    }
    
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return '/'
  }
}

/**
 * Hash sensitive data (for comparison, not storage)
 */
export const hashData = async (data: string): Promise<string> => {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate secure random ID
 */
export const generateSecureId = (): string => {
  return crypto.randomUUID()
}

/**
 * Check if running on secure connection
 */
export const isSecureConnection = (): boolean => {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost'
}

/**
 * Initialize security measures
 */
export const initializeSecurity = () => {
  // Enforce HTTPS in production
  enforceHTTPS()

  // Generate CSRF token
  if (!getCSRFToken()) {
    storeCSRFToken()
  }

  // Set CSP meta tag
  if (import.meta.env.PROD) {
    setCSPMeta()
  }

  // Disable right-click in production (optional)
  if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
      // Allow right-click on inputs and textareas
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      e.preventDefault()
    })
  }

  // Prevent console access in production
  if (import.meta.env.PROD) {
    // Clear console
    console.clear()
    
    // Override console methods
    const noop = () => {}
    console.log = noop
    console.warn = noop
    console.error = noop
    console.info = noop
  }

  console.log('🔒 Security measures initialized')
}
