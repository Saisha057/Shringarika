import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const API_ORIGIN = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 120000
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Try multiple token locations (user token, admin token, etc.)
    const token = localStorage.getItem('authToken') || 
                  localStorage.getItem('adminToken') || 
                  localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Sending request with auth token to:', config.method?.toUpperCase(), config.url);
    } else {
      console.log('⚠️ No auth token available for request to:', config.method?.toUpperCase(), config.url);
      // Check if this is an admin route that requires authentication
      if (config.url?.includes('/admin') || config.url?.includes('/orders/') && config.method !== 'get') {
        console.error('🚫 Admin/Protected route requires authentication!');
        console.log('💡 Available localStorage keys:', Object.keys(localStorage));
      }
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response received from:', response.config.url, '| Status:', response.status);
    return response;
  },
  (error) => {
    const requestUrl = error.config?.url || '';
    console.log('Interceptor triggered for URL:', requestUrl, 'Status:', error.response?.status);

    // Handle 429 Too Many Requests with automatic one-time retry
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.['retry-after'];
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;

      console.warn(`⏳ Rate limited. Retrying in ${waitMs}ms:`, requestUrl);

      const retryConfig = error.config || {};
      if (!(retryConfig as any)._retried429) {
        (retryConfig as any)._retried429 = true;
        return new Promise((resolve) => setTimeout(resolve, waitMs))
          .then(() => api.request(retryConfig));
      }

      console.error('❌ 429 retry exhausted for:', requestUrl);
    }

    if (error.response?.status === 401) {
      console.error('⛔ 401 Unauthorized from backend - token invalid or expired');
      const currentToken = localStorage.getItem('authToken');
      console.log('Current token exists:', !!currentToken);

      // CRITICAL: Only clear the token when the session-validation endpoint itself
      // returns 401 (the token is definitively invalid/expired).
      // Do NOT clear on admin-route 401s — that would cascade: a single failing
      // request wipes the token and every subsequent request (analytics, orders, etc.)
      // is then rejected with "Not authorized to access this route. Please login."
      const isSessionValidationRequest = requestUrl.includes('/users/profile')
        || requestUrl.includes('/auth/validate')
        || requestUrl.includes('/auth/me');

      if (currentToken && isSessionValidationRequest) {
        console.log('🗑️ Token rejected on profile validation — clearing session');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        // Dispatch custom event so AuthContext can react
        window.dispatchEvent(new CustomEvent('auth-error', { detail: { status: 401 } }));
      } else if (currentToken) {
        // Protected-route 401: token may be expired — log clearly but do NOT wipe it.
        // validateSession (on next page load) will clean it up properly.
        console.warn('⚠️ 401 on protected route:', requestUrl, '— re-login may be needed');
      }
    } else if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data?.message || error.message);
    } else if (error.request) {
      console.error('❌ Network Error - No response received. Backend may not be running.');
    } else {
      console.error('❌ Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// LocalStorage-based auth fallback (when backend is not available)
const localAuthAPI = {
  register: async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    // Get existing users
    const usersData = localStorage.getItem('registeredUsers');
    const users = usersData ? JSON.parse(usersData) : [];
    
    // Check if email already exists
    const existingUserByEmail = users.find((u: any) => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existingUserByEmail) {
      return {
        success: false,
        message: 'This email is already registered. Please log in instead.',
        user: null,
        token: null
      };
    }
    
    // Check if phone already exists (if provided)
    if (userData.phone) {
      const existingUserByPhone = users.find((u: any) => u.phone === userData.phone);
      if (existingUserByPhone) {
        return {
          success: false,
          message: 'This phone number is already registered. Please log in instead.',
          user: null,
          token: null
        };
      }
    }
    
    // Create new user
    const newUser = {
      id: Date.now().toString(),
      name: userData.name,
      email: userData.email,
      phone: userData.phone || '',
      password: userData.password, // In production, this should be hashed
      createdAt: new Date().toISOString(),
      role: 'customer'
    };
    
    // Add to users array
    users.push(newUser);
    localStorage.setItem('registeredUsers', JSON.stringify(users));
    
    // Generate token (simple timestamp-based)
    const token = `token_${newUser.id}_${Date.now()}`;
    
    // Save auth data
    localStorage.setItem('authToken', token);
    const userForStorage: any = { ...newUser };
    delete userForStorage.password; // Don't store password in user object
    localStorage.setItem('user', JSON.stringify(userForStorage));
    
    console.log('✅ User registered successfully:', newUser.email);
    
    return {
      success: true,
      user: userForStorage,
      token: token,
      message: 'Registration successful'
    };
  },

  login: async (credentials: { email: string; password: string }) => {
    // Get existing users
    const usersData = localStorage.getItem('registeredUsers');
    const users = usersData ? JSON.parse(usersData) : [];
    
    // Find user by email
    const user = users.find((u: any) => 
      u.email.toLowerCase() === credentials.email.toLowerCase()
    );
    
    if (!user) {
      return {
        success: false,
        message: 'No account found with this email. Please sign up first.',
        user: null,
        token: null
      };
    }
    
    // Check password
    if (user.password !== credentials.password) {
      return {
        success: false,
        message: 'Invalid password. Please try again.',
        user: null,
        token: null
      };
    }
    
    // Generate token
    const token = `token_${user.id}_${Date.now()}`;
    
    // Save auth data
    localStorage.setItem('authToken', token);
    const userForStorage: any = { ...user };
    delete userForStorage.password; // Don't store password in user object
    localStorage.setItem('user', JSON.stringify(userForStorage));
    
    console.log('✅ User logged in successfully:', user.email);
    
    return {
      success: true,
      user: userForStorage,
      token: token,
      message: 'Login successful'
    };
  },

  forgotPassword: async (email: string) => {
    // Get existing users
    const usersData = localStorage.getItem('registeredUsers');
    const users = usersData ? JSON.parse(usersData) : [];
    
    // Find user by email
    const user = users.find((u: any) => 
      u.email.toLowerCase() === email.toLowerCase()
    );
    
    if (!user) {
      return {
        success: false,
        message: 'No account found with this email.',
        status: 'error'
      };
    }
    
    // In production, this would send an email with reset link
    // For now, we'll just store a reset token
    const resetToken = `reset_${user.id}_${Date.now()}`;
    localStorage.setItem(`passwordResetToken_${user.email}`, resetToken);
    
    console.log('✅ Password reset initiated for:', user.email);
    console.log('🔑 Reset token (for demo):', resetToken);
    
    return {
      success: true,
      message: 'Password reset link sent to your email. (In demo mode, check console for token)',
      status: 'success'
    };
  },

  resetPassword: async (token: string, password: string) => {
    // Find user by reset token
    const usersData = localStorage.getItem('registeredUsers');
    const users = usersData ? JSON.parse(usersData) : [];
    
    // Extract email from token storage
    let userEmail = '';
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('passwordResetToken_')) {
        const storedToken = localStorage.getItem(key);
        if (storedToken === token) {
          userEmail = key.replace('passwordResetToken_', '');
          break;
        }
      }
    }
    
    if (!userEmail) {
      return {
        success: false,
        message: 'Invalid or expired reset token.',
        token: null,
        status: 'error'
      };
    }
    
    // Find and update user
    const userIndex = users.findIndex((u: any) => 
      u.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (userIndex === -1) {
      return {
        success: false,
        message: 'User not found.',
        token: null,
        status: 'error'
      };
    }
    
    // Update password
    users[userIndex].password = password;
    localStorage.setItem('registeredUsers', JSON.stringify(users));
    
    // Clear reset token
    localStorage.removeItem(`passwordResetToken_${userEmail}`);
    
    // Generate new auth token
    const newToken = `token_${users[userIndex].id}_${Date.now()}`;
    
    console.log('✅ Password reset successfully for:', userEmail);
    
    return {
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
      token: newToken,
      status: 'success'
    };
  }
};

