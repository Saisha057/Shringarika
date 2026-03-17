import Razorpay from 'razorpay';
import crypto from 'crypto';

// Lazy singleton — created on first use so env vars are already loaded
let _razorpayInstance = null;

export const getRazorpayInstance = () => {
  if (!_razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env');
    }
    _razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpayInstance;
};

// Keep named export for backward compatibility
export const razorpayInstance = null; // not used anymore — use getRazorpayInstance()

// amount is in INR rupees — convert to paise (integer only)
export const createRazorpayOrder = async (amount, currency = 'INR', receipt) => {
  try {
    const rzp = getRazorpayInstance();
    const options = {
      amount: Math.round(amount * 100), // rupees → paise
      currency,
      receipt: String(receipt).slice(0, 40), // max 40 chars
      payment_capture: 1,
    };
    const order = await rzp.orders.create(options);
    return order;
  } catch (error) {
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
};

export const verifyRazorpaySignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');
  return expectedSignature === signature;
};
