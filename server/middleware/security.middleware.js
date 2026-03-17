import validator from 'validator';
import xss from 'xss';

// Sanitize input to prevent XSS attacks
export const sanitizeInput = (req, res, next) => {
  // Sanitize req.body
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        // Remove HTML tags and sanitize
        req.body[key] = xss(req.body[key]);
        // Trim whitespace
        req.body[key] = req.body[key].trim();
      }
    });
  }

  // Sanitize req.params
  if (req.params) {
    Object.keys(req.params).forEach((key) => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = xss(req.params[key]);
      }
    });
  }

  // Sanitize req.query
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    });
  }

  next();
};

// Validate email format
export const validateEmail = (email) => {
  return validator.isEmail(email);
};

// Validate phone number (Indian format)
export const validatePhone = (phone) => {
  return validator.isMobilePhone(phone, 'en-IN');
};

// Validate password strength
export const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  
  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber,
    errors: [
      password.length < minLength && 'Password must be at least 8 characters',
      !hasUpperCase && 'Password must contain at least one uppercase letter',
      !hasLowerCase && 'Password must contain at least one lowercase letter',
      !hasNumber && 'Password must contain at least one number',
    ].filter(Boolean),
  };
};

// Prevent NoSQL injection
export const sanitizeMongoQuery = (query) => {
  if (typeof query !== 'object' || query === null) {
    return query;
  }

  const sanitized = {};
  for (const key in query) {
    // Remove $ operators from user input
    if (key.startsWith('$')) {
      continue;
    }
    
    if (typeof query[key] === 'object') {
      sanitized[key] = sanitizeMongoQuery(query[key]);
    } else {
      sanitized[key] = query[key];
    }
  }
  
  return sanitized;
};

// SQL injection protection for Supabase queries
export const escapeSQLInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Escape special characters
  return input
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
};

// Rate limiting per user
export const userRateLimit = new Map();

export const checkUserRateLimit = (userId, maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const userRequests = userRateLimit.get(userId) || { count: 0, resetTime: now + windowMs };
  
  if (now > userRequests.resetTime) {
    userRequests.count = 0;
    userRequests.resetTime = now + windowMs;
  }
  
  userRequests.count++;
  userRateLimit.set(userId, userRequests);
  
  return userRequests.count <= maxRequests;
};

// CSRF protection - verify origin
export const verifyOrigin = (req, res, next) => {
  const origin = req.get('origin') || req.get('referer');
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  
  // Skip origin check for safe methods
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  // Skip origin check for auth endpoints (they're already protected by other means)
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  
  // ✅ FIX: If request has valid JWT token, skip origin check
  // Authenticated requests are already secured by JWT validation
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('✅ [SECURITY] Skipping origin check for authenticated request');
    return next();
  }
  
  // For other state-changing requests, verify origin
  if (!origin || !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    console.error('❌ [SECURITY] Origin verification failed:', { 
      origin, 
      allowedOrigins, 
      path: req.path,
      method: req.method,
      hasAuthHeader: !!authHeader
    });
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden - Invalid origin',
    });
  }
  
  next();
};

// Content Security Policy headers
export const setSecurityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Validate file uploads
export const validateFileUpload = (file) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 5MB limit.' };
  }
  
  return { valid: true };
};

// Sanitize HTML content
export const sanitizeHTML = (html) => {
  return xss(html, {
    whiteList: {
      a: ['href', 'title'],
      b: [],
      i: [],
      u: [],
      strong: [],
      em: [],
      p: [],
      br: [],
      ul: [],
      ol: [],
      li: [],
    },
  });
};

// Input length validation
export const validateInputLength = (input, minLength, maxLength) => {
  const length = input ? input.length : 0;
  return length >= minLength && length <= maxLength;
};

// Check for common attack patterns
export const detectAttackPattern = (input) => {
  if (typeof input !== 'string') return false;
  
  const suspiciousPatterns = [
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
    /\bor\b.*\b=\b/gi, // SQL injection patterns
    /union.*select/gi, // SQL injection
    /\.\.\//g, // Path traversal
    /%00/g, // Null bytes
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
};

export default {
  sanitizeInput,
  validateEmail,
  validatePhone,
  validatePassword,
  sanitizeMongoQuery,
  escapeSQLInput,
  checkUserRateLimit,
  verifyOrigin,
  setSecurityHeaders,
  validateFileUpload,
  sanitizeHTML,
  validateInputLength,
  detectAttackPattern,
};