// Auth APIs - Try backend first, fallback to localStorage
export const authAPI = {
  register: async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    try {
      const response = await api.post('/auth/register', userData);
      const data = response.data;
      
      // Backend returns { status: 'success', token, user }
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('✅ Registration successful with backend token');
      }
      
      return {
        success: data.status === 'success',
        user: data.user,
        token: data.token,
        message: data.message
      };
    } catch (error: any) {
      // CRITICAL FIX: Do NOT use localStorage fallback - it creates fake tokens!
      console.error('❌ Backend registration failed:', error.response?.data?.message || error.message);
      
      // Return the actual error from backend if available
      if (error.response?.data) {
        return {
          success: false,
          user: null,
          token: null,
          message: error.response.data.message || 'Registration failed. Please try again.'
        };
      }
      
      // Network error - backend not running
      return {
        success: false,
        user: null,
        token: null,
        message: 'Cannot connect to server. Please try again later'
      };
    }
  },

  login: async (credentials: { email: string; password: string }) => {
    try {
      const response = await api.post('/auth/login', credentials);
      const data = response.data;
      
      // Backend returns { status: 'success', token, user }
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('✅ Login successful with backend token');
      }
      
      return {
        success: data.status === 'success',
        user: data.user,
        token: data.token,
        message: data.message
      };
    } catch (error: any) {
      // CRITICAL FIX: Do NOT use localStorage fallback - it creates fake tokens!
      // The backend MUST be running for authentication to work properly.
      console.error('❌ Backend login failed:', error.response?.data?.message || error.message);
      
      // Return the actual error from backend if available
      if (error.response?.data) {
        return {
          success: false,
          user: null,
          token: null,
          message: error.response.data.message || 'Login failed. Please check your credentials.'
        };
      }
      
      // Network error / CORS / unreachable backend
      return {
        success: false,
        user: null,
        token: null,
        message: 'Cannot connect to server. Please try again in a moment.'
      };
    }
  },

  logout: () => {
    // SECURITY: Clear ALL authentication and user data
    const userId = authAPI.getCurrentUser()?.id;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    localStorage.removeItem('recentlyViewed');
    localStorage.removeItem('savedAddresses');
    
    // Clear user-specific wishlist
    if (userId) {
      localStorage.removeItem(`fashionWishlist_${userId}`);
      localStorage.removeItem(`fashionOrders_${userId}`);
      console.log(`🗑️ Cleared wishlist and orders for user ${userId}`);
    }
    
    // Also clear guest/global keys as fallback
    localStorage.removeItem('fashionWishlist');
    localStorage.removeItem('fashionWishlist_guest');
    localStorage.removeItem('fashionOrders');
    
    console.log('🔒 All user data cleared from localStorage');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  // SECURITY: Validate token with backend
  validateToken: async () => {
    try {
      const response = await api.get('/users/profile');
      // Backend returns: { status: 'success', data: { user: {...} } }
      const user = response.data.data?.user || response.data.user;
      
      if (user) {
        console.log('✅ Token validated successfully for user:', user.email);
        return {
          success: true,
          user: user
        };
      } else {
        console.error('❌ No user data in response');
        return {
          success: false,
          user: null
        };
      }
    } catch (error: any) {
      console.error('❌ Token validation failed:', error.response?.status, error.response?.data?.message);
      return {
        success: false,
        user: null
      };
    }
  },

  forgotPassword: async (email: string) => {
    try {
      const response = await api.post('/auth/forgotpassword', { email });
      return {
        success: response.data.status === 'success',
        message: response.data.message,
        status: response.data.status
      };
    } catch (error: any) {
      console.log('⚠️ Backend not available, using localStorage auth');
      return localAuthAPI.forgotPassword(email);
    }
  },

  resetPassword: async (token: string, password: string) => {
    try {
      const response = await api.put(`/auth/resetpassword/${token}`, { password });
      return {
        success: response.data.status === 'success',
        message: response.data.message,
        token: response.data.token,
        status: response.data.status
      };
    } catch (error: any) {
      console.log('⚠️ Backend not available, using localStorage auth');
      return localAuthAPI.resetPassword(token, password);
    }
  },

  validateResetToken: async (token: string) => {
    try {
      const response = await api.get(`/auth/validate-reset-token/${token}`);
      return {
        success: response.data.status === 'success',
        email: response.data.email,
        message: response.data.message
      };
    } catch (error: any) {
      // Fallback to localStorage validation
      console.log('⚠️ Backend not available, using localStorage auth');
      
      // Check if token exists in localStorage
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('passwordResetToken_')) {
          const storedToken = localStorage.getItem(key);
          if (storedToken === token) {
            const email = key.replace('passwordResetToken_', '');
            return {
              success: true,
              email: email,
              message: 'Token is valid'
            };
          }
        }
      }
      
      return {
        success: false,
        email: '',
        message: 'Invalid or expired token'
      };
    }
  },
};

