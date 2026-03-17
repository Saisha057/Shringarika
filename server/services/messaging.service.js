import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient = null;

if (accountSid && authToken && twilioPhone) {
  twilioClient = twilio(accountSid, authToken);
  console.log('✅ Twilio SMS/WhatsApp service initialized');
} else {
  console.warn('⚠️  Twilio credentials missing - SMS/WhatsApp disabled');
}

/**
 * Send SMS notification
 * @param {string} to - Phone number (format: +91XXXXXXXXXX)
 * @param {string} message - Message content
 * @returns {Promise} Twilio response
 */
export const sendSMS = async (to, message) => {
  if (!twilioClient) {
    console.warn('⚠️  Twilio not configured - SMS not sent');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    // Format phone number
    const formattedPhone = to.startsWith('+') ? to : `+91${to}`;
    
    const response = await twilioClient.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone,
    });

    console.log(`✅ SMS sent to ${formattedPhone}: ${response.sid}`);
    return { success: true, sid: response.sid };
  } catch (error) {
    console.error('❌ SMS send error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send WhatsApp message
 * @param {string} to - Phone number (format: +91XXXXXXXXXX)
 * @param {string} message - Message content
 * @returns {Promise} Twilio response
 */
export const sendWhatsApp = async (to, message) => {
  if (!twilioClient || !twilioWhatsApp) {
    console.warn('⚠️  Twilio WhatsApp not configured - message not sent');
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    // Format phone number
    const formattedPhone = to.startsWith('+') ? to : `+91${to}`;
    
    const response = await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${twilioWhatsApp}`,
      to: `whatsapp:${formattedPhone}`,
    });

    console.log(`✅ WhatsApp sent to ${formattedPhone}: ${response.sid}`);
    return { success: true, sid: response.sid };
  } catch (error) {
    console.error('❌ WhatsApp send error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send return/exchange status notification
 * @param {string} phone - Customer phone number
 * @param {object} data - Notification data
 */
export const sendReturnStatusNotification = async (phone, data) => {
  const { orderNumber, status, type, reason } = data;
  
  let message = `Shringarika Update\n\n`;
  message += `Order #${orderNumber}\n`;
  message += `${type === 'return' ? 'Return' : 'Exchange'} Request: ${status}\n\n`;
  
  if (status === 'approved') {
    message += `Your ${type} request has been approved! `;
    if (type === 'return') {
      message += `Refund will be processed within 5-7 business days.`;
    } else {
      message += `Exchange item will be shipped soon.`;
    }
  } else if (status === 'rejected') {
    message += `Your ${type} request has been rejected.\n`;
    if (reason) {
      message += `Reason: ${reason}`;
    }
  } else if (status === 'processing') {
    message += `Your ${type} request is being processed. We'll update you soon.`;
  }
  
  message += `\n\nThank you for shopping with Shringarika!`;

  // Send both SMS and WhatsApp
  const smsResult = await sendSMS(phone, message);
  const whatsAppResult = await sendWhatsApp(phone, message);

  return {
    sms: smsResult,
    whatsApp: whatsAppResult,
  };
};

/**
 * Send order status update notification
 * @param {string} phone - Customer phone number
 * @param {object} data - Order data
 */
export const sendOrderStatusUpdate = async (phone, data) => {
  const { orderNumber, status, estimatedDelivery } = data;
  
  let message = `Shringarika Order Update\n\n`;
  message += `Order #${orderNumber}\n`;
  message += `Status: ${status}\n`;
  
  if (status === 'Shipped' && estimatedDelivery) {
    message += `\nEstimated Delivery: ${estimatedDelivery}`;
  }
  
  message += `\n\nTrack your order at: localhost:3000/orders`;

  // Send both SMS and WhatsApp
  const smsResult = await sendSMS(phone, message);
  const whatsAppResult = await sendWhatsApp(phone, message);

  return {
    sms: smsResult,
    whatsApp: whatsAppResult,
  };
};

/**
 * Validate UPI ID format
 * @param {string} upiId - UPI ID to validate
 * @returns {boolean} True if valid
 */
export const validateUPIId = (upiId) => {
  if (!upiId || typeof upiId !== 'string') {
    return false;
  }

  // UPI ID format: username@bankname
  // Examples: user@paytm, 9876543210@ybl, john.doe@okaxis
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  
  // Common UPI handles
  const validHandles = [
    'paytm', 'ybl', 'okaxis', 'okicici', 'oksbi', 'okhdfc',
    'axl', 'ibl', 'upi', 'airtel', 'fbl', 'jupiteraxis',
    'axisbank', 'hdfcbank', 'sbi', 'icici', 'kotak'
  ];

  if (!upiRegex.test(upiId)) {
    return false;
  }

  const [username, handle] = upiId.split('@');
  
  // Check username length (3-50 characters)
  if (username.length < 3 || username.length > 50) {
    return false;
  }

  // Check if handle is in valid list or ends with known domain
  const isValidHandle = validHandles.some(h => handle.toLowerCase().includes(h));
  
  return isValidHandle;
};

export default {
  sendSMS,
  sendWhatsApp,
  sendReturnStatusNotification,
  sendOrderStatusUpdate,
  validateUPIId,
};
