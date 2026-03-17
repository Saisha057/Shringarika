/**
 * SMS Notification Service - Twilio Integration
 * 
 * Features:
 * 1. Order confirmations via SMS
 * 2. Delivery updates
 * 3. OTP verification
 * 4. Payment confirmations
 * 5. Custom notifications
 */

import twilio from 'twilio';

// Initialize Twilio client (will be null if credentials not provided)
let twilioClient = null;
let isTestMode = false;

const initializeTwilio = () => {
  // Check if test mode is enabled
  isTestMode = process.env.TWILIO_TEST_MODE === 'true';
  
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    if (isTestMode) {
      console.log('✅ Twilio SMS service initialized in TEST MODE');
      console.log('   SMS messages will be logged but not sent');
      return true;
    }
    
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio SMS service initialized in LIVE MODE');
    return true;
  } else {
    console.log('⚠️  Twilio SMS disabled (missing credentials)');
    return false;
  }
};

// Initialize on module load
const isTwilioEnabled = initializeTwilio();

/**
 * Format phone number to E.164 format (+91XXXXXXXXXX)
 */
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (digits.length === 10) {
    return `+91${digits}`; // India country code
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  } else if (digits.startsWith('+')) {
    return phone;
  }
  
  return `+${digits}`;
};

/**
 * Send generic SMS
 */