// Product APIs
export const productAPI = {
  getAll: async (params?: { category?: string; search?: string; sortBy?: string }) => {
    const response = await api.get('/products', { params });
    console.log('📦 Product API Raw Response:', response.data);
    
    // Handle different response structures
    // Backend may return: { status: 'success', data: [...] } or { data: [...] } or [...]
    if (Array.isArray(response.data)) {
      return { data: response.data };
    }
    return { data: response.data.data || [] };
  },

  search: async (query: string, filters?: { 
    category?: string; 
    minPrice?: number; 
    maxPrice?: number; 
    inStock?: boolean;
    sortBy?: string;
  }) => {
    const params = {
      q: query,
      ...filters
    };
    const response = await api.get('/products/search', { params });
    console.log('🔍 Search API Response:', response.data);
    
    if (Array.isArray(response.data)) {
      return { data: response.data };
    }
    return { data: response.data.data || [] };
  },

  getById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return { data: response.data.data || response.data };
  },

  create: async (productData: any) => {
    const response = await api.post('/products', productData);
    return { data: response.data.data || response.data };
  },

  update: async (id: string, productData: any) => {
    const response = await api.put(`/products/${id}`, productData);
    return { data: response.data.data || response.data };
  },

  delete: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return { data: response.data.data || response.data };
  },

  updateStock: async (id: string, quantity: number) => {
    const response = await api.patch(`/products/${id}/stock`, { quantity });
    return { data: response.data.data || response.data };
  },

  // Variant management
  getVariants: async (id: string) => {
    const response = await api.get(`/products/${id}/variants`);
    return { data: response.data.data || response.data };
  },

  addSingleVariant: async (id: string, variantData: { size: string; color?: string; material?: string; sku?: string; stock?: number }) => {
    const response = await api.post(`/products/${id}/single-variant`, variantData);
    return { data: response.data.data || response.data };
  },

  autoGenerateVariants: async (id: string, params: { sizes: string[]; colors?: string[]; materials?: string[]; defaultStock?: number }) => {
    const response = await api.post(`/products/${id}/auto-variants`, params);
    return { data: response.data.data || response.data };
  },

  updateVariantStock: async (id: string, variants: { size: string; stock: number }[]) => {
    const response = await api.put(`/products/${id}/variants/stock`, { variants });
    return { data: response.data.data || response.data };
  },

  bulkUpdateVariants: async (id: string, variants: Array<{ id: string; size?: string; color?: string | null; material?: string | null; sku?: string; stock?: number; is_active?: boolean }>) => {
    const response = await api.put(`/products/${id}/variants/bulk`, { variants });
    return { data: response.data.data || response.data };
  },

  deleteVariant: async (productId: string, variantId: string) => {
    const response = await api.delete(`/products/${productId}/variants/${variantId}`);
    return { data: response.data.data || response.data };
  },
};

