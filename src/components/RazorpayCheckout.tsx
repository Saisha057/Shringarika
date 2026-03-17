import { useState } from 'react';
import axios from 'axios';

interface RazorpayCheckoutProps {
  amount: number;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onSuccess: (paymentDetails: any) => void;
  onFailure: (error: string) => void;
  disabled?: boolean;
}

// Declare Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

const API_URL = import.meta.env.VITE_API_URL || ''; // Use Vite proxy (empty = relative URLs)

export function RazorpayCheckout({
  amount,
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onFailure,
  disabled = false,
}: RazorpayCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      // Step 1: Create Razorpay order on backend
      const { data: orderData } = await axios.post(
        `${API_URL}/payments/create-order`,
        {
          amount,
          currency: 'INR',
          receipt: orderId,
          notes: {
            orderId,
            customerName,
            customerEmail,
          },
        }
      );

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      console.log('✅ Razorpay order created:', orderData.order.id);

      // Step 2: Load Razorpay checkout
      const options = {
        key: orderData.key, // Razorpay Key ID from backend
        amount: orderData.order.amount, // Amount in paise
        currency: orderData.order.currency,
        name: 'Shringarika',
        description: `Order #${orderId}`,
        // ✅ FIX: Removed logo to prevent mixed content warning (http in https)
        // Add back with absolute HTTPS URL in production: image: 'https://yourdomain.com/logo.png'
        order_id: orderData.order.id, // Razorpay order ID
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: {
          color: '#000000', // Black theme matching your brand
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
            onFailure('Payment cancelled by user');
          },
        },
        handler: async function (response: any) {
          try {
            console.log('✅ Payment successful:', response);

            // ✅ FIX: Add timeout protection for payment verification (30 seconds max)
            const verificationTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Payment verification timeout - please check your orders page')), 30000);
            });

            // Step 3: Verify payment on backend
            const verificationPromise = axios.post(
              `${API_URL}/payments/verify-payment`,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                order_id: orderId,
              }
            );

            // Race between verification and timeout
            const { data: verifyData } = await Promise.race([verificationPromise, verificationTimeout]) as any;

            console.log('🔍 Verification response:', verifyData);

            // ✅ FIX: Check for both success field and status field
            const isVerified = verifyData.success === true || verifyData.status === 'success';

            if (isVerified) {
              console.log('✅ Payment verified successfully:', verifyData);
              
              // Handle warning case (payment verified but order update may have failed)
              if (verifyData.warning) {
                console.warn('⚠️ Warning:', verifyData.warning);
              }

              onSuccess({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_method: verifyData.payment?.method || 'online',
                amount: verifyData.payment?.amount || 0,
              });
            } else {
              throw new Error(verifyData.error || verifyData.message || 'Payment verification failed');
            }
          } catch (error: any) {
            console.error('❌ Payment verification error:', error);
            console.error('Error response:', error.response?.data);
            
            // Improved error messaging
            const errorData = error.response?.data;
            let errorMessage = error.message || 'Payment verification failed';
            let isPaymentSuccessful = false;
            
            // Handle specific error cases
            if (errorData) {
              // Check if payment was actually successful despite error
              if (errorData.success === true || errorData.warning) {
                isPaymentSuccessful = true;
                errorMessage = errorData.warning || 'Payment verified successfully but there was an issue updating your order. Please contact support with your payment ID: ' + response.razorpay_payment_id;
              } else if (errorData.error?.includes('Payment verified but failed to update order')) {
                isPaymentSuccessful = true;
                errorMessage = 'Payment received successfully! However, there was an issue updating your order. Your payment ID is: ' + response.razorpay_payment_id + '. Please contact support with this ID.';
              } else {
                errorMessage = errorData.error || errorData.message || errorMessage;
              }
            }
            
            // If payment was successful despite errors, call onSuccess instead of onFailure
            if (isPaymentSuccessful) {
              console.warn('⚠️ Payment successful with warnings:', errorMessage);
              onSuccess({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_method: 'online',
                amount: 0,
                warning: errorMessage
              });
            } else {
              onFailure(errorMessage);
            }
          } finally {
            setIsLoading(false);
          }
        },
      };

      // Check if Razorpay script is loaded
      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      const rzp = new window.Razorpay(options);

      // Handle payment errors
      rzp.on('payment.failed', function (response: any) {
        console.error('❌ Payment failed:', response.error);
        setIsLoading(false);
        onFailure(
          response.error.description || 'Payment failed. Please try again.'
        );
      });

      // Open Razorpay checkout
      rzp.open();
    } catch (error: any) {
      console.error('❌ Razorpay checkout error:', error);
      setIsLoading(false);
      onFailure(error.message || 'Failed to initialize payment. Please try again.');
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={disabled || isLoading}
      className={`w-full py-4 rounded-full text-sm font-medium tracking-wider transition-all ${
        disabled || isLoading
          ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
          : 'bg-black text-white hover:bg-neutral-800 active:scale-95'
      }`}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          PROCESSING...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          PAY ₹{amount.toLocaleString('en-IN')}
        </span>
      )}
    </button>
  );
}
