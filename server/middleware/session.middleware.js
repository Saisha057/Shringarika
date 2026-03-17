/**
 * Enhanced Session Management System
 * 
 * Features:
 * 1. Session tracking
 * 2. Device fingerprinting
 * 3. Concurrent session limits
 * 4. Session invalidation
 * 5. Activity monitoring
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';

/**
 * Generate device fingerprint
 */
export const generateDeviceFingerprint = (req) => {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.ip || ''
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
};

/**
 * Extract device information
 */
export const getDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Basic device detection
  let deviceType = 'Desktop';
  if (/mobile/i.test(userAgent)) deviceType = 'Mobile';
  if (/tablet/i.test(userAgent)) deviceType = 'Tablet';
  
  // Basic browser detection
  let browser = 'Unknown';
  if (/chrome/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent)) browser = 'Safari';
  else if (/edge/i.test(userAgent)) browser = 'Edge';
  
  // Basic OS detection
  let os = 'Unknown';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/mac/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/ios/i.test(userAgent)) os = 'iOS';
  
  return {
    type: deviceType,
    browser: browser,
    os: os,
    userAgent: userAgent
  };
};

/**
 * Create session on login
 */
export const createSession = async (userId, token, req) => {
  try {
    const fingerprint = generateDeviceFingerprint(req);
    const deviceInfo = getDeviceInfo(req);
    
    // Check for existing session with same device
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('device_fingerprint', fingerprint)
      .eq('is_active', true)
      .single();
    
    if (existingSession) {
      // Update existing session
      const { data, error } = await supabase
        .from('sessions')
        .update({
          token_hash: hashToken(token),
          last_activity_at: new Date().toISOString(),
          ip_address: req.ip
        })
        .eq('id', existingSession.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
    
    // Create new session
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        token_hash: hashToken(token),
        device_fingerprint: fingerprint,
        device_type: deviceInfo.type,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        user_agent: deviceInfo.userAgent,
        ip_address: req.ip,
        last_activity_at: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error creating session:', error);
    throw new Error('Failed to create session');
  }
};

/**
 * Hash token for storage
 */
const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Update session activity
 */
export const updateSessionActivity = async (req, res, next) => {
  try {
    if (!req.user || !req.token) {
      return next();
    }
    
    const tokenHash = hashToken(req.token);
    
    // Update last activity timestamp
    await supabase
      .from('sessions')
      .update({
        last_activity_at: new Date().toISOString(),
        ip_address: req.ip
      })
      .eq('token_hash', tokenHash)
      .eq('user_id', req.user.id);
    
    next();
  } catch (error) {
    console.error('Error updating session activity:', error);
    next();
  }
};

/**
 * Enforce concurrent session limit
 */
export const enforceConcurrentSessionLimit = async (userId, maxSessions = 5) => {
  try {
    // Get all active sessions
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false });
    
    if (error) throw error;
    
    // If under limit, no action needed
    if (sessions.length <= maxSessions) {
      return;
    }
    
    // Deactivate oldest sessions
    const sessionsToDeactivate = sessions.slice(maxSessions);
    const idsToDeactivate = sessionsToDeactivate.map(s => s.id);
    
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .in('id', idsToDeactivate);
    
  } catch (error) {
    console.error('Error enforcing session limit:', error);
  }
};

/**
 * Get user's active sessions
 */
export const getActiveSessions = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, device_type, browser, os, ip_address, last_activity_at, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error getting active sessions:', error);
    throw new Error('Failed to get active sessions');
  }
};

/**
 * Invalidate session (logout)
 */
export const invalidateSession = async (sessionId, userId) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error invalidating session:', error);
    throw new Error('Failed to invalidate session');
  }
};

/**
 * Invalidate all sessions (logout all devices)
 */
export const invalidateAllSessions = async (userId, exceptSessionId = null) => {
  try {
    let query = supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    
    // Optionally keep current session active
    if (exceptSessionId) {
      query = query.neq('id', exceptSessionId);
    }
    
    const { error } = await query;
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error invalidating all sessions:', error);
    throw new Error('Failed to invalidate all sessions');
  }
};

/**
 * Cleanup expired sessions
 */
export const cleanupExpiredSessions = async () => {
  try {
    // Deactivate sessions inactive for more than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('sessions')
      .update({ is_active: false })
      .lt('last_activity_at', thirtyDaysAgo)
      .eq('is_active', true);
    
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
};

/**
 * Verify session is active
 */
export const verifySession = async (token, userId) => {
  try {
    const tokenHash = hashToken(token);
    
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    // Check if session is too old (7 days for JWT expiry)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (new Date(data.created_at) < sevenDaysAgo) {
      // Deactivate old session
      await invalidateSession(data.id, userId);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying session:', error);
    return false;
  }
};

/**
 * Detect suspicious activity
 */
export const detectSuspiciousActivity = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }
    
    const currentFingerprint = generateDeviceFingerprint(req);
    const tokenHash = req.token ? hashToken(req.token) : null;
    
    if (!tokenHash) {
      return next();
    }
    
    // Get session
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('user_id', req.user.id)
      .single();
    
    if (!session) {
      return next();
    }
    
    // Check if device fingerprint matches
    if (session.device_fingerprint !== currentFingerprint) {
      console.warn(`[Security] Device fingerprint mismatch for user ${req.user.id}`);
      console.warn(`Expected: ${session.device_fingerprint}`);
      console.warn(`Got: ${currentFingerprint}`);
      
      // Log suspicious activity
      await supabase
        .from('security_events')
        .insert({
          user_id: req.user.id,
          event_type: 'DEVICE_FINGERPRINT_MISMATCH',
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          details: {
            expected_fingerprint: session.device_fingerprint,
            actual_fingerprint: currentFingerprint
          },
          created_at: new Date().toISOString()
        });
    }
    
    // Check for rapid IP changes
    if (session.ip_address !== req.ip) {
      const timeSinceLastActivity = Date.now() - new Date(session.last_activity_at).getTime();
      
      // If IP changed within 5 minutes, it's suspicious
      if (timeSinceLastActivity < 5 * 60 * 1000) {
        console.warn(`[Security] Rapid IP change detected for user ${req.user.id}`);
        console.warn(`From: ${session.ip_address} To: ${req.ip}`);
        
        await supabase
          .from('security_events')
          .insert({
            user_id: req.user.id,
            event_type: 'RAPID_IP_CHANGE',
            ip_address: req.ip,
            details: {
              previous_ip: session.ip_address,
              time_since_last_activity_ms: timeSinceLastActivity
            },
            created_at: new Date().toISOString()
          });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
    next();
  }
};

// Run cleanup daily
setInterval(cleanupExpiredSessions, 24 * 60 * 60 * 1000);

export default {
  generateDeviceFingerprint,
  getDeviceInfo,
  createSession,
  updateSessionActivity,
  enforceConcurrentSessionLimit,
  getActiveSessions,
  invalidateSession,
  invalidateAllSessions,
  cleanupExpiredSessions,
  verifySession,
  detectSuspiciousActivity
};
