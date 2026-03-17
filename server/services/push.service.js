/**
 * Push Notification Service - Firebase Cloud Messaging (FCM)
 * 
 * Features:
 * 1. Web push notifications
 * 2. Order updates
 * 3. Promotional notifications
 * 4. Custom notifications
 * 5. Device token management
 */

import admin from 'firebase-admin';
import { supabase } from '../config/supabase.js';

// Initialize Firebase Admin (will be null if credentials not provided)
let fcmInitialized = false;

const initializeFirebase = () => {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      fcmInitialized = true;
      console.log('✅ Firebase Cloud Messaging initialized');
      return true;
    } else {
      console.log('⚠️  Push notifications disabled (missing Firebase credentials)');
      return false;
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error.message);
    return false;
  }
};

// Initialize on module load
initializeFirebase();

/**
 * Save device token to database
 */
export const saveDeviceToken = async (userId, token, deviceInfo = {}) => {
  try {
    const { data, error } = await supabase
      .from('device_tokens')
      .upsert({
        user_id: userId,
        token,
        device_type: deviceInfo.deviceType || 'web',
        browser: deviceInfo.browser || 'unknown',
        os: deviceInfo.os || 'unknown',
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'token',
      });

    if (error) throw error;
    
    console.log(`✅ Device token saved for user ${userId}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error saving device token:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Remove device token
 */
export const removeDeviceToken = async (token) => {
  try {
    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('token', token);

    if (error) throw error;
    
    console.log('✅ Device token removed');
    return { success: true };
  } catch (error) {
    console.error('Error removing device token:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get user's device tokens
 */
export const getUserDeviceTokens = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('device_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    
    return { success: true, tokens: data };
  } catch (error) {
    console.error('Error getting device tokens:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to specific tokens
 */
export const sendPushNotification = async (tokens, notification, data = {}) => {
  if (!fcmInitialized) {
    console.log('Push notification not sent (FCM disabled):', notification.title);
    return { success: false, error: 'Push notification service not configured' };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...data,
        clickAction: notification.clickAction || '/',
      },
      tokens: Array.isArray(tokens) ? tokens : [tokens],
    };

    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`✅ Push notification sent: ${response.successCount} succeeded, ${response.failureCount} failed`);
    
    // Remove invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      // Remove invalid tokens from database
      for (const token of failedTokens) {
        await removeDeviceToken(token);
      }
    }
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('Error sending push notification:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to user (all devices)
 */
export const sendNotificationToUser = async (userId, notification, data = {}) => {
  try {
    const { tokens } = await getUserDeviceTokens(userId);
    
    if (!tokens || tokens.length === 0) {
      console.log(`No device tokens found for user ${userId}`);
      return { success: false, error: 'No device tokens found' };
    }

    const tokenStrings = tokens.map(t => t.token);
    return await sendPushNotification(tokenStrings, notification, data);
  } catch (error) {
    console.error('Error sending notification to user:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send order confirmation push notification
 */
export const sendOrderConfirmationPush = async (userId, order) => {
  const notification = {
    title: '🎉 Order Confirmed!',
    body: `Your order #${order.order_id} has been confirmed. Total: ₹${order.total_amount}`,
    imageUrl: process.env.BRAND_LOGO_URL,
    clickAction: `/orders/${order.id}`,
  };

  const data = {
    type: 'order_confirmed',
    orderId: order.id.toString(),
    orderNumber: order.order_id,
  };

  return await sendNotificationToUser(userId, notification, data);
};

/**
 * Send order shipped push notification
 */
export const sendOrderShippedPush = async (userId, order, trackingInfo) => {
  const notification = {
    title: '📦 Order Shipped!',
    body: `Your order #${order.order_id} is on its way! Estimated delivery: ${trackingInfo.estimatedDelivery}`,
    imageUrl: process.env.BRAND_LOGO_URL,
    clickAction: `/orders/${order.id}`,
  };

  const data = {
    type: 'order_shipped',
    orderId: order.id.toString(),
    orderNumber: order.order_id,
    trackingUrl: trackingInfo.trackingUrl,
  };

  return await sendNotificationToUser(userId, notification, data);
};

/**
 * Send order delivered push notification
 */
export const sendOrderDeliveredPush = async (userId, order) => {
  const notification = {
    title: '🎊 Order Delivered!',
    body: `Your order #${order.order_id} has been delivered. We hope you love it!`,
    imageUrl: process.env.BRAND_LOGO_URL,
    clickAction: `/orders/${order.id}/review`,
  };

  const data = {
    type: 'order_delivered',
    orderId: order.id.toString(),
    orderNumber: order.order_id,
  };

  return await sendNotificationToUser(userId, notification, data);
};

/**
 * Send promotional push notification
 */
export const sendPromotionalPush = async (userId, promotion) => {
  const notification = {
    title: `🎁 ${promotion.title}`,
    body: `${promotion.description} Use code: ${promotion.code}`,
    imageUrl: promotion.imageUrl || process.env.BRAND_LOGO_URL,
    clickAction: `/products?promo=${promotion.code}`,
  };

  const data = {
    type: 'promotion',
    promoCode: promotion.code,
  };

  return await sendNotificationToUser(userId, notification, data);
};

/**
 * Send low stock alert push notification (Admin)
 */
export const sendLowStockAlertPush = async (adminUserId, product) => {
  const notification = {
    title: '⚠️ Low Stock Alert',
    body: `${product.name} is running low (${product.stock} units left)`,
    imageUrl: product.imageUrl,
    clickAction: `/admin/products/${product.id}`,
  };

  const data = {
    type: 'low_stock',
    productId: product.id.toString(),
    currentStock: product.stock.toString(),
  };

  return await sendNotificationToUser(adminUserId, notification, data);
};

/**
 * Send custom push notification
 */
export const sendCustomPush = async (userId, title, body, clickAction = '/', imageUrl = null) => {
  const notification = {
    title,
    body,
    imageUrl: imageUrl || process.env.BRAND_LOGO_URL,
    clickAction,
  };

  const data = {
    type: 'custom',
  };

  return await sendNotificationToUser(userId, notification, data);
};

/**
 * Send push notification to multiple users
 */
export const sendBulkNotification = async (userIds, notification, data = {}) => {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const userId of userIds) {
    const result = await sendNotificationToUser(userId, notification, data);
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({ userId, error: result.error });
    }
  }

  return results;
};

/**
 * Check if push notification service is available
 */
export const isPushServiceAvailable = () => {
  return fcmInitialized;
};

export default {
  saveDeviceToken,
  removeDeviceToken,
  getUserDeviceTokens,
  sendPushNotification,
  sendNotificationToUser,
  sendOrderConfirmationPush,
  sendOrderShippedPush,
  sendOrderDeliveredPush,
  sendPromotionalPush,
  sendLowStockAlertPush,
  sendCustomPush,
  sendBulkNotification,
  isPushServiceAvailable,
};