// Order APIs
export const orderAPI = {
  create: async (orderData: {
    orderItems: any[];
    shippingAddress: any;
    paymentMethod: string;
    totalPrice: number;
  }) => {
    const response = await api.post('/orders', orderData, { timeout: 120000 });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  trackByOrderId: async (orderId: string) => {
    const response = await api.get(`/orders/track/${orderId}`);
    return response.data;
  },

  getMyOrders: async () => {
    const response = await api.get('/orders/myorders');
    return response.data;
  },

  getAllOrders: async () => {
    const response = await api.get('/orders');
    return response.data;
  },

  updateStatus: async (id: string, orderStatus: string, note?: string, trackingNumber?: string, estimatedDeliveryDate?: string) => {
    const response = await api.put(`/orders/${id}/status`, { 
      orderStatus, 
      note,
      trackingNumber,
      estimatedDeliveryDate
    });
    return response.data;
  },

  updateTracking: async (id: string, trackingNumber: string, carrier: string) => {
    const response = await api.patch(`/orders/${id}/tracking`, {
      trackingNumber,
      carrier,
    });
    return response.data;
  },

  // Return & Exchange APIs
  requestReturn: async (orderId: string, returnData: {
    reasons: string[];
    otherReason?: string;
    refundMethod: string;
    refundDetails?: any;
    selectedItems?: string[];
    itemsToReturn?: Array<{
      order_item_id?: string;
      product_id?: string;
      product_name: string;
      quantity: number;
      price: number;
    }>;
    refundAmount?: number;
    pickupScheduledDate?: string;
    pickupTimeSlot?: string;
    productConditionPhotos?: string[];
    customerConfirmation?: boolean;
    priorityFlag?: boolean;
    disputeFlag?: boolean;
  }) => {
    const response = await api.post(`/orders/${orderId}/return`, returnData);
    return response.data;
  },

  requestExchange: async (orderId: string, exchangeData: {
    itemId: string;
    newSize?: string;
    newColor?: string;
    reason?: string;
  }) => {
    const response = await api.post(`/orders/${orderId}/exchange`, exchangeData);
    return response.data;
  },

  getOrderTimeline: async (orderId: string) => {
    const response = await api.get(`/orders/${orderId}/timeline`);
    return response.data;
  },
};

// User APIs
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (userData: any) => {
    const response = await api.put('/users/profile', userData);
    return response.data;
  },

  addAddress: async (address: any) => {
    const response = await api.post('/users/addresses', address);
    return response.data;
  },

  getAddresses: async () => {
    const response = await api.get('/users/addresses');
    return response.data;
  },

  updateAddress: async (id: string, address: any) => {
    const response = await api.put(`/users/addresses/${id}`, address);
    return response.data;
  },

  deleteAddress: async (id: string) => {
    const response = await api.delete(`/users/addresses/${id}`);
    return response.data;
  },

  addToWishlist: async (productId: string) => {
    const response = await api.post('/users/wishlist', { productId });
    return response.data;
  },

  getWishlist: async () => {
    const response = await api.get('/users/wishlist');
    return response.data;
  },

  removeFromWishlist: async (productId: string) => {
    const response = await api.delete(`/users/wishlist/${productId}`);
    return response.data;
  },
};

