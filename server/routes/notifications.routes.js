/**
 * Notification Preferences Routes
 * 
 * Endpoints for managing user notification preferences
 */

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import * as preferencesService from '../services/notificationPreferences.service.js';
import * as notificationService from '../services/notification.service.js';

const router = express.Router();

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
router.get('/preferences', protect, async (req, res) => {
  try {
    const result = await preferencesService.getNotificationPreferences(req.user.id);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      preferences: result.preferences,
    });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
router.put('/preferences', protect, async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences are required' });
    }

    const result = await preferencesService.updateNotificationPreferences(req.user.id, preferences);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: result.preferences,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * PUT /api/notifications/preferences/:channel
 * Update specific channel preferences
 */
router.put('/preferences/:channel', protect, async (req, res) => {
  try {
    const { channel } = req.params;
    const channelPreferences = req.body;

    const validChannels = ['email', 'sms', 'push', 'whatsapp'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel' });
    }

    const result = await preferencesService.updateChannelPreferences(
      req.user.id,
      channel,
      channelPreferences
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: `${channel} preferences updated successfully`,
      preferences: result.preferences,
    });
  } catch (error) {
    console.error('Error updating channel preferences:', error);
    res.status(500).json({ error: 'Failed to update channel preferences' });
  }
});

/**
 * PUT /api/notifications/dnd
 * Toggle Do Not Disturb mode
 */
router.put('/dnd', protect, async (req, res) => {
  try {
    const { enabled, startTime, endTime } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled field is required (boolean)' });
    }

    const result = await preferencesService.toggleDoNotDisturb(
      req.user.id,
      enabled,
      startTime,
      endTime
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: `Do Not Disturb ${enabled ? 'enabled' : 'disabled'}`,
      preferences: result.preferences,
    });
  } catch (error) {
    console.error('Error toggling DND:', error);
    res.status(500).json({ error: 'Failed to toggle Do Not Disturb' });
  }
});

/**
 * PUT /api/notifications/frequency
 * Update notification frequency
 */
router.put('/frequency', protect, async (req, res) => {
  try {
    const { frequency } = req.body;

    const validFrequencies = ['realtime', 'daily_digest', 'weekly_digest'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency value' });
    }

    const result = await preferencesService.updateNotificationFrequency(req.user.id, frequency);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Notification frequency updated',
      preferences: result.preferences,
    });
  } catch (error) {
    console.error('Error updating frequency:', error);
    res.status(500).json({ error: 'Failed to update frequency' });
  }
});

/**
 * POST /api/notifications/unsubscribe/marketing
 * Unsubscribe from all marketing communications
 */
router.post('/unsubscribe/marketing', protect, async (req, res) => {
  try {
    const result = await preferencesService.unsubscribeMarketing(req.user.id);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Successfully unsubscribed from marketing communications',
      preferences: result.preferences,
    });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * GET /api/notifications/stats
 * Get notification statistics
 */
router.get('/stats', protect, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await preferencesService.getNotificationStats(req.user.id, parseInt(days));
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get notification statistics' });
  }
});

/**
 * GET /api/notifications/status
 * Get notification service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = notificationService.getServiceStatus();

    res.json({
      success: true,
      services: status,
    });
  } catch (error) {
    console.error('Error getting service status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

/**
 * POST /api/notifications/test
 * Send test notification (all channels)
 */
router.post('/test', protect, async (req, res) => {
  try {
    const { channel } = req.body;

    const testData = {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
      },
      promotion: {
        title: 'Test Notification',
        description: 'This is a test notification from Shringarika',
        code: 'TEST123',
        discount: 10,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    };

    const channels = channel ? [channel] : ['email'];
    const result = await notificationService.sendNotification(
      req.user.id,
      'promotional',
      testData,
      channels
    );

    res.json({
      success: true,
      message: 'Test notification sent',
      results: result.results,
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;
