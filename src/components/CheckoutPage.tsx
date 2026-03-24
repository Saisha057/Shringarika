import { ChevronLeft, CreditCard, Banknote, Check, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import api, { orderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  validateEmail as validateEmailUtil,
  validatePhone as validatePhoneUtil,
  validatePinCode as validatePinCodeUtil,
  validateName,
  validateAddress,
  sanitizeText,
  sanitizeHTML
} from '../utils/validation';
import { ShippingCalculator } from './ShippingCalculator';
import { generateTrackingNumber, type ShippingRate } from '../utils/shipping';

interface CheckoutPageProps {
  onNavigateBack: () => void;
  onOrderPlaced: (orderId: string) => void;
}

interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
}

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  doorNo: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
  deliveryNotes: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  doorNo?: string;
  street?: string;
  city?: string;
  state?: string;
  pinCode?: string;
}

export function CheckoutPage({ onNavigateBack, onOrderPlaced }: CheckoutPageProps) {
  const { cart, getCartTotal, clearCart, updateQuantity } = useCart();
  const { user } = useAuth();

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    doorNo: '',
    street: '',
    city: '',
    state: '',
    pinCode: '',
    deliveryNotes: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE' | ''>('COD');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);

  const subtotal = getCartTotal();
  const deliveryCharge = shippingRate ? shippingRate.cost : 0;
  const total = subtotal + deliveryCharge;

  // Load saved addresses when component mounts
  useEffect(() => {
    if (user?.id) {
      const STORAGE_KEY = `savedAddresses_${user.id}`;
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const addresses = JSON.parse(saved) as SavedAddress[];
          setSavedAddresses(addresses);
          
          // Auto-select default address
          const defaultAddr = addresses.find(a => a.isDefault);
          if (defaultAddr) {
            handleSelectAddress(defaultAddr);
          }
        } catch (error) {
          console.error('Error loading saved addresses:', error);
        }
      }
    }
  }, [user]);

  const handleSelectAddress = (address: SavedAddress) => {
    setSelectedAddressId(address.id);
    setFormData(prev => ({
      ...prev,
      fullName: address.fullName,
      phone: address.phone,
      doorNo: address.addressLine1.split(',')[0].trim() || '',
      street: [address.addressLine1, address.addressLine2].filter(Boolean).join(', '),
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
    }));
    // Clear any errors when address is selected
    setErrors({});
  };

  const handleUseNewAddress = () => {
    setSelectedAddressId(null);
    setFormData(prev => ({
      ...prev,
      fullName: '',
      phone: '',
      doorNo: '',
      street: '',
      city: '',
      state: '',
      pinCode: '',
    }));
  };

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  const validateEmail = (email: string): boolean => {
    return validateEmailUtil(email).valid;
  };

  const validatePhone = (phone: string): boolean => {
    return validatePhoneUtil(phone).valid;
  };

  const validatePinCode = (pinCode: string): boolean => {
    return validatePinCodeUtil(pinCode).valid;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else {
      const nameValidation = validateName(formData.fullName);
      if (!nameValidation.valid) {
        newErrors.fullName = nameValidation.error || 'Invalid name';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Phone number must be 10 digits starting with 6-9';
    }

    if (!formData.doorNo.trim()) {
      newErrors.doorNo = 'Door number is required';
    }

    if (!formData.street.trim()) {
      newErrors.street = 'Street is required';
    } else {
      const streetValidation = validateAddress(formData.street);
      if (!streetValidation.valid) {
        newErrors.street = streetValidation.error || 'Invalid street address';
      }
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    } else {
      const cityValidation = validateName(formData.city);
      if (!cityValidation.valid) {
        newErrors.city = 'Invalid city name';
      }
    }

    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    if (!formData.pinCode.trim()) {
      newErrors.pinCode = 'Pin code is required';
    } else if (!validatePinCode(formData.pinCode)) {
      newErrors.pinCode = 'Pin code must be 6 digits';
    }

    // Payment method is always COD for now
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateOrderId = (): string => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `ORD${timestamp}${random}`;
  };

  const getEstimatedDeliveryDate = (): string => {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5); // 5 days from now
    return deliveryDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const generateOrderReceipt = (orderId: string) => {
    // Generate tracking number if shipping rate is available
    const trackingNumber = shippingRate ? generateTrackingNumber(shippingRate.courier, orderId) : null;
    
    const orderData = {
      orderId,
      orderDate: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      customer: {
        name: sanitizeText(formData.fullName),
        email: sanitizeText(formData.email),
        phone: sanitizeText(formData.phone),
        address: sanitizeText(`${formData.doorNo}, ${formData.street}, ${formData.city}, ${formData.state} - ${formData.pinCode}`),
      },
      shipping: shippingRate ? {
        zone: shippingRate.zone.name,
        cost: shippingRate.cost,
        courier: shippingRate.courier,
        trackingNumber: trackingNumber,
        estimatedDelivery: shippingRate.estimatedDelivery,
        isFreeShipping: shippingRate.isFreeShipping,
      } : null,
      items: cart.map((item) => ({
        name: item.product.name,
        size: item.size,
        color: item.product.colors?.[0] || item.product.color || 'N/A',
        quantity: item.quantity,
        price: Number(item.product.price || 0),
        total: Number(item.product.price || 0) * item.quantity,
        // FIX: Include product image in order data
        image: item.product.images && item.product.images.length > 0 ? item.product.images[0] : '/placeholder-product.jpg',
        productId: item.product.id,
      })),
      subtotal: subtotal.toFixed(2),
      deliveryCharge: deliveryCharge.toFixed(2),
      total: total.toFixed(2),
      paymentMethod: 'Cash on Delivery',
      estimatedDelivery: shippingRate ? 
        shippingRate.estimatedDelivery.max.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) :
        getEstimatedDeliveryDate(),
      deliveryNotes: sanitizeText(formData.deliveryNotes || 'None'),
    };

    // NOTE: Order will be saved to localStorage in handlePlaceOrder function
    // after API call attempt, so we don't duplicate save here

    // In a real application, you would send this data to a backend API
    // which would generate a PDF and send an email
    console.log('Order Receipt:', orderData);
    
    // Simulate email sending
    alert(`Order confirmation email will be sent to: ${formData.email}`);

    return orderData;
  };

  const handlePlaceOrder = async () => {
    // P1-001 FIX: Add comprehensive validation before placing order
    const validationErrors: string[] = [];
    
    if (!formData.fullName?.trim()) {
      validationErrors.push('❌ Full name is required');
    }
    
    if (!formData.phone?.match(/^[0-9]{10}$/)) {
      validationErrors.push('❌ Valid 10-digit phone number required');
    }
    
    if (!formData.email || !validateEmail(formData.email)) {
      validationErrors.push('❌ Valid email address required');
    }
    
    if (!formData.doorNo?.trim()) {
      validationErrors.push('❌ Door/House number is required');
    }
    
    if (!formData.street?.trim()) {
      validationErrors.push('❌ Street address is required');
    }
    
    if (!formData.city?.trim()) {
      validationErrors.push('❌ City is required');
    }
    
    if (!formData.state) {
      validationErrors.push('❌ State is required');
    }
    
    if (!formData.pinCode?.match(/^[0-9]{6}$/)) {
      validationErrors.push('❌ Valid 6-digit pin code required');
    }
    
    if (!paymentMethod) {
      validationErrors.push('❌ Please select a payment method');
    }
    
    if (cart.length === 0) {
      validationErrors.push('❌ Cart is empty');
    }
    
    // Show all validation errors
    if (validationErrors.length > 0) {
      alert('Please fix the following errors:\n\n' + validationErrors.join('\n'));
      return;
    }

    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.text-red-600');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsProcessing(true);

    try {
      // Generate guest UUID if not authenticated
      const guestUuid = !user ? crypto.randomUUID() : undefined;

      // Calculate order totals (NO TAX - product price only)
      const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      const deliveryCharge = 0; // Free delivery
      const discount = 0;
      const totalPrice = subtotal + deliveryCharge - discount;

      // Prepare complete order data for API
      const orderData = {
        guestUuid,
        orderItems: cart.map(item => ({
          product: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          variant: {
            id: item.variantId || null,
            size: item.size,
            color: item.color || item.product.colors?.[0] || ''
          }
        })),
        shippingAddress: {
          fullName: formData.fullName,
          doorNo: formData.doorNo,
          street: formData.street,
          city: formData.city,
          state: formData.state,
          pinCode: formData.pinCode,
          email: formData.email,
          phone: formData.phone
        },
        contactDetails: {
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        },
        paymentMethod: paymentMethod || 'COD',
        itemsPrice: subtotal,
        taxPrice: 0,  // NO TAX
        shippingPrice: deliveryCharge,
        discount: discount,
        totalPrice: totalPrice,
        deliveryNotes: formData.deliveryNotes || undefined
      };

      // Build local-cache base with product image — shared by both COD and Online paths
      const localOrderBase = {
        orderDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        customer: {
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          address: `${formData.doorNo}, ${formData.street}, ${formData.city}, ${formData.state} - ${formData.pinCode}`,
        },
        items: cart.map(item => ({
          name: item.product.name,
          size: item.size,
          color: item.color || item.product.colors?.[0] || 'N/A',
          quantity: item.quantity,
          price: item.product.price,
          total: item.product.price * item.quantity,
          image: item.product.images?.[0] || (item.product as any).image || null,
        })),
        subtotal: subtotal.toFixed(2),
        deliveryCharge: '0',
        total: totalPrice.toFixed(2),
        estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        deliveryNotes: formData.deliveryNotes || 'None',
      };

      // ONLINE PAYMENT: Open Razorpay FIRST — DB order is created only after payment is confirmed
      if (paymentMethod === 'ONLINE') {
        await handleRazorpayPayment(orderData, totalPrice, localOrderBase);
        return;
      }

      let orderId: string;
      let orderNumber: string;
      let orderDataToStore: any = null;

      // COD: Create order in DB
      try {
        console.log('💾 [CHECKOUT] Creating order via API...');
        const response = await orderAPI.create(orderData);
        console.log('✅ [CHECKOUT] API Response:', response);

        const apiResponse = response?.data || response;
        const isSuccessResponse =
          apiResponse?.status === 'success' ||
          apiResponse?.success === true ||
          response?.status === 201;

        if (!isSuccessResponse) {
          throw new Error(apiResponse?.message || 'Order creation failed');
        }

        orderId =
          apiResponse?.data?.orderId ||
          apiResponse?.orderId;
        orderNumber =
          apiResponse?.data?.orderNumber ||
          apiResponse?.orderNumber ||
          orderId;
        
        console.log('📊 [CHECKOUT] Order response:', {
          orderId: orderId,
          orderNumber: orderNumber,
        });
        
        if (!orderId) {
          console.error('❌ [CHECKOUT] Order ID extraction failed. Response:', response);
          throw new Error('Order ID not found in response. Database insert may have failed.');
        }

        console.log('✅ [CHECKOUT] Order created successfully in DATABASE. ID:', orderId, 'Number:', orderNumber);
        
        // Store the API-created order to localStorage cache
        orderDataToStore = {
          ...localOrderBase,
          orderId: orderId,
          orderNumber: orderNumber,
          paymentMethod: 'Cash on Delivery',
        };

      } catch (apiError: any) {
        console.error('❌ [CHECKOUT] API Error occurred:', apiError);
        console.error('❌ [CHECKOUT] Error details:', {
          message: apiError.message,
          response: apiError.response?.data,
          status: apiError.response?.status
        });

        const isTimeoutError =
          apiError?.code === 'ECONNABORTED' ||
          /timeout/i.test(apiError?.message || '');

        if (isTimeoutError) {
          console.warn('⚠️ [CHECKOUT] Order may have succeeded despite timeout');
        }

        const errorData = apiError.response?.data;
        const errorOrderId = errorData?.orderId || errorData?.data?.order?.id;

        if (errorOrderId) {
          console.warn('⚠️ [CHECKOUT] Order was created (ID:', errorOrderId, ') but returned error. Treating as SUCCESS.');

          orderId = errorOrderId;
          orderNumber = errorData?.orderNumber || errorData?.data?.order?.order_number || errorOrderId;

          orderDataToStore = {
            ...localOrderBase,
            orderId: orderId,
            orderNumber: orderNumber,
            paymentMethod: 'Cash on Delivery',
          };
        } else {
          if (isTimeoutError && user?.id) {
            try {
              const myOrdersResponse = await orderAPI.getMyOrders();
              const ordersRaw =
                myOrdersResponse?.data?.orders ||
                myOrdersResponse?.orders ||
                myOrdersResponse?.data ||
                myOrdersResponse;
              const orders = Array.isArray(ordersRaw) ? ordersRaw : [];

              const expectedItemsCount = cart.length;
              const expectedTotal = Number(totalPrice || 0);

              const timeoutRecoveredOrder = orders
                .filter((o: any) => {
                  const oTotal = Number(o?.totalPrice ?? o?.total ?? 0);
                  const oItems = Array.isArray(o?.orderItems)
                    ? o.orderItems
                    : Array.isArray(o?.items)
                      ? o.items
                      : [];
                  return oItems.length === expectedItemsCount && Math.abs(oTotal - expectedTotal) < 0.01;
                })
                .sort((a: any, b: any) => {
                  const aTime = new Date(a?.createdAt || a?.created_at || 0).getTime();
                  const bTime = new Date(b?.createdAt || b?.created_at || 0).getTime();
                  return bTime - aTime;
                })[0];

              if (timeoutRecoveredOrder) {
                orderId = timeoutRecoveredOrder?.id || timeoutRecoveredOrder?.orderId || timeoutRecoveredOrder?._id;
                orderNumber = timeoutRecoveredOrder?.orderNumber || timeoutRecoveredOrder?.order_number || orderId;

                if (orderId) {
                  console.warn('⚠️ [CHECKOUT] Timeout recovered with existing order:', orderId);
                  orderDataToStore = {
                    ...localOrderBase,
                    orderId,
                    orderNumber,
                    paymentMethod: 'Cash on Delivery',
                  };
                }
              }
            } catch (recoveryError) {
              console.error('❌ [CHECKOUT] Timeout recovery failed:', recoveryError);
            }
          }

          if (orderId) {
            console.warn('⚠️ [CHECKOUT] Proceeding with recovered order after error:', orderId);
          } else {
            console.error('❌ [CHECKOUT] Order creation FAILED - no orderId in response');
            const errorMessage = errorData?.message || apiError.message || 'Failed to create order';
            alert(`Order creation failed: ${errorMessage}\n\nPlease try again or contact support.`);

            setIsProcessing(false);
            return;
          }
        }
      }

      // Save order to localStorage ONLY as temporary cache (database is source of truth)
      if (orderId && user?.id) {
        const userOrdersKey = `fashionOrders_${user.id}`;
        console.log('📦 [CHECKOUT] Caching order to localStorage (temporary):', userOrdersKey);
        console.log('👤 Current user:', user.name, 'ID:', user.id);
        const existingOrders = JSON.parse(localStorage.getItem(userOrdersKey) || '[]');
        
        // Ensure orderDataToStore has all required fields
        if (orderDataToStore) {
          existingOrders.push(orderDataToStore);
          
          // CRITICAL: Save synchronously and verify immediately
          try {
            localStorage.setItem(userOrdersKey, JSON.stringify(existingOrders));
            console.log('💾 Saved order to localStorage:', userOrdersKey);
            console.log('📦 Order data:', orderDataToStore);
            console.log('✅ Total orders now:', existingOrders.length);
            
            // IMMEDIATE verification - read back what we just wrote
            const verification = localStorage.getItem(userOrdersKey);
            const verifiedOrders = verification ? JSON.parse(verification) : [];
            console.log('🔍 Verification - localStorage has', verifiedOrders.length, 'orders');
            
            // CRITICAL CHECK: Ensure our order is actually there
            const orderExists = verifiedOrders.some((o: any) => o.orderId === orderId);
            if (!orderExists) {
              console.error('❌ CRITICAL: Order was NOT saved correctly!');
              alert('⚠️ Warning: Order may not have been saved. Please check your orders page.');
            } else {
              console.log('✅ VERIFIED: Order exists in localStorage');
            }
          } catch (saveError) {
            console.error('❌ Failed to save order to localStorage:', saveError);
            alert('⚠️ Warning: Failed to save order locally. Please contact support with your order ID: ' + orderId);
          }
        } else {
          console.error('❌ orderDataToStore is null, cannot save order');
        }
      } else {
        console.warn('⚠️ Cannot save order - missing orderId or user.id:', { orderId: !!orderId, userId: user?.id });
      }

      // Clear cart
      clearCart();
      
      // ✅ STOCK REFRESH: Trigger product list refresh to show updated stock
      // This ensures when user navigates back, they see correct stock levels
      console.log('🔄 [STOCK] Order placed - stock has been reduced in database');
      console.log('💡 [STOCK] Product pages will show updated stock on next visit');
      
      // Dispatch custom event to notify other components that stock changed
      window.dispatchEvent(new CustomEvent('stockUpdated', { 
        detail: { 
          orderItems: cart.map(item => ({
            productId: item.product.id,
            size: item.size,
            quantity: item.quantity
          }))
        }
      }));
      
      setIsProcessing(false);
      
      // SAFEGUARD: Ensure orderId is never undefined
      if (!orderId) {
        console.error('❌ CRITICAL: orderId is still undefined after order creation!');
        console.error('📊 Final check before navigation:', { orderId, orderNumber });
        alert('⚠️ Order was created but order ID could not be retrieved. Please check your email for confirmation.');
        return;
      }
      
      console.log('⏱️ Waiting for localStorage to settle...');
      // Increased delay to ensure localStorage write completes and can be read back
      await new Promise(resolve => setTimeout(resolve, 300));
      console.log('⏱️ Storage sync delay complete');
      
      // Final verification before navigation
      if (user?.id) {
        const finalCheck = localStorage.getItem(`fashionOrders_${user.id}`);
        const finalOrders = finalCheck ? JSON.parse(finalCheck) : [];
        const orderExistsInFinal = finalOrders.some((o: any) => o.orderId === orderId);
        console.log('🔍 FINAL CHECK before navigation - Order exists:', orderExistsInFinal, 'Total orders:', finalOrders.length);
      }
      
      console.log('🚀 Proceeding to confirmation page');

      // Navigate to order confirmation page
      onOrderPlaced(orderId);
      return;
      
    } catch (error: any) {
      console.error('❌ Error placing order:', error);
      setIsProcessing(false);
      alert('Failed to place order. Please try again.');
    }
  };

  // ── Razorpay: opens modal FIRST, creates DB order only AFTER payment success ──
  const handleRazorpayPayment = async (
    orderData: any,
    amount: number,
    localOrderBase: any
  ) => {
    try {
      setIsProcessing(true);
      setPaymentError(null);

      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Payment gateway not loaded. Please refresh the page and try again.');
      }

      // Step 1: Create a Razorpay payment order (NOT the website order yet)
      const { data: rpOrderData } = await api.post('/payment/create-order', {
        amount,
        currency: 'INR',
        notes: { customerName: formData.fullName, customerEmail: formData.email },
      });

      if (!rpOrderData.success) {
        throw new Error(rpOrderData.error || 'Failed to create payment order');
      }

      const options = {
        key: rpOrderData.key,
        amount: rpOrderData.order.amount,
        currency: rpOrderData.order.currency,
        name: 'Shringarika',
        description: 'Secure Payment',
        order_id: rpOrderData.order.id,
        prefill: {
          name: formData.fullName,
          email: formData.email,
          contact: formData.phone,
        },
        theme: { color: '#000000' },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setPaymentError('Payment cancelled. Please try again when ready.');
          },
        },
        handler: async (response: any) => {
          try {
            // Step 2: Verify payment signature
            const { data: verifyData } = await api.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            const isVerified = verifyData.success === true || verifyData.status === 'success';
            if (!isVerified) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            // Step 3: NOW create the actual website order in DB (payment confirmed)
            const orderResponse = await orderAPI.create({ 
              ...orderData, 
              paymentMethod: 'ONLINE',
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
            } as any);
            const order = orderResponse.data?.order || orderResponse.order || orderResponse;
            const orderId = order?.id || order?.orderId || order?._id;
            const orderNumber = order?.orderNumber || order?.order_number || orderId;

            if (!orderId) {
              throw new Error('Order created but ID not returned. Please contact support.');
            }

            // Step 4: Save to localStorage cache
            const orderDataToStore = {
              ...localOrderBase,
              orderId,
              orderNumber,
              paymentMethod: 'Online Payment (Razorpay)',
              paymentId: response.razorpay_payment_id,
            };

            if (user?.id) {
              const userOrdersKey = `fashionOrders_${user.id}`;
              const existingOrders = JSON.parse(localStorage.getItem(userOrdersKey) || '[]');
              existingOrders.push(orderDataToStore);
              localStorage.setItem(userOrdersKey, JSON.stringify(existingOrders));
            }

            // Step 5: Clear cart and navigate to confirmation
            clearCart();
            setIsProcessing(false);
            onOrderPlaced(orderId);
          } catch (err: any) {
            setIsProcessing(false);
            setPaymentError(
              `Payment received (ID: ${response.razorpay_payment_id}) but order setup failed. Please contact support.`
            );
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        setIsProcessing(false);
        setPaymentError(response.error?.description || 'Payment failed. Please try again.');
      });
      rzp.open();
    } catch (error: any) {
      setIsProcessing(false);
      setPaymentError(error.message || 'Failed to initialize payment. Please try again.');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="text-center py-20">
            <h1 className="text-4xl tracking-wider mb-4">YOUR CART IS EMPTY</h1>
            <p className="text-neutral-600 mb-8">Add items to proceed to checkout</p>
            <button
              onClick={onNavigateBack}
              className="bg-black text-white px-8 py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
            >
              GO TO CART
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-8 py-6 border-b border-neutral-200">
        <button 
          onClick={onNavigateBack}
          className="flex items-center gap-2 text-sm hover:underline mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>BACK TO CART</span>
        </button>
        <h1 className="text-4xl tracking-wider">CHECKOUT</h1>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Saved Addresses Selection */}
            {savedAddresses.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl tracking-wider">SELECT DELIVERY ADDRESS</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedAddresses.map(address => (
                    <div
                      key={address.id}
                      onClick={() => handleSelectAddress(address)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedAddressId === address.id
                          ? 'border-black bg-neutral-50'
                          : 'border-neutral-300 hover:border-neutral-400 hover:shadow-md'
                      }`}
                    >
                      {address.isDefault && (
                        <span className="inline-block text-xs bg-black text-white px-2 py-1 rounded mb-2">
                          DEFAULT
                        </span>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-base mb-1">{address.fullName}</p>
                          <p className="text-sm text-neutral-700">{address.phone}</p>
                          <p className="text-sm text-neutral-600 mt-2">{address.addressLine1}</p>
                          {address.addressLine2 && (
                            <p className="text-sm text-neutral-600">{address.addressLine2}</p>
                          )}
                          <p className="text-sm text-neutral-600">
                            {address.city}, {address.state} - {address.pinCode}
                          </p>
                        </div>
                        {selectedAddressId === address.id && (
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {selectedAddressId && (
                  <button
                    onClick={handleUseNewAddress}
                    className="text-sm text-neutral-600 hover:text-black underline"
                  >
                    Use a different address
                  </button>
                )}
                <div className="border-t border-neutral-200 pt-6 mt-6" />
              </div>
            )}
            
            {/* Customer Information */}
            <div className="space-y-4">
              <h2 className="text-2xl tracking-wider">
                {savedAddresses.length > 0 && selectedAddressId 
                  ? 'CONFIRM DETAILS' 
                  : 'CUSTOMER INFORMATION'}
              </h2>
              
              <div>
                <label className="block text-sm tracking-wider mb-2">
                  FULL NAME <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                  placeholder="Enter your full name"
                />
                {errors.fullName && (
                  <p className="text-red-600 text-xs mt-1">{errors.fullName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm tracking-wider mb-2">
                    EMAIL ADDRESS <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="your.email@example.com"
                  />
                  {errors.email && (
                    <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm tracking-wider mb-2">
                    PHONE NUMBER <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                  />
                  {errors.phone && (
                    <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-4 pt-6 border-t border-neutral-200">
              <h2 className="text-2xl tracking-wider">DELIVERY ADDRESS</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm tracking-wider mb-2">
                    DOOR NO / FLAT NO <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.doorNo}
                    onChange={(e) => handleInputChange('doorNo', e.target.value)}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="Door/Flat number"
                  />
                  {errors.doorNo && (
                    <p className="text-red-600 text-xs mt-1">{errors.doorNo}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm tracking-wider mb-2">
                    STREET <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => handleInputChange('street', e.target.value)}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="Street name"
                  />
                  {errors.street && (
                    <p className="text-red-600 text-xs mt-1">{errors.street}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm tracking-wider mb-2">
                    CITY <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="City"
                  />
                  {errors.city && (
                    <p className="text-red-600 text-xs mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm tracking-wider mb-2">
                    STATE <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                  >
                    <option value="">Select State</option>
                    {indianStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  {errors.state && (
                    <p className="text-red-600 text-xs mt-1">{errors.state}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm tracking-wider mb-2">
                    PIN CODE <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pinCode}
                    onChange={(e) => handleInputChange('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                    placeholder="6-digit PIN"
                    maxLength={6}
                  />
                  {errors.pinCode && (
                    <p className="text-red-600 text-xs mt-1">{errors.pinCode}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">
                  DELIVERY NOTES (Optional)
                </label>
                <textarea
                  value={formData.deliveryNotes}
                  onChange={(e) => handleInputChange('deliveryNotes', e.target.value)}
                  className="w-full border border-neutral-300 rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
                  placeholder="Any special instructions for delivery"
                  rows={3}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-4 pt-6 border-t border-neutral-200">
              <h2 className="text-2xl tracking-wider">PAYMENT METHOD</h2>

              <div className="space-y-3">
                {/* Cash on Delivery */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('COD'); setPaymentError(null); }}
                  className={`w-full border-2 rounded-lg p-4 flex items-center gap-4 transition-colors ${
                    paymentMethod === 'COD' ? 'border-black bg-neutral-50' : 'border-neutral-300 hover:border-neutral-400'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center shrink-0">
                    {paymentMethod === 'COD' && <div className="w-3 h-3 rounded-full bg-black" />}
                  </div>
                  <Banknote className="w-6 h-6 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="tracking-wider">CASH ON DELIVERY</p>
                    <p className="text-xs text-neutral-600">Pay when you receive your order</p>
                  </div>
                </button>

                {/* Online Payment (Razorpay) */}
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('ONLINE'); setPaymentError(null); }}
                  className={`w-full border-2 rounded-lg p-4 flex items-center gap-4 transition-colors ${
                    paymentMethod === 'ONLINE' ? 'border-black bg-neutral-50' : 'border-neutral-300 hover:border-neutral-400'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center shrink-0">
                    {paymentMethod === 'ONLINE' && <div className="w-3 h-3 rounded-full bg-black" />}
                  </div>
                  <CreditCard className="w-6 h-6 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="tracking-wider">ONLINE PAYMENT</p>
                    <p className="text-xs text-neutral-600">UPI, Cards, Net Banking via Razorpay</p>
                  </div>
                </button>

                {/* Payment error */}
                {paymentError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {paymentError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="border border-neutral-300 rounded-lg p-6 sticky top-24">
              <h2 className="text-2xl tracking-wider mb-6">ORDER SUMMARY</h2>

              {/* Cart Items */}
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {cart.map((item) => {
                  // FIX: Get product image from images array
                  const productImage = item.product.images && item.product.images.length > 0 
                    ? item.product.images[0] 
                    : null
                  // FIX: Get actual color selected or default color
                  const displayColor = item.product.colors && item.product.colors.length > 0
                    ? item.product.colors[0]
                    : item.product.color

                  return (
                    <div key={`${item.product.id}-${item.size}`} className="flex gap-3 pb-4 border-b border-neutral-200">
                      {/* FIX: Display actual product image */}
                      <div className="w-20 h-24 bg-neutral-200 border border-neutral-300 shrink-0 flex items-center justify-center overflow-hidden">
                        {productImage ? (
                          <img 
                            src={productImage} 
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement
                              if (fallback) fallback.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div 
                          className="w-full h-full flex items-center justify-center"
                          style={{ display: productImage ? 'none' : 'flex' }}
                        >
                          <span className="text-xs text-neutral-500">IMG</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm tracking-wider mb-1">{item.product.name}</h3>
                        {/* FIX: Display actual price and color */}
                        <p className="text-xs text-neutral-600 mb-2">
                          Size: {item.size} / {displayColor}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-neutral-300 rounded">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.size, item.quantity - 1)}
                              className="px-2 py-1 hover:bg-neutral-100 text-sm"
                            >
                              −
                            </button>
                            <span className="px-3 text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.size, item.quantity + 1)}
                              className="px-2 py-1 hover:bg-neutral-100 text-sm"
                            >
                              +
                            </button>
                          </div>
                          {/* FIX: Display actual price */}
                          <p className="text-sm">₹{(Number(item.product.price) * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pricing */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Delivery Charge</span>
                  <span>
                    {shippingRate ? (
                      shippingRate.isFreeShipping ? (
                        <span className="text-green-600 font-semibold">FREE</span>
                      ) : (
                        `₹${shippingRate.cost.toFixed(2)}`
                      )
                    ) : (
                      <span className="text-neutral-400">Calculate below</span>
                    )}
                  </span>
                </div>
                {shippingRate && !shippingRate.isFreeShipping && shippingRate.zone.freeShippingThreshold > subtotal && (
                  <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    Add ₹{(shippingRate.zone.freeShippingThreshold - subtotal).toFixed(0)} more for FREE shipping!
                  </p>
                )}
                <div className="border-t border-neutral-300 pt-3 flex justify-between">
                  <span className="tracking-wider">TOTAL</span>
                  <span className="text-2xl">₹{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Shipping Calculator */}
              <div className="mb-6">
                <ShippingCalculator 
                  cartValue={subtotal}
                  weight={cart.length * 0.5} // Assume 0.5kg per item
                  onShippingCalculated={setShippingRate}
                />
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={isProcessing}
                className={`w-full py-4 rounded-full text-sm tracking-wider transition-colors ${
                  isProcessing
                    ? 'bg-neutral-400 text-neutral-600 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                {isProcessing ? 'PROCESSING...' : paymentMethod === 'ONLINE' ? `PAY ₹${Math.round(total)}` : 'PLACE ORDER'}
              </button>

              {/* Security Info */}
              <div className="mt-6 pt-6 border-t border-neutral-200 space-y-2 text-xs text-neutral-600">
                <div className="flex items-start gap-2">
                  <span>🔒</span>
                  <span>Secure checkout - Your data is protected</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Free returns within 30 days</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Estimated delivery: {getEstimatedDeliveryDate()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
