/**
 * INTEGRATION EXAMPLES
 * 
 * This file shows how to integrate all the enterprise features
 * into your existing components.
 */

// ============================================
// 1. AUTHENTICATION INTEGRATION
// ============================================

// In AuthContext.tsx - Replace mock implementation:

import { authAPI } from '../services/api';
import { sanitizeInput } from '../services/security';

const login = async (email: string, password: string) => {
  try {
    // Sanitize inputs
    const cleanEmail = sanitizeInput(email);
    const cleanPassword = sanitizeInput(password);
    
    // Call API
    const response = await authAPI.login(cleanEmail, cleanPassword);
    const { token, user } = response.data;
    
    // Store token
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // Track login event
    trackEvent('User', 'Login', user.email);
    
    setUser(user);
    setIsAuthenticated(true);
    
    return { success: true };
  } catch (error: any) {
    console.error('Login failed:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Login failed' 
    };
  }
};

// ============================================
// 2. RAZORPAY PAYMENT INTEGRATION
// ============================================

// In CheckoutPage.tsx - Replace handlePlaceOrder:

import { initiatePayment } from '../services/razorpay';
import { paymentAPI, ordersAPI } from '../services/api';
import { trackPurchase, trackFBPurchase } from '../services/analytics';

const handlePlaceOrder = async () => {
  // Validate form first
  if (!validateForm()) return;
  
  setIsProcessing(true);
  
  try {
    // For online payment
    if (paymentMethod === 'ONLINE') {
      // 1. Create Razorpay order on backend
      const { data } = await paymentAPI.createOrder(total);
      
      // 2. Initiate Razorpay payment
      await initiatePayment(
        {
          amount: total,
          orderId: data.orderId,
          customerName: formData.fullName,
          customerEmail: formData.email,
          customerPhone: formData.phone,
        },
        async (paymentData) => {
          // 3. Verify payment
          await paymentAPI.verifyPayment(paymentData);
          
          // 4. Create order in database
          const order = await ordersAPI.create({
            items: cart,
            customer: formData,
            payment: {
              method: 'Online',
              status: 'Paid',
              transactionId: paymentData.razorpay_payment_id,
            },
            total,
          });
          
          // 5. Track analytics
          trackPurchase(order.data.orderId, total, cart);
          trackFBPurchase(total);
          
          // 6. Clear cart and redirect
          clearCart();
          onOrderPlaced(order.data.orderId);
        },
        (error) => {
          alert('Payment failed: ' + error.description);
          setIsProcessing(false);
        }
      );
    } else {
      // COD order - direct creation
      const order = await ordersAPI.create({
        items: cart,
        customer: formData,
        payment: { method: 'COD', status: 'Pending' },
        total,
      });
      
      trackPurchase(order.data.orderId, total, cart);
      clearCart();
      onOrderPlaced(order.data.orderId);
    }
  } catch (error) {
    console.error('Order failed:', error);
    alert('Failed to place order. Please try again.');
  } finally {
    setIsProcessing(false);
  }
};

// ============================================
// 3. PRODUCT SEARCH & FILTERING
// ============================================

// In SearchPage.tsx:

import { productsAPI } from '../services/api';
import { trackSearch } from '../services/analytics';

const [products, setProducts] = useState([]);
const [filters, setFilters] = useState({
  search: '',
  category: '',
  minPrice: 0,
  maxPrice: 10000,
  sort: 'newest',
});

const searchProducts = async () => {
  try {
    // Track search
    trackSearch(filters.search);
    
    // Fetch from API
    const response = await productsAPI.getAll(filters);
    setProducts(response.data.products);
  } catch (error) {
    console.error('Search failed:', error);
  }
};

// Debounced search
useEffect(() => {
  const timer = setTimeout(() => {
    searchProducts();
  }, 500);
  
  return () => clearTimeout(timer);
}, [filters]);

// ============================================
// 4. REVIEWS & RATINGS
// ============================================

// In ProductDetailPage.tsx - Add review section:

import { reviewsAPI } from '../services/api';

const [reviews, setReviews] = useState([]);
const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

useEffect(() => {
  loadReviews();
}, [productId]);

const loadReviews = async () => {
  try {
    const response = await reviewsAPI.getByProduct(productId);
    setReviews(response.data.reviews);
  } catch (error) {
    console.error('Failed to load reviews:', error);
  }
};

const submitReview = async () => {
  try {
    await reviewsAPI.create(productId, newReview);
    alert('Review submitted successfully!');
    loadReviews();
    setNewReview({ rating: 5, comment: '' });
  } catch (error) {
    alert('Failed to submit review');
  }
};

// ============================================
// 5. WISHLIST SYNC
// ============================================

// In WishlistPage.tsx - Replace localStorage with API:

import { userAPI } from '../services/api';

useEffect(() => {
  loadWishlist();
}, []);

const loadWishlist = async () => {
  try {
    const response = await userAPI.getWishlist();
    setWishlistItems(response.data.wishlist);
  } catch (error) {
    console.error('Failed to load wishlist:', error);
  }
};

const removeFromWishlist = async (productId: number) => {
  try {
    await userAPI.removeFromWishlist(productId);
    setWishlistItems(items => items.filter(item => item.id !== productId));
  } catch (error) {
    alert('Failed to remove from wishlist');
  }
};

