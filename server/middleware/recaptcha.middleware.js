/**
 * reCAPTCHA Protection Middleware
 * 
 * Protects forms against bots and automated attacks using Google reCAPTCHA v2
 */

// Only initialize reCAPTCHA if keys are configured
let recaptcha = null;

if (process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY) {
  const { RecaptchaV2 } = await import('express-recaptcha');
  recaptcha = new RecaptchaV2(
    process.env.RECAPTCHA_SITE_KEY,
    process.env.RECAPTCHA_SECRET_KEY
  );
}

/**
 * Verify reCAPTCHA token
 */
export const verifyRecaptcha = recaptcha?.middleware?.verify;

/**
 * Custom reCAPTCHA verification middleware
 */
export const checkRecaptcha = async (req, res, next) => {
  try {
    // Skip in test/development if not configured
    if (!process.env.RECAPTCHA_SECRET_KEY || process.env.NODE_ENV === 'test') {
      console.warn('[reCAPTCHA] Skipping verification - not configured or in test mode');
      return next();
    }
    
    // Get token from body
    const token = req.body['g-recaptcha-response'];
    
    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'reCAPTCHA verification required',
        code: 'RECAPTCHA_MISSING'
      });
    }
    
    // Verify with Google
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}&remoteip=${req.ip}`
    });
    
    const data = await response.json();
    
    if (!data.success) {
      return res.status(400).json({
        status: 'error',
        message: 'reCAPTCHA verification failed',
        code: 'RECAPTCHA_FAILED',
        errors: data['error-codes']
      });
    }
    
    // Check score for v3 (if using v3 in future)
    if (data.score !== undefined && data.score < 0.5) {
      return res.status(400).json({
        status: 'error',
        message: 'reCAPTCHA score too low',
        code: 'RECAPTCHA_LOW_SCORE',
        score: data.score
      });
    }
    
    next();
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    
    // In production, fail closed (reject request)
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        status: 'error',
        message: 'Error verifying reCAPTCHA',
        code: 'RECAPTCHA_ERROR'
      });
    }
    
    // In development, fail open (allow request)
    console.warn('[reCAPTCHA] Allowing request due to verification error in development');
    next();
  }
};

/**
 * Generate reCAPTCHA HTML
 */
export const renderRecaptcha = recaptcha?.middleware?.render;

/**
 * Get reCAPTCHA site key (for frontend)
 */
export const getRecaptchaSiteKey = (req, res) => {
  res.status(200).json({
    status: 'success',
    siteKey: process.env.RECAPTCHA_SITE_KEY || null
  });
};

/**
 * Rate limiting for failed reCAPTCHA attempts
 */
const recaptchaFailures = new Map();

export const limitRecaptchaFailures = (req, res, next) => {
  const identifier = req.ip;
  const now = Date.now();
  
  // Get failure history
  let failures = recaptchaFailures.get(identifier) || [];
  
  // Remove failures older than 1 hour
  failures = failures.filter(timestamp => now - timestamp < 60 * 60 * 1000);
  
  // Check if too many failures
  if (failures.length >= 10) {
    return res.status(429).json({
      status: 'error',
      message: 'Too many reCAPTCHA failures. Please try again later.',
      code: 'RECAPTCHA_RATE_LIMIT'
    });
  }
  
  // Store original send to track failures
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // If reCAPTCHA failed, record it
    if (data.code === 'RECAPTCHA_FAILED' || data.code === 'RECAPTCHA_LOW_SCORE') {
      failures.push(now);
      recaptchaFailures.set(identifier, failures);
    }
    return originalJson(data);
  };
  
  next();
};

/**
 * Cleanup old failure records
 */
const cleanupRecaptchaFailures = () => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [identifier, failures] of recaptchaFailures.entries()) {
    const validFailures = failures.filter(timestamp => now - timestamp < oneHour);
    
    if (validFailures.length === 0) {
      recaptchaFailures.delete(identifier);
    } else {
      recaptchaFailures.set(identifier, validFailures);
    }
  }
};

// Run cleanup every 10 minutes
setInterval(cleanupRecaptchaFailures, 10 * 60 * 1000);

export default {
  verifyRecaptcha,
  checkRecaptcha,
  renderRecaptcha,
  getRecaptchaSiteKey,
  limitRecaptchaFailures
};
