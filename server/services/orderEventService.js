/**
 * orderEventService.js — Event-Driven Notification Handler
 *
 * Listens to events on the application eventBus and triggers:
 *   - Customer SMS notifications (via Twilio sms.service.js)
 *   - Admin SMS alerts
 *   - Console logs for auditing
 *
 * CRITICAL RULE: Every handler is wrapped in try/catch.
 * A notification failure must NEVER bubble back to the API controller.
 *
 * HOW TO ADD A NEW EVENT:
 *   1. Add an event name constant to utils/eventBus.js → EVENTS
 *   2. Add a handler here: eventBus.on(EVENTS.YOUR_EVENT, async (data) => { ... })
 *   3. Emit from the relevant controller: eventBus.emit(EVENTS.YOUR_EVENT, payload)
 */

import eventBus, { EVENTS } from '../utils/eventBus.js';
import {
  sendSMS,
  sendOrderStatusUpdateSMS,
  sendLowStockAlertSMS,
} from './sms.service.js';

// Admin phone number — read lazily so dotenv has time to load before first use
// (ES module static imports are hoisted before dotenv.config() runs in server.js)
const getAdminPhone = () => process.env.ADMIN_PHONE_NUMBER || process.env.ADMIN_PHONE || null;

// ─────────────────────────────────────────────────────────────────────────────
// Helper — safely extract phone from order payload
// ─────────────────────────────────────────────────────────────────────────────
const getCustomerPhone = (order) =>
  order?.customer_phone ||
  order?.shipping_address?.phone ||
  order?.contact_details?.phone ||
  null;

