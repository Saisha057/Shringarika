/**
 * Input Sanitization Middleware
 * 
 * Protects against:
 * 1. XSS (Cross-Site Scripting) attacks
 * 2. SQL/NoSQL injection
 * 3. HTML injection
 * 4. Script injection
 */

import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import hpp from 'hpp';

/**
 * Sanitize request body, query params, and route params
 */
export const sanitizeInput = (req, res, next) => {
  // Sanitize all string inputs
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);
  
  next();
};

/**
 * Recursively sanitize object properties
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // XSS protection
      obj[key] = xss(obj[key], {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style']
      });
      
      // Trim whitespace
      obj[key] = obj[key].trim();
    } else if (typeof obj[key] === 'object') {
      // Recursively sanitize nested objects
      sanitizeObject(obj[key]);
    }
  }
};

/**
 * MongoDB/NoSQL injection protection
 * Removes $ and . from user input to prevent query injection
 */
export const sanitizeMongo = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[Security] Potential injection attempt detected: ${key} in ${req.method} ${req.path}`);
  }
});

/**
 * HTTP Parameter Pollution (HPP) protection
 * Prevents duplicate parameters in query strings
 */
export const preventParameterPollution = hpp({
  whitelist: [
    // Allow arrays for these parameters
    'sort',
    'fields',
    'category',
    'tags',
    'price',
    'rating'
  ]
});

/**
 * Sanitize HTML content (for rich text fields)
 */
export const sanitizeHtml = (html) => {
  return xss(html, {
    whiteList: {
      // Allow safe HTML tags for rich content
      p: [],
      br: [],
      strong: [],
      em: [],
      u: [],
      h1: [],
      h2: [],
      h3: [],
      h4: [],
      ul: [],
      ol: [],
      li: [],
      a: ['href', 'title', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height']
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe']
  });
};

/**
 * Strict sanitization for user-generated content (no HTML allowed)
 */
export const sanitizeUserContent = (content) => {
  if (typeof content !== 'string') {
    return content;
  }
  
  return xss(content, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
  }).trim();
};

/**
 * Validate and sanitize email
 */
export const sanitizeEmail = (email) => {
  if (typeof email !== 'string') {
    return '';
  }
  
  // Remove all non-email characters
  email = email.toLowerCase().trim();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email : '';
};

/**
 * Validate and sanitize phone number
 */
export const sanitizePhone = (phone) => {
  if (typeof phone !== 'string') {
    return '';
  }
  
  // Remove all non-numeric characters
  phone = phone.replace(/\D/g, '');
  
  // Validate phone number length (10 digits for India)
  return phone.length === 10 ? phone : '';
};

/**
 * Sanitize URL
 */
export const sanitizeUrl = (url) => {
  if (typeof url !== 'string') {
    return '';
  }
  
  try {
    const parsedUrl = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }
    
    return parsedUrl.href;
  } catch (error) {
    return '';
  }
};

/**
 * Prevent SQL injection in raw queries (for Supabase)
 */
export const sanitizeSqlInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /(--|\*|\/\*|\*\/|;|'|"|`|\\)/g,
    /(\bOR\b|\bAND\b).*?=.*?/gi
  ];
  
  let sanitized = input;
  sqlPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized.trim();
};

/**
 * Log security events
 */
const logSecurityEvent = (req, type, details) => {
  console.warn(`[Security Alert] ${new Date().toISOString()}`);
  console.warn(`Type: ${type}`);
  console.warn(`IP: ${req.ip}`);
  console.warn(`Path: ${req.method} ${req.path}`);
  console.warn(`User-Agent: ${req.headers['user-agent']}`);
  console.warn(`Details:`, details);
  console.warn('---');
};

/**
 * Detect malicious patterns
 */
export const detectMaliciousInput = (req, res, next) => {
  const checkString = (str, source) => {
    if (typeof str !== 'string') return;
    
    // Check for XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];
    
    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b.*?\b(FROM|INTO|WHERE)\b)/gi,
      /(;.*?(DROP|DELETE|INSERT|UPDATE))/gi,
      /('.*?OR.*?'.*?=.*?')/gi
    ];
    
    for (const pattern of [...xssPatterns, ...sqlPatterns]) {
      if (pattern.test(str)) {
        logSecurityEvent(req, 'Malicious Input Detected', {
          source,
          pattern: pattern.toString(),
          value: str.substring(0, 100)
        });
      }
    }
  };
  
  // Check all inputs
  const checkObject = (obj, source) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        checkString(obj[key], `${source}.${key}`);
      } else if (typeof obj[key] === 'object') {
        checkObject(obj[key], `${source}.${key}`);
      }
    }
  };
  
  checkObject(req.body, 'body');
  checkObject(req.query, 'query');
  checkObject(req.params, 'params');
  
  next();
};

export default {
  sanitizeInput,
  sanitizeMongo,
  preventParameterPollution,
  sanitizeHtml,
  sanitizeUserContent,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeSqlInput,
  detectMaliciousInput
};
