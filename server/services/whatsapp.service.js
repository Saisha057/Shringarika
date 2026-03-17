/**
 * WhatsApp Notification Service - Twilio WhatsApp Business API
 * 
 * Features:
 * 1. Order confirmations via WhatsApp
 * 2. Delivery updates with tracking
 * 3. Payment confirmations
 * 4. Customer support messages
 * 5. Rich media messages (images, documents)
 */

import twilio from 'twilio';

// Initialize Twilio client for WhatsApp
let whatsappClient = null;

const initializeWhatsApp = () => {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
    whatsappClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ WhatsApp messaging service initialized');
    return true;
  } else {
    console.log('⚠️  WhatsApp messaging disabled (missing credentials)');
    return false;
  }
};

// Initialize on module load
const isWhatsAppEnabled = initializeWhatsApp();

/**
 * Format phone number for WhatsApp (whatsapp:+91XXXXXXXXXX)
 */
const formatWhatsAppNumber = (phone) => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Add country code if not present
  let formattedNumber;
  if (digits.length === 10) {
    formattedNumber = `+91${digits}`; // India country code
  } else if (digits.length === 12 && digits.startsWith('91')) {
    formattedNumber = `+${digits}`;
  } else if (digits.startsWith('+')) {
    formattedNumber = phone;
  } else {
    formattedNumber = `+${digits}`;
  }
  
  return `whatsapp:${formattedNumber}`;
};

/**
 * Send generic WhatsApp message
 */
