/**
 * Notification Preferences Service
 * 
 * Features:
 * 1. User notification preferences management
 * 2. Opt-in/opt-out for different notification types
 * 3. Channel preferences (email, SMS, push, WhatsApp)
 * 4. Notification frequency settings
 * 5. Do Not Disturb mode
 */

import { supabase } from '../config/supabase.js';

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES = {
  email: {
    orderConfirmation: true,
    orderShipped: true,
    orderDelivered: true,
    promotional: true,
    newsletter: true,
    accountUpdates: true,
    securityAlerts: true,
  },
  sms: {
    orderConfirmation: true,
    orderShipped: true,
    orderDelivered: true,
    promotional: false,
    otp: true,
    paymentConfirmation: true,
  },
  push: {
    orderConfirmation: true,
    orderShipped: true,
    orderDelivered: true,
    promotional: true,
    chatMessages: true,
    lowStock: false,
  },
  whatsapp: {
    orderConfirmation: true,
    orderShipped: true,
    orderDelivered: true,
    promotional: false,
    customerSupport: true,
    cartReminder: true,
  },
  frequency: 'realtime', // realtime, daily_digest, weekly_digest
  doNotDisturb: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

/**
 * Get user's notification preferences
 */
export const getNotificationPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No preferences found, create default
      return await createDefaultPreferences(userId);
    }

    if (error) throw error;
    
    return { 
      success: true, 
      preferences: data.preferences 
    };
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create default notification preferences for user
 */
export const createDefaultPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .insert({
        user_id: userId,
        preferences: DEFAULT_PREFERENCES,
      })
      .select()
      .single();

    if (error) throw error;
    
    return { 
      success: true, 
      preferences: data.preferences 
    };
  } catch (error) {
    console.error('Error creating default preferences:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (userId, preferences) => {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .update({
        preferences,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    
    console.log(`✅ Notification preferences updated for user ${userId}`);
    return { 
      success: true, 
      preferences: data.preferences 
    };
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update specific channel preferences
 */
export const updateChannelPreferences = async (userId, channel, channelPreferences) => {
  try {
    // Get current preferences
    const { preferences: currentPrefs } = await getNotificationPreferences(userId);
    
    // Update specific channel
    const updatedPrefs = {
      ...currentPrefs,
      [channel]: {
        ...currentPrefs[channel],
        ...channelPreferences,
      },
    };

    return await updateNotificationPreferences(userId, updatedPrefs);
  } catch (error) {
    console.error('Error updating channel preferences:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle Do Not Disturb mode
 */
export const toggleDoNotDisturb = async (userId, enabled, startTime = null, endTime = null) => {
  try {
    const { preferences: currentPrefs } = await getNotificationPreferences(userId);
    
    const updatedPrefs = {
      ...currentPrefs,
      doNotDisturb: {
        enabled,
        startTime: startTime || currentPrefs.doNotDisturb.startTime,
        endTime: endTime || currentPrefs.doNotDisturb.endTime,
      },
    };

    return await updateNotificationPreferences(userId, updatedPrefs);
  } catch (error) {
    console.error('Error toggling Do Not Disturb:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user should receive notification
 */
export const shouldSendNotification = async (userId, channel, notificationType) => {
  try {
    const { preferences } = await getNotificationPreferences(userId);
    
    // Check Do Not Disturb
    if (preferences.doNotDisturb.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime >= preferences.doNotDisturb.startTime || 
          currentTime <= preferences.doNotDisturb.endTime) {
        // Allow critical notifications even during DND
        const criticalTypes = ['securityAlerts', 'otp', 'paymentConfirmation'];
        if (!criticalTypes.includes(notificationType)) {
          return false;
        }
      }
    }

    // Check channel-specific preferences
    if (!preferences[channel] || !preferences[channel][notificationType]) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking notification preferences:', error);
    // Default to allowing notification if preference check fails
    return true;
  }
};

/**
 * Unsubscribe from all marketing communications
 */
export const unsubscribeMarketing = async (userId) => {
  try {
    const { preferences: currentPrefs } = await getNotificationPreferences(userId);
    
    const updatedPrefs = {
      ...currentPrefs,
      email: {
        ...currentPrefs.email,
        promotional: false,
        newsletter: false,
      },
      sms: {
        ...currentPrefs.sms,
        promotional: false,
      },
      push: {
        ...currentPrefs.push,
        promotional: false,
      },
      whatsapp: {
        ...currentPrefs.whatsapp,
        promotional: false,
        cartReminder: false,
      },
    };

    return await updateNotificationPreferences(userId, updatedPrefs);
  } catch (error) {
    console.error('Error unsubscribing from marketing:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update notification frequency
 */
export const updateNotificationFrequency = async (userId, frequency) => {
  try {
    const validFrequencies = ['realtime', 'daily_digest', 'weekly_digest'];
    
    if (!validFrequencies.includes(frequency)) {
      throw new Error('Invalid frequency value');
    }

    const { preferences: currentPrefs } = await getNotificationPreferences(userId);
    
    const updatedPrefs = {
      ...currentPrefs,
      frequency,
    };

    return await updateNotificationPreferences(userId, updatedPrefs);
  } catch (error) {
    console.error('Error updating notification frequency:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get users opted-in for promotional notifications
 */
export const getPromotionalOptIns = async (channel = 'email') => {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('user_id, preferences')
      .filter('preferences', 'cs', `{"${channel}":{"promotional":true}}`);

    if (error) throw error;
    
    const userIds = data
      .filter(pref => pref.preferences[channel]?.promotional === true)
      .map(pref => pref.user_id);

    return { success: true, userIds };
  } catch (error) {
    console.error('Error getting promotional opt-ins:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Log notification sent
 */
export const logNotification = async (userId, channel, type, status, metadata = {}) => {
  try {
    const { error } = await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        channel,
        type,
        status,
        metadata,
        sent_at: new Date().toISOString(),
      });

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error logging notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get notification statistics for user
 */
export const getNotificationStats = async (userId, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('notification_logs')
      .select('channel, type, status')
      .eq('user_id', userId)
      .gte('sent_at', startDate.toISOString());

    if (error) throw error;
    
    // Calculate statistics
    const stats = {
      total: data.length,
      byChannel: {},
      byType: {},
      byStatus: {},
    };

    data.forEach(log => {
      // By channel
      stats.byChannel[log.channel] = (stats.byChannel[log.channel] || 0) + 1;
      
      // By type
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      
      // By status
      stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
    });

    return { success: true, stats };
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getNotificationPreferences,
  createDefaultPreferences,
  updateNotificationPreferences,
  updateChannelPreferences,
  toggleDoNotDisturb,
  shouldSendNotification,
  unsubscribeMarketing,
  updateNotificationFrequency,
  getPromotionalOptIns,
  logNotification,
  getNotificationStats,
};
