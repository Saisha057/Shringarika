/**
 * Session Management Security Enhancements
 * 
 * Fixes:
 * - Session timeout after 7 days
 * - Logout from all devices
 * - Suspicious activity detection
 * - Email notifications on new device login
 */

import { getSupabaseAdmin } from '../config/supabase.js';
import crypto from 'crypto';
import { sendEmail } from '../utils/sendEmail.js';

/**
 * Logout from all devices except current
 */
export const logoutAllDevices = async (req, res, next) => {
  const supabase = getSupabaseAdmin();
  try {
    const userId = req.user.id;
    const currentToken = req.token;
    const currentTokenHash = hashToken(currentToken);

    // Invalidate all other sessions
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .neq('token_hash', currentTokenHash);

    if (error) throw error;

    res.json({
      status: 'success',
      message: 'Logged out from all other devices successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active sessions for user
 */
export const getActiveSessions = async (req, res, next) => {
  const supabase = getSupabaseAdmin();
  try {
    const userId = req.user.id;

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format sessions for frontend
    const formattedSessions = sessions?.map(session => ({
      id: session.id,
      device_type: session.device_info?.type || 'Unknown',
      browser: session.device_info?.browser || 'Unknown',
      os: session.device_info?.os || 'Unknown',
      ip_address: session.ip_address,
      last_activity_at: session.last_activity_at,
      created_at: session.created_at,
      is_current: session.token_hash === hashToken(req.token),
    }));

    res.json({
      status: 'success',
      count: formattedSessions?.length || 0,
      data: formattedSessions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout from specific device
 */
export const logoutFromDevice = async (req, res, next) => {
  const supabase = getSupabaseAdmin();
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (!session || session.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to logout this session',
      });
    }

    // Invalidate session
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (error) throw error;

    res.json({
      status: 'success',
      message: 'Session invalidated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Detect suspicious login activity
 */
export const detectSuspiciousActivity = async (userId, newLogin) => {
  const supabase = getSupabaseAdmin();
  try {
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!recentSessions || recentSessions.length === 0) {
      return { suspicious: false };
    }

    const lastSession = recentSessions[0];
    
    // Check for suspicious indicators
    const indicators = {
      newCountry: isNewCountry(lastSession.ip_address, newLogin.ip_address),
      newDevice: !recentSessions.some(s => 
        s.device_info?.type === newLogin.device_info?.type &&
        s.device_info?.browser === newLogin.device_info?.browser
      ),
      rapidLocationChange: false, // Check if IP changed dramatically in short time
    };

    const suspicious = indicators.newCountry && indicators.newDevice;

    return { suspicious, indicators };
  } catch (error) {
    console.error('Suspicious activity detection error:', error);
    return { suspicious: false };
  }
};

/**
 * Send email notification for new device login
 */
export const sendNewDeviceNotification = async (userId, deviceInfo) => {
  const supabase = getSupabaseAdmin();
  try {
    const { data: user } = await supabase
      .from('users')
      .select('email, name, phone')
      .eq('id', userId)
      .single();

    if (!user) return;

    const emailContent = `
      <h2>New Device Login Detected</h2>
      <p>Hi ${user.name || 'there'},</p>
      <p>We detected a login to your SHRINGARIKA account from a new device:</p>
      <ul>
        <li><strong>Device:</strong> ${deviceInfo.type}</li>
        <li><strong>Browser:</strong> ${deviceInfo.browser}</li>
        <li><strong>Operating System:</strong> ${deviceInfo.os}</li>
        <li><strong>IP Address:</strong> ${deviceInfo.ip_address}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      <p>If this was you, you can safely ignore this email.</p>
      <p>If this wasn't you, please secure your account immediately:</p>
      <ol>
        <li>Change your password</li>
        <li>Review active sessions in Account Settings</li>
        <li>Contact support if you suspect unauthorized access</li>
      </ol>
      <p>Stay safe,<br>The SHRINGARIKA Team</p>
    `;

    await sendEmail({
      to: user.email,
      subject: '🔐 New Device Login - SHRINGARIKA',
      html: emailContent,
    });

  } catch (error) {
    console.error('New device notification error:', error);
  }
};

/**
 * Clean up expired sessions (run via cron)
 */
export const cleanupExpiredSessions = async () => {
  const supabase = getSupabaseAdmin();
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - 7); // 7 days

    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .lt('last_activity_at', expiryDate.toISOString())
      .eq('is_active', true);

    if (error) throw error;

    console.log('✅ Expired sessions cleaned up');
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
};

/**
 * Helper functions
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isNewCountry(oldIP, newIP) {
  // In production, use IP geolocation service
  // For now, just check if IPs are significantly different
  return oldIP !== newIP;
}

export default {
  logoutAllDevices,
  getActiveSessions,
  logoutFromDevice,
  detectSuspiciousActivity,
  sendNewDeviceNotification,
  cleanupExpiredSessions,
};
