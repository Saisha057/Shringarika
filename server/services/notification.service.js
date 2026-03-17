/**
 * Unified Notification Service
 * 
 * Orchestrates all notification channels (Email, SMS, Push, WhatsApp)
 * Respects user preferences and handles fallbacks
 */

import * as emailService from './email.service.js';
import * as smsService from './sms.service.js';
import * as pushService from './push.service.js';
import * as whatsappService from './whatsapp.service.js';
import * as preferencesService from './notificationPreferences.service.js';
import nodemailer from 'nodemailer';

const adminMailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ADMIN_EMAIL,
    pass: process.env.ADMIN_EMAIL_PASS,
  },
});

console.log('Email config:', {
  user: process.env.ADMIN_EMAIL ? 'SET' : 'MISSING',
  pass: process.env.ADMIN_EMAIL_PASS ? 'SET' : 'MISSING'
});
console.log('[Email] Transporter config - user:', process.env.ADMIN_EMAIL ? 'SET' : 'MISSING');

/**
 * Send notification via all enabled channels
 */
export const sendNotification = async (userId, notificationType, data, channels = ['email', 'sms', 'push', 'whatsapp']) => {
  const results = {
    email: { sent: false },
    sms: { sent: false },
    push: { sent: false },
    whatsapp: { sent: false },
  };

  try {
    // Get user preferences
    const { preferences } = await preferencesService.getNotificationPreferences(userId);

    // Send via each requested channel if user opted in
    for (const channel of channels) {
      const shouldSend = await preferencesService.shouldSendNotification(userId, channel, notificationType);
      
      if (!shouldSend) {
        results[channel] = { sent: false, reason: 'User opted out' };
        continue;
      }

      // Send via specific channel
      const result = await sendViaChannel(channel, notificationType, data);
      results[channel] = result;

      // Log notification
      await preferencesService.logNotification(
        userId,
        channel,
        notificationType,
        result.success ? 'sent' : 'failed',
        { error: result.error }
      );
    }

    return { success: true, results };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message, results };
  }
};

/**
 * Send notification via specific channel
 */
