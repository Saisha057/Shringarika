/**
 * Two-Factor Authentication (2FA) System
 * 
 * Features:
 * 1. TOTP (Time-based One-Time Password) generation
 * 2. QR code generation for authenticator apps
 * 3. Backup codes for account recovery
 * 4. 2FA verification
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate 2FA secret for user
 */
export const generate2FASecret = async (userEmail, userName) => {
  try {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Shringarika (${userEmail})`,
      issuer: 'Shringarika',
      length: 32
    });
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url
    };
  } catch (error) {
    console.error('Error generating 2FA secret:', error);
    throw new Error('Failed to generate 2FA secret');
  }
};

/**
 * Verify 2FA token
 */
export const verify2FAToken = (secret, token) => {
  try {
    // Verify token with 30-second window (1 step before/after current)
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
    
    return verified;
  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    return false;
  }
};

/**
 * Generate backup codes
 */
export const generateBackupCodes = (count = 10) => {
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX
    const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
    codes.push(formattedCode);
  }
  
  return codes;
};

/**
 * Hash backup code for storage
 */
export const hashBackupCode = (code) => {
  return crypto
    .createHash('sha256')
    .update(code.replace('-', ''))
    .digest('hex');
};

/**
 * Verify backup code
 */
export const verifyBackupCode = (inputCode, hashedCodes) => {
  const hashedInput = hashBackupCode(inputCode);
  return hashedCodes.includes(hashedInput);
};

/**
 * Middleware: Require 2FA verification
 */
export const require2FA = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if user has 2FA enabled
    if (!user.two_factor_enabled) {
      return next();
    }
    
    // Check if 2FA is already verified in this session
    if (req.session?.twoFactorVerified) {
      return next();
    }
    
    // Check for 2FA token in header
    const token = req.headers['x-2fa-token'];
    
    if (!token) {
      return res.status(403).json({
        status: 'error',
        message: '2FA verification required',
        code: '2FA_REQUIRED',
        requiresTwoFactor: true
      });
    }
    
    // Verify token
    const isValid = verify2FAToken(user.two_factor_secret, token);
    
    if (!isValid) {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid 2FA token',
        code: '2FA_INVALID'
      });
    }
    
    // Mark 2FA as verified in session
    if (req.session) {
      req.session.twoFactorVerified = true;
    }
    
    next();
  } catch (error) {
    console.error('2FA middleware error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error verifying 2FA',
      code: '2FA_ERROR'
    });
  }
};

/**
 * Rate limiter for 2FA attempts
 */
const twoFactorAttempts = new Map();

export const limit2FAAttempts = (req, res, next) => {
  const identifier = req.user?.id || req.ip;
  const now = Date.now();
  
  // Get attempt history
  let attempts = twoFactorAttempts.get(identifier) || [];
  
  // Remove attempts older than 15 minutes
  attempts = attempts.filter(timestamp => now - timestamp < 15 * 60 * 1000);
  
  // Check if too many attempts
  if (attempts.length >= 5) {
    return res.status(429).json({
      status: 'error',
      message: 'Too many 2FA attempts. Please try again in 15 minutes.',
      code: '2FA_RATE_LIMIT'
    });
  }
  
  // Add current attempt
  attempts.push(now);
  twoFactorAttempts.set(identifier, attempts);
  
  next();
};

/**
 * Cleanup old attempt records
 */
const cleanup2FAAttempts = () => {
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  
  for (const [identifier, attempts] of twoFactorAttempts.entries()) {
    const validAttempts = attempts.filter(timestamp => now - timestamp < fifteenMinutes);
    
    if (validAttempts.length === 0) {
      twoFactorAttempts.delete(identifier);
    } else {
      twoFactorAttempts.set(identifier, validAttempts);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanup2FAAttempts, 5 * 60 * 1000);

export default {
  generate2FASecret,
  verify2FAToken,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  require2FA,
  limit2FAAttempts
};
