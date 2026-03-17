import Razorpay from 'razorpay';

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay payout credentials are missing');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// Initiate UPI payout refund to customer
export const initiateUpiRefund = async ({
  upiId,
  amount,
  returnId,
  customerName,
  notes,
}) => {
  try {
    const razorpay = getRazorpayClient();
    console.log('[RazorpayPayout] Initiating UPI refund:', { upiId, amount, returnId });

    const contact = await razorpay.contacts.create({
      name: customerName || 'Customer',
      type: 'customer',
      reference_id: returnId,
    });

    console.log('[RazorpayPayout] Contact created:', contact.id);

    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contact.id,
      account_type: 'vpa',
      vpa: { address: upiId },
    });

    console.log('[RazorpayPayout] Fund account created:', fundAccount.id);

    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id: fundAccount.id,
      amount: Math.round(Number(amount || 0) * 100),
      currency: 'INR',
      mode: 'UPI',
      purpose: 'refund',
      queue_if_low_balance: true,
      reference_id: returnId,
      narration: `Refund for return ${returnId}`,
      notes: { return_id: returnId, notes: notes || '' },
    });

    console.log('[RazorpayPayout] Payout created:', payout.id, 'Status:', payout.status);
    return { success: true, payoutId: payout.id, status: payout.status };
  } catch (error) {
    console.error('[RazorpayPayout] Payout failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Initiate bank transfer refund
export const initiateBankRefund = async ({
  accountNumber,
  ifscCode,
  accountHolderName,
  amount,
  returnId,
}) => {
  try {
    const razorpay = getRazorpayClient();
    const contact = await razorpay.contacts.create({
      name: accountHolderName,
      type: 'customer',
      reference_id: returnId,
    });

    const fundAccount = await razorpay.fundAccount.create({
      contact_id: contact.id,
      account_type: 'bank_account',
      bank_account: {
        name: accountHolderName,
        ifsc: ifscCode,
        account_number: accountNumber,
      },
    });

    const payout = await razorpay.payouts.create({
      account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
      fund_account_id: fundAccount.id,
      amount: Math.round(Number(amount || 0) * 100),
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'refund',
      queue_if_low_balance: true,
      reference_id: returnId,
      narration: `Bank refund for return ${returnId}`,
    });

    return { success: true, payoutId: payout.id, status: payout.status };
  } catch (error) {
    console.error('[RazorpayPayout] Bank refund failed:', error.message);
    return { success: false, error: error.message };
  }
};