// Upload APIs
export const uploadAPI = {
  uploadImage: async (file: File, folder: string = 'products') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);

    const response = await api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteImage: async (publicId: string) => {
    const response = await api.delete('/upload/image', {
      data: { publicId },
    });
    return response.data;
  },
};

// Review APIs
export const reviewAPI = {
  create: async (productId: string, reviewData: {
    rating: number;
    comment: string;
  }) => {
    const response = await api.post(`/products/${productId}/reviews`, reviewData);
    return response.data;
  },

  getProductReviews: async (productId: string) => {
    const response = await api.get(`/products/${productId}/reviews`);
    return response.data;
  },

  update: async (reviewId: string, reviewData: {
    rating: number;
    comment: string;
  }) => {
    const response = await api.put(`/reviews/${reviewId}`, reviewData);
    return response.data;
  },

  delete: async (reviewId: string) => {
    const response = await api.delete(`/reviews/${reviewId}`);
    return response.data;
  },
};

// Analytics APIs (Admin only)
export const analyticsAPI = {
  getDashboardStats: async () => {
    const response = await api.get('/analytics/dashboard');
    return response.data;
  },

  getSalesReport: async (startDate: string, endDate: string) => {
    const response = await api.get('/analytics/sales', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getTopProducts: async (limit: number = 10) => {
    const response = await api.get('/analytics/top-products', {
      params: { limit },
    });
    return response.data;
  },

  getCustomerInsights: async () => {
    const response = await api.get('/analytics/customers');
    return response.data;
  },
};

// Wishlist APIs
export const wishlistAPI = {
  get: async () => {
    try {
      const response = await api.get('/wishlist');
      return { data: response.data.data || [] };
    } catch (error: any) {
      console.error('Get wishlist error:', error);
      throw error;
    }
  },

  add: async (productId: number) => {
    try {
      const response = await api.post(`/wishlist/${productId}`);
      return { data: response.data };
    } catch (error: any) {
      console.error('Add to wishlist error:', error);
      throw error;
    }
  },

  remove: async (productId: number) => {
    try {
      const response = await api.delete(`/wishlist/${productId}`);
      return { data: response.data };
    } catch (error: any) {
      console.error('Remove from wishlist error:', error);
      throw error;
    }
  },

  clear: async () => {
    try {
      const response = await api.delete('/wishlist');
      return { data: response.data };
    } catch (error: any) {
      console.error('Clear wishlist error:', error);
      throw error;
    }
  },
};

// Admin APIs - for dashboard data retrieval
export const adminAPI = {
  // Get all orders for admin dashboard
  getAllOrders: async (filters?: { status?: string; page?: number; limit?: number }) => {
    try {
      console.log('🔄 [AdminAPI] Fetching all orders from /api/admin/orders');
      const response = await api.get('/admin/orders', { params: filters });
      console.log('✅ [AdminAPI] Orders fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error fetching orders:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update order status
  updateOrderStatus: async (orderId: string, status: string, note?: string) => {
    try {
      // Get token to verify it exists
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
      
      if (!token) {
        console.error('❌ [AdminAPI] No auth token found! Cannot update order status.');
        console.log('📋 Available localStorage keys:', Object.keys(localStorage));
        throw new Error('Authentication required. Please log in again.');
      }
      
      console.log('🔄 [AdminAPI] Updating order status:', orderId, 'to', status);
      console.log('🔑 [AdminAPI] Token found, length:', token.length);
      
      // Use /api/orders/:id/status endpoint (protected route for admin)
      const response = await api.put(`/orders/${orderId}/status`, { orderStatus: status, note });
      console.log('✅ [AdminAPI] Order updated:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error updating order:', error.response?.data || error.message);
      console.error('Order ID:', orderId, 'Status:', status);
      
      if (error.response?.status === 401) {
        throw new Error('Not authorized to update orders. Please log in as admin.');
      }
      if (error.response?.status === 404) {
        throw new Error(`Order ${orderId} not found. Please refresh the orders list.`);
      }
      throw error;
    }
  },

  // Approve return request
  approveReturn: async (orderId: string, refundAmount: number, refundNotes?: string, refundDetails?: any) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
      
      if (!token) {
        console.error('❌ [AdminAPI] No auth token found! Cannot approve return.');
        throw new Error('Authentication required. Please log in again.');
      }
      
      console.log('🔄 [AdminAPI] Approving return for order:', orderId);
      console.log('💰 Refund amount:', refundAmount);
      console.log('💳 Refund details:', refundDetails);
      
      const response = await api.put(`/orders/${orderId}/return/approve`, {
        refundAmount,
        refundNotes: refundNotes || 'Return approved by admin',
        ...(refundDetails && {
          refundPaymentMode: refundDetails.refundPaymentMode,
          refundBankName: refundDetails.refundBankName,
          refundAccountNumber: refundDetails.refundAccountNumber,
          refundIfscCode: refundDetails.refundIfscCode,
          refundUpiId: refundDetails.refundUpiId,
          refundTransactionId: refundDetails.refundTransactionId,
          refundTransactionDate: refundDetails.refundTransactionDate
        })
      });
      
      console.log('✅ [AdminAPI] Return approved:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error approving return:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Not authorized. Please log in as admin.');
      }
      if (error.response?.status === 404) {
        throw new Error(`Order ${orderId} not found.`);
      }
      throw error;
    }
  },

  // Reject return request
  rejectReturn: async (orderId: string, rejectionReason?: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
      
      if (!token) {
        console.error('❌ [AdminAPI] No auth token found! Cannot reject return.');
        throw new Error('Authentication required. Please log in again.');
      }
      
      console.log('🔄 [AdminAPI] Rejecting return for order:', orderId);
      console.log('📝 Rejection reason:', rejectionReason);
      
      const response = await api.put(`/orders/${orderId}/return/reject`, {
        rejectionReason: rejectionReason || 'Return request rejected'
      });
      
      console.log('✅ [AdminAPI] Return rejected:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error rejecting return:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Not authorized. Please log in as admin.');
      }
      if (error.response?.status === 404) {
        throw new Error(`Order ${orderId} not found.`);
      }
      throw error;
    }
  },

  // Approve exchange request
  approveExchange: async (orderId: string, notes?: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
      if (!token) throw new Error('Authentication required. Please log in again.');
      const response = await api.put(`/orders/${orderId}/exchange/approve`, { notes: notes || '' });
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error approving exchange:', error.response?.data || error.message);
      if (error.response?.status === 401) throw new Error('Not authorized. Please log in as admin.');
      if (error.response?.status === 404) throw new Error(`Order ${orderId} not found.`);
      throw error;
    }
  },

  // Reject exchange request
  rejectExchange: async (orderId: string, rejectionReason?: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
      if (!token) throw new Error('Authentication required. Please log in again.');
      const response = await api.put(`/orders/${orderId}/exchange/reject`, {
        rejectionReason: rejectionReason || 'Exchange request rejected'
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error rejecting exchange:', error.response?.data || error.message);
      if (error.response?.status === 401) throw new Error('Not authorized. Please log in as admin.');
      if (error.response?.status === 404) throw new Error(`Order ${orderId} not found.`);
      throw error;
    }
  },

  // Get all users for admin dashboard
  getAllUsers: async (filters?: { role?: string; page?: number; limit?: number }) => {
    try {
      console.log('🔄 [AdminAPI] Fetching all users from /api/admin/users');
      const response = await api.get('/admin/users', { params: filters });
      console.log('✅ [AdminAPI] Users fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error fetching users:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get dashboard analytics
  getDashboardAnalytics: async (dateRange?: { startDate?: string; endDate?: string }) => {
    try {
      console.log('🔄 [AdminAPI] Fetching dashboard analytics from /api/admin/dashboard');
      const response = await api.get('/admin/dashboard', { params: dateRange });
      console.log('✅ [AdminAPI] Dashboard analytics fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error fetching dashboard analytics:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get detailed analytics
  getAnalytics: async (type: 'overview' | 'sales' | 'users' | 'products' | 'revenue', params?: any) => {
    try {
      console.log(`🔄 [AdminAPI] Fetching ${type} analytics`);
      const response = await api.get(`/admin/analytics/${type}`, { params });
      console.log(`✅ [AdminAPI] ${type} analytics fetched:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [AdminAPI] Error fetching ${type} analytics:`, error.response?.data || error.message);
      throw error;
    }
  },

  // Delete completed order (delivered orders only)
  deleteCompletedOrder: async (orderId: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken');
      if (!token) {
        console.error('❌ [AdminAPI] No auth token found! Cannot delete order.');
        throw new Error('Authentication required');
      }

      console.log('🔄 [AdminAPI] Deleting completed order:', orderId);
      const response = await api.delete(`/admin/orders/${orderId}/complete`);
      console.log('✅ [AdminAPI] Order deleted:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error deleting order:', error.response?.data || error.message);
      throw error;
    }
  },

  // Delete user account
  deleteUser: async (userId: string) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken');
      if (!token) {
        console.error('❌ [AdminAPI] No auth token found! Cannot delete user.');
        throw new Error('Authentication required');
      }

      console.log('🔄 [AdminAPI] Deleting user:', userId);
      const response = await api.delete(`/admin/users/${userId}`);
      console.log('✅ [AdminAPI] User deleted:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error deleting user:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get archived orders
  getArchivedOrders: async () => {
    try {
      console.log('🔄 [AdminAPI] Fetching archived orders from /api/admin/orders/archived');
      const response = await api.get('/admin/orders/archived');
      console.log('✅ [AdminAPI] Archived orders fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error fetching archived orders:', error.response?.data || error.message);
      throw error;
    }
  },

  // Archive a single order
  archiveOrder: async (orderId: string) => {
    try {
      console.log('🔄 [AdminAPI] Archiving order:', orderId);
      const response = await api.patch(`/admin/orders/${orderId}/archive`);
      console.log('✅ [AdminAPI] Order archived:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error archiving order:', error.response?.data || error.message);
      throw error;
    }
  },

  // Unarchive a single order (restore to active orders)
  unarchiveOrder: async (orderId: string) => {
    try {
      console.log('🔄 [AdminAPI] Unarchiving order:', orderId);
      const response = await api.patch(`/admin/orders/${orderId}/unarchive`);
      console.log('✅ [AdminAPI] Order unarchived:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error unarchiving order:', error.response?.data || error.message);
      throw error;
    }
  },

  // Archive all delivered orders that are 7+ days old
  archiveOldOrders: async () => {
    try {
      console.log('🔄 [AdminAPI] Archiving old delivered orders (7+ days)...');
      const response = await api.post('/admin/orders/archive-old');
      console.log('✅ [AdminAPI] Old orders archived:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [AdminAPI] Error archiving old orders:', error.response?.data || error.message);
      throw error;
    }
  },

  getAdminNotifications: async () => {
    const response = await api.get('/admin/notifications');
    return response.data;
  },

  markNotificationRead: async (notificationId: string) => {
    const response = await api.put(`/admin/notifications/${notificationId}/read`);
    return response.data;
  },
};

// Cart APIs (Server-side cart)
export const cartAPI = {
  get: async () => {
    const response = await api.get('/cart');
    return response.data;
  },

  add: async (productId: string, quantity: number, size?: string, color?: string) => {
    const response = await api.post('/cart/add', {
      productId,
      quantity,
      size,
      color,
    });
    return response.data;
  },

  update: async (itemId: string, quantity: number) => {
    const response = await api.put(`/cart/${itemId}`, { quantity });
    return response.data;
  },

  remove: async (itemId: string) => {
    const response = await api.delete(`/cart/${itemId}`);
    return response.data;
  },

  clear: async () => {
    const response = await api.delete('/cart');
    return response.data;
  },

  syncLocalCart: async (items: any[]) => {
    const response = await api.post('/cart/sync', { items });
    return response.data;
  },

  mergeGuestCart: async (items: any[]) => {
    const response = await api.post('/cart/merge', { items });
    return response.data;
  },
};

// Returns/Exchange APIs
export const returnsAPI = {
  // Get all returns (Admin only)
  getAllReturns: async (filters?: { status?: string; returnType?: string }) => {
    try {
      console.log('🔄 [ReturnsAPI] Fetching all returns from /api/returns');
      const response = await api.get('/returns', { params: filters });
      console.log('✅ [ReturnsAPI] Returns fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [ReturnsAPI] Error fetching returns:', error.response?.data || error.message);
      throw error;
    }
  },

  // Update return status (Admin only)
  updateReturnStatus: async (returnId: string, status: string, notes?: string) => {
    try {
      console.log(`🔄 [ReturnsAPI] Updating return ${returnId} status to ${status}`);
      const response = await api.put(`/returns/${returnId}/status`, { status, adminNotes: notes });
      console.log('✅ [ReturnsAPI] Return status updated:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [ReturnsAPI] Error updating return status:', error.response?.data || error.message);
      throw error;
    }
  },

  // Process refund (Admin only)
  processRefund: async (returnId: string, refundData: any) => {
    try {
      console.log(`🔄 [ReturnsAPI] Processing refund for return ${returnId}`);
      const response = await api.post(`/returns/${returnId}/refund`, refundData);
      console.log('✅ [ReturnsAPI] Refund processed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [ReturnsAPI] Error processing refund:', error.response?.data || error.message);
      throw error;
    }
  },

  processReturnRefund: async (returnId: string, refundData: any) => {
    try {
      console.log('[ReturnsAPI] Processing refund for return', returnId);
      const response = await api.post(`/returns/${returnId}/process-refund`, refundData);
      console.log('[ReturnsAPI] Refund processed:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[ReturnsAPI] Error processing refund:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get returns statistics (Admin only)
  getStatistics: async () => {
    try {
      console.log('🔄 [ReturnsAPI] Fetching returns statistics');
      const response = await api.get('/returns/stats');
      console.log('✅ [ReturnsAPI] Statistics fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ [ReturnsAPI] Error fetching statistics:', error.response?.data || error.message);
      throw error;
    }
  },
};

export default api;
