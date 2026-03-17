/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 * 
 * Protects against CSRF attacks by:
 * 1. Generating unique tokens for each session
 * 2. Validating tokens on state-changing requests
 * 3. Using double-submit cookie pattern
 */

import crypto from 'crypto';

// Store for CSRF tokens (in production, use Redis)
const csrfTokens = new Map();

// Token expiry time (15 minutes)
const TOKEN_EXPIRY = 15 * 60 * 1000;

/**
 * Generate CSRF token
 */
export const generateCsrfToken = (req, res, next) => {
  // Generate unique token
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = req.sessionID || req.ip + req.headers['user-agent'];
  
  // Store token with expiry
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + TOKEN_EXPIRY
  });
  
  // Set token in cookie (httpOnly for security)
  res.cookie('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY
  });
  
  // Also send in response header for frontend
  res.setHeader('X-CSRF-Token', token);
  
  req.csrfToken = token;
  next();
};

/**
 * Validate CSRF token
 */
export const validateCsrfToken = (req, res, next) => {
  // Skip validation for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get token from header or body
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body._csrf;
  const tokenFromQuery = req.query._csrf;
  
  const submittedToken = tokenFromHeader || tokenFromBody || tokenFromQuery;
  
  if (!submittedToken) {
    return res.status(403).json({
      status: 'error',
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }
  
  // Get stored token
  const sessionId = req.sessionID || req.ip + req.headers['user-agent'];
  const storedData = csrfTokens.get(sessionId);
  
  if (!storedData) {
    return res.status(403).json({
      status: 'error',
      message: 'CSRF token not found',
      code: 'CSRF_TOKEN_NOT_FOUND'
    });
  }
  
  // Check if token expired
  if (Date.now() > storedData.expires) {
    csrfTokens.delete(sessionId);
    return res.status(403).json({
      status: 'error',
      message: 'CSRF token expired',
      code: 'CSRF_TOKEN_EXPIRED'
    });
  }
  
  // Validate token
  if (submittedToken !== storedData.token) {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }
  
  // Token is valid, generate new one for next request
  const newToken = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, {
    token: newToken,
    expires: Date.now() + TOKEN_EXPIRY
  });
  
  res.cookie('csrf-token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY
  });
  
  res.setHeader('X-CSRF-Token', newToken);
  req.csrfToken = newToken;
  
  next();
};

/**
 * Cleanup expired tokens (run periodically)
 */
export const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(sessionId);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

/**
 * Get CSRF token for current session
 */
export const getCsrfToken = (req, res) => {
  res.status(200).json({
    status: 'success',
    csrfToken: req.csrfToken || res.getHeader('X-CSRF-Token')
  });
};