// ─────────────────────────────────────────────────────────────────────────────
// Helper — safely send customer SMS (absorbs errors)
// ─────────────────────────────────────────────────────────────────────────────
const safeCustomerSMS = async (phone, message, eventName) => {
  if (!phone) {
    console.warn(`[EventBus][${eventName}] No customer phone — SMS skipped`);
    return;
  }
  try {
    const result = await sendSMS(phone, message);
    if (result.success) {
      console.log(`[EventBus][${eventName}] ✅ Customer SMS sent to ${phone}`);
    } else {
      console.warn(`[EventBus][${eventName}] ⚠️ Customer SMS failed:`, result.error);
    }
  } catch (err) {
    console.error(`[EventBus][${eventName}] ❌ SMS error (non-fatal):`, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper — safely send admin SMS (absorbs errors)
// ─────────────────────────────────────────────────────────────────────────────
const safeAdminSMS = async (message, eventName) => {
  const ADMIN_PHONE = getAdminPhone();
  if (!ADMIN_PHONE) {
    // Admin phone not configured — silent skip (not a warning, just optional)
    return;
  }
  try {
    const result = await sendSMS(ADMIN_PHONE, message);
    if (result.success) {
      console.log(`[EventBus][${eventName}] ✅ Admin SMS sent`);
    }
  } catch (err) {
    console.error(`[EventBus][${eventName}] ❌ Admin SMS error (non-fatal):`, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDER_CREATED
//   Payload: { order, paymentMethod }
//   Triggers: admin new-order SMS alert
//   NOTE: Customer confirmation SMS is already handled directly in order.controller.js.
//         This handler only sends the admin notification to avoid duplicates.
// ─────────────────────────────────────────────────────────────────────────────
eventBus.on(EVENTS.ORDER_CREATED, async ({ order, paymentMethod } = {}) => {
  try {
    if (!order) return;

    const orderNumber = order.order_number || order.id;
    const total = order.total_price || order.total_amount || 0;
    const name = order.customer_name || 'Customer';

    // Admin SMS only (customer SMS is sent directly by order.controller.js)
    const adminMsg =
      `🛍️ New Order #${orderNumber} | ₹${total} | ` +
      `${paymentMethod === 'COD' ? 'COD' : 'PAID'} | Customer: ${name}`;
    await safeAdminSMS(adminMsg, 'ORDER_CREATED');

    console.log(`[EventBus][ORDER_CREATED] Admin notified for order #${orderNumber}`);
  } catch (err) {
    console.error('[EventBus][ORDER_CREATED] Handler error (non-fatal):', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT_SUCCESS
//   Payload: { order, paymentId, razorpayOrderId }
//   Triggers: payment confirmation SMS to customer
// ─────────────────────────────────────────────────────────────────────────────
eventBus.on(EVENTS.PAYMENT_SUCCESS, async ({ order, paymentId } = {}) => {
  try {
    if (!order) return;

    const phone = getCustomerPhone(order);
    const orderNumber = order.order_number || order.id;
    const total = order.total_price || order.total_amount || 0;
    const name = order.customer_name || 'Customer';

    const customerMsg =
      `Hi ${name}! Payment of ₹${total} confirmed for order #${orderNumber}. ` +
      `Payment ID: ${paymentId || 'N/A'}. Thank you for shopping with Shringarika! 🛍️`;

    await safeCustomerSMS(phone, customerMsg, 'PAYMENT_SUCCESS');

    console.log(`[EventBus][PAYMENT_SUCCESS] Processed for order #${orderNumber}`);
  } catch (err) {
    console.error('[EventBus][PAYMENT_SUCCESS] Handler error (non-fatal):', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ORDER_STATUS_CHANGED
//   Payload: { order, newStatus, trackingNumber? }
//   Triggers: status update SMS to customer
// ─────────────────────────────────────────────────────────────────────────────
eventBus.on(EVENTS.ORDER_STATUS_CHANGED, async ({ order, newStatus, trackingNumber } = {}) => {
  try {
    if (!order || !newStatus) return;

    // Use the existing comprehensive status SMS helper
    await sendOrderStatusUpdateSMS(order, null, newStatus, trackingNumber);

    console.log(`[EventBus][ORDER_STATUS_CHANGED] Status "${newStatus}" SMS sent for order #${order.order_number || order.id}`);
  } catch (err) {
    console.error('[EventBus][ORDER_STATUS_CHANGED] Handler error (non-fatal):', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RETURN_APPROVED
//   Payload: { order, returnData }
//   Triggers: return approval SMS to customer
// ─────────────────────────────────────────────────────────────────────────────
eventBus.on(EVENTS.RETURN_APPROVED, async ({ order, returnData } = {}) => {
  try {
    if (!order) return;

    const phone = getCustomerPhone(order);
    const orderNumber = order.order_number || order.id;
    const name = order.customer_name || 'Customer';

    const customerMsg =
      `Hi ${name}! Your return request for order #${orderNumber} has been approved. ` +
      `Your refund will be processed within 5-7 business days. - Shringarika`;

    await safeCustomerSMS(phone, customerMsg, 'RETURN_APPROVED');

    console.log(`[EventBus][RETURN_APPROVED] Processed for order #${orderNumber}`);
  } catch (err) {
    console.error('[EventBus][RETURN_APPROVED] Handler error (non-fatal):', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REFUND_COMPLETED
//   Payload: { order, refundAmount, refundId }
//   Triggers: refund completion SMS to customer
// ─────────────────────────────────────────────────────────────────────────────
eventBus.on(EVENTS.REFUND_COMPLETED, async ({ order, refundAmount, refundId } = {}) => {
  try {
    if (!order) return;

    const phone = getCustomerPhone(order);
    const orderNumber = order.order_number || order.id;
    const name = order.customer_name || 'Customer';
    const amount = refundAmount || order.total_price || order.total_amount || 0;

    const customerMsg =
      `Hi ${name}! Your refund of ₹${amount} for order #${orderNumber} has been processed. ` +
      (refundId ? `Refund ID: ${refundId}. ` : '') +
      `It will be credited in 5-7 business days. - Shringarika`;

    await safeCustomerSMS(phone, customerMsg, 'REFUND_COMPLETED');

    console.log(`[EventBus][REFUND_COMPLETED] Processed for order #${orderNumber}`);
  } catch (err) {
    console.error('[EventBus][REFUND_COMPLETED] Handler error (non-fatal):', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LOW_STOCK
//   Payload: { product, remainingStock }
//   Triggers: admin low-stock SMS alert
// ─────────────────────────────────────────────────────────────────────────────
eventBus.on(EVENTS.LOW_STOCK, async ({ product, remainingStock } = {}) => {
  try {
    const ADMIN_PHONE = getAdminPhone();
    if (!product || !ADMIN_PHONE) return;

    await sendLowStockAlertSMS(
      { name: product.name, sku: product.id, stock: remainingStock },
      ADMIN_PHONE
    );

    console.log(`[EventBus][LOW_STOCK] Admin alerted for product: ${product.name}`);
  } catch (err) {
    console.error('[EventBus][LOW_STOCK] Handler error (non-fatal):', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Initialization log
// ─────────────────────────────────────────────────────────────────────────────
export const initializeOrderEventService = () => {
  console.log('✅ [EventBus] orderEventService initialized — listening for:');
  console.log('   ORDER_CREATED | PAYMENT_SUCCESS | ORDER_STATUS_CHANGED');
  console.log('   RETURN_APPROVED | REFUND_COMPLETED | LOW_STOCK');
  const adminPhone = getAdminPhone();
  if (adminPhone) {
    console.log(`   Admin SMS alerts → ${adminPhone}`);
  } else {
    console.log('   ⚠️  ADMIN_PHONE_NUMBER not set — admin SMS alerts disabled');
  }
};

export default eventBus;
