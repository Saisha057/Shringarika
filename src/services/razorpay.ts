// Razorpay Payment Integration Service

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: any) => void;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const initiatePayment = async (
  orderData: {
    amount: number;
    orderId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  },
  onSuccess: (paymentData: any) => void,
  onFailure: (error: any) => void
) => {
  const res = await loadRazorpayScript();

  if (!res) {
    alert('Razorpay SDK failed to load. Please check your internet connection.');
    return;
  }

  const options: RazorpayOptions = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_demo',
    amount: orderData.amount * 100, // Convert to paise
    currency: 'INR',
    name: 'SHRINGARIKA',
    description: 'Fashion Purchase',
    order_id: orderData.orderId,
    handler: function (response: any) {
      onSuccess({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
      });
    },
    prefill: {
      name: orderData.customerName,
      email: orderData.customerEmail,
      contact: orderData.customerPhone,
    },
    theme: {
      color: '#000000',
    },
  };

  const paymentObject = new window.Razorpay(options);
  
  paymentObject.on('payment.failed', function (response: any) {
    onFailure(response.error);
  });

  paymentObject.open();
};