const sendViaChannel = async (channel, notificationType, data) => {
  try {
    switch (channel) {
      case 'email':
        return await sendEmailNotification(notificationType, data);
      
      case 'sms':
        return await sendSMSNotification(notificationType, data);
      
      case 'push':
        return await sendPushNotification(notificationType, data);
      
      case 'whatsapp':
        return await sendWhatsAppNotification(notificationType, data);
      
      default:
        return { success: false, error: 'Invalid channel' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Send email notification
 */
const sendEmailNotification = async (type, data) => {
  switch (type) {
    case 'welcome':
      return await emailService.sendWelcomeEmail(data.user);
    
    case 'orderConfirmation':
      return await emailService.sendOrderConfirmationEmail(data.order, data.user);
    
    case 'orderShipped':
      return await emailService.sendOrderShippedEmail(data.order, data.user, data.trackingInfo);
    
    case 'orderDelivered':
      return await emailService.sendOrderDeliveredEmail(data.order, data.user);
    
    case 'orderCancelled':
      return await emailService.sendOrderCancellationEmail(data.order, data.user, data.reason);
    
    case 'passwordReset':
      return await emailService.sendPasswordResetEmail(data.user, data.resetToken);
    
    case 'promotional':
      return await emailService.sendPromotionalEmail(data.user, data.promotion);
    
    case 'lowStock':
      return await emailService.sendLowStockAlert(data.product, data.adminEmail);
    
    default:
      return { success: false, error: 'Unknown notification type' };
  }
};

/**
 * Send SMS notification
 */
const sendSMSNotification = async (type, data) => {
  if (!smsService.isSMSServiceAvailable()) {
    return { success: false, error: 'SMS service not configured' };
  }

  switch (type) {
    case 'orderConfirmation':
      return await smsService.sendOrderConfirmationSMS(data.order, data.user);
    
    case 'orderShipped':
      return await smsService.sendOrderShippedSMS(data.order, data.user, data.trackingInfo);
    
    case 'orderDelivered':
      return await smsService.sendOrderDeliveredSMS(data.order, data.user);
    
    case 'orderCancelled':
      return await smsService.sendOrderCancellationSMS(data.order, data.user);
    
    case 'otp':
      return await smsService.sendOTPSMS(data.phone, data.otp);
    
    case 'paymentConfirmation':
      return await smsService.sendPaymentConfirmationSMS(data.order, data.user);
    
    case 'promotional':
      return await smsService.sendPromotionalSMS(data.phone, data.promotion);
    
    case 'lowStock':
      return await smsService.sendLowStockAlertSMS(data.product, data.adminPhone);
    
    default:
      return { success: false, error: 'Unknown notification type' };
  }
};

/**
 * Send push notification
 */
const sendPushNotification = async (type, data) => {
  if (!pushService.isPushServiceAvailable()) {
    return { success: false, error: 'Push notification service not configured' };
  }

  switch (type) {
    case 'orderConfirmation':
      return await pushService.sendOrderConfirmationPush(data.userId, data.order);
    
    case 'orderShipped':
      return await pushService.sendOrderShippedPush(data.userId, data.order, data.trackingInfo);
    
    case 'orderDelivered':
      return await pushService.sendOrderDeliveredPush(data.userId, data.order);
    
    case 'promotional':
      return await pushService.sendPromotionalPush(data.userId, data.promotion);
    
    case 'lowStock':
      return await pushService.sendLowStockAlertPush(data.adminUserId, data.product);
    
    case 'custom':
      return await pushService.sendCustomPush(data.userId, data.title, data.body, data.clickAction, data.imageUrl);
    
    default:
      return { success: false, error: 'Unknown notification type' };
  }
};

/**
 * Send WhatsApp notification
 */
const sendWhatsAppNotification = async (type, data) => {
  if (!whatsappService.isWhatsAppServiceAvailable()) {
    return { success: false, error: 'WhatsApp service not configured' };
  }

  switch (type) {
    case 'welcome':
      return await whatsappService.sendWelcomeWhatsApp(data.user);
    
    case 'orderConfirmation':
      return await whatsappService.sendOrderConfirmationWhatsApp(data.order, data.user);
    
    case 'orderShipped':
      return await whatsappService.sendOrderShippedWhatsApp(data.order, data.user, data.trackingInfo);
    
    case 'orderDelivered':
      return await whatsappService.sendOrderDeliveredWhatsApp(data.order, data.user);
    
    case 'orderCancelled':
      return await whatsappService.sendOrderCancellationWhatsApp(data.order, data.user, data.reason);
    
    case 'paymentConfirmation':
      return await whatsappService.sendPaymentConfirmationWhatsApp(data.order, data.user);
    
    case 'promotional':
      return await whatsappService.sendPromotionalWhatsApp(data.phone, data.promotion);
    
    case 'otp':
      return await whatsappService.sendOTPWhatsApp(data.phone, data.otp);
    
    case 'cartReminder':
      return await whatsappService.sendCartReminderWhatsApp(data.user, data.cartItems);
    
    case 'customerSupport':
      return await whatsappService.sendSupportMessageWhatsApp(data.phone, data.message);
    
    default:
      return { success: false, error: 'Unknown notification type' };
  }
};

/**
 * Quick helper: Send order confirmation across all channels
 */
export const notifyOrderConfirmation = async (userId, order, user) => {
  return await sendNotification(userId, 'orderConfirmation', { order, user });
};

/**
 * Quick helper: Send order shipped notification
 */
export const notifyOrderShipped = async (userId, order, user, trackingInfo) => {
  return await sendNotification(userId, 'orderShipped', { order, user, trackingInfo });
};

/**
 * Quick helper: Send order delivered notification
 */
export const notifyOrderDelivered = async (userId, order, user) => {
  return await sendNotification(userId, 'orderDelivered', { order, user });
};

/**
 * Quick helper: Send order cancelled notification
 */
export const notifyOrderCancelled = async (userId, order, user, reason) => {
  return await sendNotification(userId, 'orderCancelled', { order, user, reason });
};

export const sendAdminNotification = async ({ type, order, product, user, reason }) => {
  try {
    console.log('[Email] sendAdminNotification called for type:', type);
    const timestamp = new Date().toISOString();
    const subject = `New ${type} Request - Order ${order?.id || 'N/A'}`;
    const text = [
      `Order ID: ${order?.id || 'N/A'}`,
      `User name: ${user?.name || 'N/A'}`,
      `User email: ${user?.email || 'N/A'}`,
      `Product name: ${product?.name || 'N/A'}`,
      `Product variant: ${product?.variant || 'N/A'}`,
      `Reason: ${reason || 'N/A'}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');

    await adminMailer.sendMail({
      from: process.env.ADMIN_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject,
      text,
    });
    console.log('[Email] Admin email sent successfully');
  } catch (error) {
    console.error('sendAdminNotification error:', error?.message || error);
  }
};

export const sendUserNotification = async ({ email, subject, message }) => {
  try {
    if (!email) {
      console.error('User email not found - cannot send notification');
      return;
    }

    await adminMailer.sendMail({
      from: process.env.ADMIN_EMAIL,
      to: email,
      subject,
      text: message,
    });
    console.log('[Email] User email sent to:', email);
  } catch (error) {
    console.error('sendUserNotification error:', error?.message || error);
  }
};

/**
 * Quick helper: Send welcome notification
 */
export const notifyWelcome = async (userId, user) => {
  return await sendNotification(userId, 'welcome', { user }, ['email', 'whatsapp']);
};

/**
 * Quick helper: Send promotional notification
 */
export const notifyPromotion = async (userId, user, promotion) => {
  return await sendNotification(userId, 'promotional', { 
    user, 
    phone: user.phone, 
    promotion 
  });
};

/**
 * Quick helper: Send OTP
 */
export const notifyOTP = async (phone, otp) => {
  const data = { phone, otp };
  
  // Try SMS first, fallback to WhatsApp
  const smsResult = await sendSMSNotification('otp', data);
  if (smsResult.success) {
    return smsResult;
  }
  
  const whatsappResult = await sendWhatsAppNotification('otp', data);
  return whatsappResult;
};

/**
 * Get notification service status
 */
export const getServiceStatus = () => {
  return {
    email: true, // Always available (Gmail SMTP)
    sms: smsService.isSMSServiceAvailable(),
    push: pushService.isPushServiceAvailable(),
    whatsapp: whatsappService.isWhatsAppServiceAvailable(),
  };
};

export default {
  sendNotification,
  notifyOrderConfirmation,
  notifyOrderShipped,
  notifyOrderDelivered,
  notifyOrderCancelled,
  notifyWelcome,
  notifyPromotion,
  notifyOTP,
  getServiceStatus,
};