export const sendWhatsAppMessage = async (to, message, mediaUrl = null) => {
  if (!isWhatsAppEnabled) {
    console.log('WhatsApp message not sent (service disabled):', message);
    return { success: false, error: 'WhatsApp service not configured' };
  }

  try {
    const formattedPhone = formatWhatsAppNumber(to);
    const messageData = {
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: formattedPhone,
    };

    // Add media URL if provided
    if (mediaUrl) {
      messageData.mediaUrl = [mediaUrl];
    }
    
    const result = await whatsappClient.messages.create(messageData);

    console.log(`✅ WhatsApp message sent to ${formattedPhone}: ${result.sid}`);
    return { success: true, messageId: result.sid };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send order confirmation via WhatsApp
 */
export const sendOrderConfirmationWhatsApp = async (order, user) => {
  const itemsList = order.items.map(item => 
    `• ${item.product_name} x${item.quantity} - ₹${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');

  const message = `
🎉 *Order Confirmed!*

Hi ${user.name}! 

Your order has been successfully placed.

📦 *Order Details*
Order ID: #${order.order_id}
Date: ${new Date(order.created_at).toLocaleDateString()}

*Items:*
${itemsList}

💰 *Total Amount:* ₹${order.total_amount.toFixed(2)}
💳 *Payment Method:* ${order.payment_method}

📍 *Delivery Address:*
${order.shipping_address.address}
${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.pincode}

You'll receive another message when your order ships.

Track your order: ${process.env.FRONTEND_URL}/orders/${order.id}

Thank you for shopping with Shringarika! ✨
  `.trim();

  return await sendWhatsAppMessage(
    user.phone || order.shipping_address.phone,
    message
  );
};

/**
 * Send order shipped via WhatsApp
 */
export const sendOrderShippedWhatsApp = async (order, user, trackingInfo) => {
  const message = `
📦 *Order Shipped!*

Hi ${user.name}!

Great news! Your order #${order.order_id} has been shipped and is on its way to you.

🚚 *Shipping Details:*
Tracking Number: ${trackingInfo.trackingNumber}
Carrier: ${trackingInfo.carrier}
Estimated Delivery: ${trackingInfo.estimatedDelivery}

Track your shipment: ${trackingInfo.trackingUrl}

We'll notify you once your order is delivered.

Thank you for your patience! 💜
  `.trim();

  return await sendWhatsAppMessage(
    user.phone || order.shipping_address.phone,
    message
  );
};

/**
 * Send order delivered via WhatsApp
 */
export const sendOrderDeliveredWhatsApp = async (order, user) => {
  const message = `
🎊 *Order Delivered!*

Hi ${user.name}!

Your order #${order.order_id} has been successfully delivered!

We hope you love your new products from Shringarika! ✨

💝 *Share your experience:*
Rate and review: ${process.env.FRONTEND_URL}/orders/${order.id}/review

Have any issues? Reply to this message or contact our support team.

Thank you for shopping with us! 🙏
  `.trim();

  return await sendWhatsAppMessage(
    user.phone || order.shipping_address.phone,
    message
  );
};

/**
 * Send payment confirmation via WhatsApp
 */
export const sendPaymentConfirmationWhatsApp = async (order, user) => {
  const message = `
✅ *Payment Received!*

Hi ${user.name}!

We've received your payment for order #${order.order_id}.

💰 Amount Paid: ₹${order.total_amount.toFixed(2)}
💳 Payment Method: ${order.payment_method}
🕐 Transaction Time: ${new Date().toLocaleString()}

Your order is being processed and will be shipped soon.

Thank you for your payment! 💚
  `.trim();

  return await sendWhatsAppMessage(
    user.phone || order.shipping_address.phone,
    message
  );
};

/**
 * Send order cancellation via WhatsApp
 */
export const sendOrderCancellationWhatsApp = async (order, user, reason) => {
  const message = `
❌ *Order Cancelled*

Hi ${user.name},

Your order #${order.order_id} has been cancelled as requested.

Cancellation Reason: ${reason}

💰 *Refund Details:*
Amount: ₹${order.total_amount.toFixed(2)}
Timeline: 5-7 business days
Method: Original payment method

You'll receive a confirmation once the refund is processed.

Need help? Reply to this message or contact support.

We hope to serve you again soon! 💜
  `.trim();

  return await sendWhatsAppMessage(
    user.phone || order.shipping_address.phone,
    message
  );
};

/**
 * Send promotional message via WhatsApp
 */
export const sendPromotionalWhatsApp = async (phone, promotion) => {
  const message = `
🎁 *${promotion.title}*

${promotion.description}

💰 *Offer Details:*
Discount: ${promotion.discount}% OFF
Promo Code: *${promotion.code}*
Valid Until: ${new Date(promotion.expiresAt).toLocaleDateString()}

Shop now: ${process.env.FRONTEND_URL}/products?promo=${promotion.code}

Don't miss out on this exclusive offer! ✨

---
Reply STOP to unsubscribe from promotional messages.
  `.trim();

  return await sendWhatsAppMessage(phone, message, promotion.imageUrl);
};

/**
 * Send OTP via WhatsApp
 */
export const sendOTPWhatsApp = async (phone, otp) => {
  const message = `
🔒 *Shringarika Verification Code*

Your OTP is: *${otp}*

Valid for 10 minutes.

⚠️ Do not share this code with anyone.

If you didn't request this code, please ignore this message.
  `.trim();

  return await sendWhatsAppMessage(phone, message);
};

/**
 * Send welcome message via WhatsApp
 */
export const sendWelcomeWhatsApp = async (user) => {
  const message = `
👋 *Welcome to Shringarika!*

Hi ${user.name}! 

Thank you for joining our beauty community! 💄✨

Here's what you can do:
• Browse exclusive beauty products
• Get personalized recommendations
• Track orders in real-time
• Enjoy member-only discounts

Start shopping: ${process.env.FRONTEND_URL}/products

Need help? Just reply to this message!

Happy shopping! 🛍️
  `.trim();

  return await sendWhatsAppMessage(user.phone, message);
};

/**
 * Send customer support message
 */
export const sendSupportMessageWhatsApp = async (phone, message) => {
  const supportMessage = `
💬 *Shringarika Support*

${message}

---
Need more help? Reply to this message or call us at ${process.env.SUPPORT_PHONE}

Our team is here to help! 🙏
  `.trim();

  return await sendWhatsAppMessage(phone, supportMessage);
};

/**
 * Send order reminder (abandoned cart)
 */
export const sendCartReminderWhatsApp = async (user, cartItems) => {
  const itemsList = cartItems.slice(0, 3).map(item => 
    `• ${item.name} - ₹${item.price}`
  ).join('\n');

  const message = `
🛒 *You left something behind!*

Hi ${user.name}!

You have ${cartItems.length} item(s) waiting in your cart:

${itemsList}
${cartItems.length > 3 ? `...and ${cartItems.length - 3} more items` : ''}

Complete your purchase now and get them delivered to your doorstep! 📦

Shop now: ${process.env.FRONTEND_URL}/cart

This cart will expire in 24 hours. ⏰
  `.trim();

  return await sendWhatsAppMessage(user.phone, message);
};

/**
 * Send rich media message with image
 */
export const sendMediaWhatsApp = async (phone, message, mediaUrl) => {
  return await sendWhatsAppMessage(phone, message, mediaUrl);
};

/**
 * Check if WhatsApp service is available
 */
export const isWhatsAppServiceAvailable = () => {
  return isWhatsAppEnabled;
};

export default {
  sendWhatsAppMessage,
  sendOrderConfirmationWhatsApp,
  sendOrderShippedWhatsApp,
  sendOrderDeliveredWhatsApp,
  sendPaymentConfirmationWhatsApp,
  sendOrderCancellationWhatsApp,
  sendPromotionalWhatsApp,
  sendOTPWhatsApp,
  sendWelcomeWhatsApp,
  sendSupportMessageWhatsApp,
  sendCartReminderWhatsApp,
  sendMediaWhatsApp,
  isWhatsAppServiceAvailable,
};
