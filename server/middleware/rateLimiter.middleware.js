import rateLimit from 'express-rate-limit';
import { getRedisClient } from '../config/redis.js';

/**
 * Rate limiting configurations for different endpoints
 */

// General API rate limit
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const reqPath = req.path || '';
    const hasAuthToken = !!req.headers.authorization;
    const isAdminRoute = reqPath.startsWith('/admin');
    const isVariantRoute = reqPath.startsWith('/products/') && reqPath.includes('/variants');

    // Admin and variant routes are handled by dedicated limiters.
    // Skip here to avoid counting the same request twice.
    return (isAdminRoute && hasAuthToken) || isVariantRoute;
  },
  // Use Redis store if available
  store: getRedisClient() ? undefined : undefined, // Will add Redis store implementation below
});

// Strict rate limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: {
    status: 'error',
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
});

// Moderate rate limit for creating resources
export const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    status: 'error',
    message: 'Too many creation requests. Please slow down.'
  },
});

// Strict rate limit for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 uploads per minute
  message: {
    status: 'error',
    message: 'Too many file uploads. Please try again later.'
  },
});

// Very strict rate limit for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    status: 'error',
    message: 'Too many password reset attempts. Please try again after 1 hour.'
  },
});

// Moderate limit for search endpoints
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    status: 'error',
    message: 'Too many search requests. Please slow down.'
  },
});

// Admin endpoints - less strict
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests
  message: {
    status: 'error',
    message: 'Admin rate limit exceeded. Please wait.'
  },
  skip: (req) => !!req.headers.authorization,
});

// Variant endpoints can be called in bursts from admin workflows
export const variantLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: {
    status: 'error',
    message: 'Too many requests.'
  },
});

export default {
  generalLimiter,
  authLimiter,
  createLimiter,
  uploadLimiter,
  passwordResetLimiter,
  searchLimiter,
  adminLimiter,
  variantLimiter
};
