/**
 * API Key Management System
 * 
 * Features:
 * 1. API key generation
 * 2. Key validation
 * 3. Key rotation
 * 4. Usage tracking
 * 5. Rate limiting per key
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';

/**
 * Generate API key
 */
export const generateApiKey = () => {
  // Generate random 32-byte key
  const key = crypto.randomBytes(32).toString('hex');
  
  // Add prefix for identification
  return `sk_${key}`;
};

/**
 * Hash API key for storage
 */
export const hashApiKey = (apiKey) => {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
};

/**
 * Create API key for user
 */
export const createApiKey = async (userId, name, permissions = []) => {
  try {
    // Generate key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);
    
    // Store in database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name: name,
        key_hash: hashedKey,
        permissions: permissions,
        is_active: true,
        last_used_at: null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Return unhashed key only once
    return {
      id: data.id,
      key: apiKey, // Only shown once!
      name: data.name,
      permissions: data.permissions,
      created_at: data.created_at
    };
  } catch (error) {
    console.error('Error creating API key:', error);
    throw new Error('Failed to create API key');
  }
};

/**
 * Validate API key middleware
 */
export const validateApiKey = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        status: 'error',
        message: 'API key required',
        code: 'API_KEY_REQUIRED'
      });
    }
    
    // Validate key format
    if (!apiKey.startsWith('sk_')) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid API key format',
        code: 'API_KEY_INVALID_FORMAT'
      });
    }
    
    // Hash and lookup key
    const hashedKey = hashApiKey(apiKey);
    
    const { data: keyData, error } = await supabase
      .from('api_keys')
      .select('*, users(*)')
      .eq('key_hash', hashedKey)
      .eq('is_active', true)
      .single();
    
    if (error || !keyData) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid API key',
        code: 'API_KEY_INVALID'
      });
    }
    
    // Check if user is active
    if (!keyData.users.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'User account is inactive',
        code: 'USER_INACTIVE'
      });
    }
    
    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);
    
    // Attach key and user to request
    req.apiKey = keyData;
    req.user = keyData.users;
    
    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error validating API key',
      code: 'API_KEY_VALIDATION_ERROR'
    });
  }
};

/**
 * Check API key permissions
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    const permissions = req.apiKey?.permissions || [];
    
    if (!permissions.includes(permission) && !permissions.includes('*')) {
      return res.status(403).json({
        status: 'error',
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission
      });
    }
    
    next();
  };
};

/**
 * Rotate API key
 */
export const rotateApiKey = async (keyId, userId) => {
  try {
    // Get existing key
    const { data: existingKey, error: fetchError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existingKey) {
      throw new Error('API key not found');
    }
    
    // Generate new key
    const newApiKey = generateApiKey();
    const hashedKey = hashApiKey(newApiKey);
    
    // Update key in database
    const { data, error } = await supabase
      .from('api_keys')
      .update({
        key_hash: hashedKey,
        rotated_at: new Date().toISOString()
      })
      .eq('id', keyId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return {
      id: data.id,
      key: newApiKey, // Only shown once!
      name: data.name,
      rotated_at: data.rotated_at
    };
  } catch (error) {
    console.error('Error rotating API key:', error);
    throw new Error('Failed to rotate API key');
  }
};

/**
 * Revoke API key
 */
export const revokeApiKey = async (keyId, userId) => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error('API key not found');
    }
    
    return {
      id: data.id,
      name: data.name,
      revoked: true
    };
  } catch (error) {
    console.error('Error revoking API key:', error);
    throw new Error('Failed to revoke API key');
  }
};

/**
 * List user's API keys (without showing actual keys)
 */
export const listApiKeys = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, permissions, is_active, created_at, last_used_at, rotated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error listing API keys:', error);
    throw new Error('Failed to list API keys');
  }
};

/**
 * Track API usage
 */
export const trackApiUsage = async (req, res, next) => {
  const start = Date.now();
  
  // Store original send function
  const originalSend = res.send;
  
  // Override send function to track response
  res.send = function (data) {
    const duration = Date.now() - start;
    
    // Track usage asynchronously (don't block response)
    if (req.apiKey) {
      supabase
        .from('api_usage')
        .insert({
          api_key_id: req.apiKey.id,
          user_id: req.user.id,
          endpoint: req.path,
          method: req.method,
          status_code: res.statusCode,
          duration_ms: duration,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          created_at: new Date().toISOString()
        })
        .then(() => {})
        .catch(err => console.error('Error tracking API usage:', err));
    }
    
    // Call original send
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Rate limiting per API key
 */
const apiKeyRequests = new Map();

export const rateLimitApiKey = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return next();
    }
    
    const keyId = req.apiKey.id;
    const now = Date.now();
    
    // Get request history
    let requests = apiKeyRequests.get(keyId) || [];
    
    // Remove requests outside window
    requests = requests.filter(timestamp => now - timestamp < windowMs);
    
    // Check if limit exceeded
    if (requests.length >= maxRequests) {
      return res.status(429).json({
        status: 'error',
        message: 'API rate limit exceeded',
        code: 'API_RATE_LIMIT',
        limit: maxRequests,
        window: windowMs / 1000,
        retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000)
      });
    }
    
    // Add current request
    requests.push(now);
    apiKeyRequests.set(keyId, requests);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - requests.length);
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    
    next();
  };
};

/**
 * Cleanup old request records
 */
const cleanupApiKeyRequests = () => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [keyId, requests] of apiKeyRequests.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < oneHour);
    
    if (validRequests.length === 0) {
      apiKeyRequests.delete(keyId);
    } else {
      apiKeyRequests.set(keyId, validRequests);
    }
  }
};

// Run cleanup every 10 minutes
setInterval(cleanupApiKeyRequests, 10 * 60 * 1000);

export default {
  generateApiKey,
  createApiKey,
  validateApiKey,
  requirePermission,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  trackApiUsage,
  rateLimitApiKey
};