// In ProductDetailPage.tsx:

const handleWishlist = async () => {
  try {
    if (isInWishlist) {
      await userAPI.removeFromWishlist(product.id);
      setIsInWishlist(false);
    } else {
      await userAPI.addToWishlist(product.id);
      setIsInWishlist(true);
    }
  } catch (error) {
    alert('Failed to update wishlist');
  }
};

// ============================================
// 6. ADMIN DASHBOARD WITH CHARTS
// ============================================

// In AdminDashboard.tsx:

import { analyticsAPI } from '../services/api';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const [salesData, setSalesData] = useState(null);
const [topProducts, setTopProducts] = useState([]);
const [revenueByCategory, setRevenueByCategory] = useState(null);

useEffect(() => {
  loadAnalytics();
}, []);

const loadAnalytics = async () => {
  try {
    const [sales, products, revenue] = await Promise.all([
      analyticsAPI.getSalesSummary(),
      analyticsAPI.getTopProducts(10),
      analyticsAPI.getRevenueByCategory(),
    ]);
    
    setSalesData(sales.data);
    setTopProducts(products.data);
    setRevenueByCategory(revenue.data);
  } catch (error) {
    console.error('Failed to load analytics:', error);
  }
};

// Chart data
const salesChartData = {
  labels: salesData?.labels || [],
  datasets: [{
    label: 'Sales',
    data: salesData?.values || [],
    borderColor: 'rgb(0, 0, 0)',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  }],
};

// ============================================
// 7. SHIPPING CALCULATION
// ============================================

// In CheckoutPage.tsx:

import { calculateShipping, calculateGST } from '../services/shipping';

const [shippingRates, setShippingRates] = useState([]);
const [selectedShipping, setSelectedShipping] = useState(null);
const [gstBreakdown, setGSTBreakdown] = useState(null);

useEffect(() => {
  if (formData.pinCode.length === 6) {
    loadShippingRates();
  }
}, [formData.pinCode]);

const loadShippingRates = async () => {
  try {
    const rates = await calculateShipping(
      '400001', // Your warehouse pincode
      formData.pinCode,
      calculateTotalWeight(), // Calculate based on products
      paymentMethod === 'COD' ? total : undefined
    );
    
    setShippingRates(rates);
    setSelectedShipping(rates[0]); // Default to standard
  } catch (error) {
    console.error('Failed to calculate shipping:', error);
  }
};

useEffect(() => {
  // Calculate GST
  const gst = calculateGST(subtotal, 5, isInterstate);
  setGSTBreakdown(gst);
}, [subtotal]);

// ============================================
// 8. BACKUP & EXPORT
// ============================================

// In SettingsPage.tsx - Add backup section:

import { downloadBackup, exportUserData, getBackupStatus } from '../services/backup';

const [backupStatus, setBackupStatus] = useState(null);

useEffect(() => {
  const status = getBackupStatus();
  setBackupStatus(status);
}, []);

const handleDownloadBackup = async () => {
  try {
    await downloadBackup();
    alert('Backup downloaded successfully!');
  } catch (error) {
    alert('Backup failed');
  }
};

const handleExportMyData = async () => {
  try {
    await exportUserData(user.id);
    alert('Your data has been exported!');
  } catch (error) {
    alert('Export failed');
  }
};

// ============================================
// 9. IMAGE UPLOAD (Admin)
// ============================================

// In AdminProductForm.tsx:

import { uploadAPI } from '../services/api';

const [uploading, setUploading] = useState(false);
const [imageUrls, setImageUrls] = useState([]);

const handleImageUpload = async (files: FileList) => {
  setUploading(true);
  try {
    const filesArray = Array.from(files);
    const response = await uploadAPI.multiple(filesArray);
    
    const urls = response.data.urls;
    setImageUrls([...imageUrls, ...urls]);
    
    alert('Images uploaded successfully!');
  } catch (error) {
    alert('Upload failed');
  } finally {
    setUploading(false);
  }
};

// ============================================
// 10. SECURITY FEATURES
// ============================================

// Use throughout the app:

import { 
  sanitizeInput, 
  sanitizeHTML,
  validatePasswordStrength,
  rateLimiter 
} from '../services/security';

// In any form
const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Sanitize all inputs
  const cleanData = {
    name: sanitizeInput(formData.name),
    email: sanitizeInput(formData.email),
    message: sanitizeHTML(formData.message), // Allow some HTML in messages
  };
  
  // Rate limiting
  if (!rateLimiter.canMakeRequest('contact-form')) {
    alert('Too many requests. Please try again later.');
    return;
  }
  
  // Submit form
  await submitContactForm(cleanData);
};

// Password validation in registration
const validatePassword = (password: string) => {
  const result = validatePasswordStrength(password);
  if (!result.isValid) {
    setErrors(result.messages);
    return false;
  }
  return true;
};

// ============================================
// SUMMARY
// ============================================

/**
 * All services are ready to use. Follow these steps:
 * 
 * 1. Set up .env variables (see .env.example)
 * 2. Start with authentication integration
 * 3. Add payment gateway to checkout
 * 4. Connect product fetching to API
 * 5. Add analytics tracking to key events
 * 6. Integrate remaining features gradually
 * 
 * Each service has error handling and is ready for production use.
 */

export {};