export const sendSMS = async (to, message) => {
  if (!isTwilioEnabled) {
    console.log('📱 SMS not sent (Twilio disabled):', message);
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const formattedPhone = formatPhoneNumber(to);
    
    // TEST MODE: Log but don't send
    if (isTestMode) {
      console.log('📱 [TEST MODE] SMS would be sent to:', formattedPhone);
      console.log('📱 [TEST MODE] Message:', message);
      return { success: true, messageId: 'test_' + Date.now(), testMode: true };
    }
    
    // LIVE MODE: Actually send SMS
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ SMS sent to ${formattedPhone}: ${result.sid}`);
    return { success: true, messageId: result.sid };
  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send order confirmation SMS
 */
export const sendOrderConfirmationSMS = async (order, user) => {
  const message = `Hi ${user.name}! Your Shringarika order #${order.order_id} has been confirmed. Total: ₹${order.total_amount}. Track: ${process.env.FRONTEND_URL}/orders/${order.id}`;
  
  return await sendSMS(user.phone || order.shipping_address.phone, message);
};

/**
 * Send order shipped SMS
 */
export const sendOrderShippedSMS = async (order, user, trackingInfo) => {
  const message = `Your Shringarika order #${order.order_id} has been shipped! Track: ${trackingInfo.trackingUrl} | Estimated delivery: ${trackingInfo.estimatedDelivery}`;
  
  return await sendSMS(user.phone || order.shipping_address.phone, message);
};

/**
 * Send order delivered SMS
 */
export const sendOrderDeliveredSMS = async (order, user) => {
  const message = `Your Shringarika order #${order.order_id} has been delivered! We hope you love it. Rate your experience: ${process.env.FRONTEND_URL}/orders/${order.id}/review`;
  
  return await sendSMS(user.phone || order.shipping_address.phone, message);
};

/**
 * Send OTP for verification
 */
export const sendOTPSMS = async (phone, otp) => {
  const message = `Your Shringarika verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;
  
  return await sendSMS(phone, message);
};

/**
 * Send payment confirmation SMS
 */
export const sendPaymentConfirmationSMS = async (order, user) => {
  const message = `Payment of ₹${order.total_amount} received for order #${order.order_id}. Thank you for shopping with Shringarika!`;
  
  return await sendSMS(user.phone || order.shipping_address.phone, message);
};

/**
 * Send order cancellation SMS
 */
export const sendOrderCancellationSMS = async (order, user) => {
  const message = `Your Shringarika order #${order.order_id} has been cancelled. Refund of ₹${order.total_amount} will be processed in 5-7 days.`;
  
  return await sendSMS(user.phone || order.shipping_address.phone, message);
};

/**
 * Send order status update SMS
 * Generic function for any status change
 */
export const sendOrderStatusUpdateSMS = async (order, user, newStatus, trackingNumber = null) => {
  const phone = user?.phone || order?.shipping_address?.phone || order?.customer_phone;
  const customerName = user?.name || order?.customer_name || 'Customer';
  const orderNumber = order?.order_number || order?.order_id || order?.id;
  
  if (!phone) {
    console.warn('⚠️  [SMS] No phone number available for order:', orderNumber);
    return { success: false, error: 'No phone number' };
  }

  let message = '';
  
  switch (newStatus?.toLowerCase()) {
    case 'confirmed':
      message = `Hi ${customerName}! Your order #${orderNumber} has been confirmed. We'll notify you once it's shipped. - Shringarika`;
      break;
    case 'processing':
      message = `Hi ${customerName}! Your order #${orderNumber} is being processed. It will be shipped soon. - Shringarika`;
      break;
    case 'packed':
      message = `Hi ${customerName}! Your order #${orderNumber} has been packed and is ready for dispatch. - Shringarika`;
      break;
    case 'shipped':
      message = trackingNumber
        ? `Hi ${customerName}! Your order #${orderNumber} has been shipped. Tracking: ${trackingNumber} - Shringarika`
        : `Hi ${customerName}! Your order #${orderNumber} has been shipped. You'll receive it soon. - Shringarika`;
      break;
    case 'out for delivery':
      message = `Hi ${customerName}! Your order #${orderNumber} is out for delivery. Please keep your phone handy. - Shringarika`;
      break;
    case 'delivered':
      message = `Hi ${customerName}! Your order #${orderNumber} has been delivered. Thank you for shopping with us! - Shringarika`;
      break;
    case 'cancelled':
      message = `Hi ${customerName}! Your order #${orderNumber} has been cancelled. If paid, refund will be processed in 5-7 days. - Shringarika`;
      break;
    case 'returned':
      message = `Hi ${customerName}! Your return request for order #${orderNumber} has been accepted. Refund will be processed soon. - Shringarika`;
      break;
    case 'refunded':
      message = `Hi ${customerName}! Refund for order #${orderNumber} has been processed. Amount will be credited in 5-7 days. - Shringarika`;
      break;
    default:
      message = `Hi ${customerName}! Your order #${orderNumber} status has been updated to: ${newStatus}. - Shringarika`;
  }

  console.log(`📱 [SMS] Sending status update to ${phone}:`, message);
  return await sendSMS(phone, message);
};

/**
 * Send low stock alert SMS (Admin)
 */
export const sendLowStockAlertSMS = async (product, adminPhone) => {
  const message = `⚠️ Low Stock Alert: ${product.name} (SKU: ${product.sku}) - Only ${product.stock} units left. Restock urgently!`;
  
  return await sendSMS(adminPhone, message);
};

/**
 * Send promotional SMS
 */
export const sendPromotionalSMS = async (phone, promotion) => {
  const message = `${promotion.title} 🎁 Use code ${promotion.code} for ${promotion.discount}% OFF! Valid till ${new Date(promotion.expiresAt).toLocaleDateString()}. Shop: ${process.env.FRONTEND_URL}`;
  
  return await sendSMS(phone, message);
};

/**
 * Send custom notification SMS
 */
export const sendCustomNotificationSMS = async (phone, title, body) => {
  const message = `${title}: ${body} - Shringarika`;
  
  return await sendSMS(phone, message);
};

/**
 * Check if SMS service is available
 */
export const isSMSServiceAvailable = () => {
  return isTwilioEnabled;
};

export default {
  sendSMS,
  sendOrderConfirmationSMS,
  sendOrderShippedSMS,
  sendOrderDeliveredSMS,
  sendOrderStatusUpdateSMS,
  sendOTPSMS,
  sendPaymentConfirmationSMS,
  sendOrderCancellationSMS,
  sendLowStockAlertSMS,
  sendPromotionalSMS,
  sendCustomNotificationSMS,
  isSMSServiceAvailable,
};
