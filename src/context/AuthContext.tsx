import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (fullName: string, email: string, phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // Listen for auth errors from API interceptor
  useEffect(() => {
    const handleAuthError = (event: CustomEvent) => {
      console.log('🔒 Auth error detected - logging out user');
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener('auth-error', handleAuthError as EventListener);
    return () => {
      window.removeEventListener('auth-error', handleAuthError as EventListener);
    };
  }, []);

  // SECURITY FIX: Validate token with backend on mount
  useEffect(() => {
    const validateSession = async () => {
      const storedUser = authAPI.getCurrentUser();
      const storedToken = localStorage.getItem('authToken');
      
      // If no stored user or token, user is definitely not authenticated
      if (!storedUser || !storedToken) {
        console.log('🔓 No stored session found - user is logged out');
        setUser(null);
        setIsAuthenticated(false);
        setIsValidating(false);
        return;
      }

      try {
        // Validate the token by making a request to get current user profile
        console.log('🔍 Validating stored token with backend...');
        const response = await authAPI.validateToken();
        
        if (response.success && response.user) {
          console.log('✅ Token is valid - user authenticated:', response.user.email);
          setUser(response.user);
          setIsAuthenticated(true);
          // Update localStorage with fresh user data
          localStorage.setItem('user', JSON.stringify(response.user));
        } else {
          console.log('❌ Token validation failed - clearing session');
          // Token is invalid - clear everything
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error: any) {
        console.error('❌ Token validation error - clearing session:', error.message);
        // Token is invalid or expired - clear everything  
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
  }, []);

  const signup = async (fullName: string, email: string, phone: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authAPI.register({
        name: fullName,
        email,
        phone,
        password,
      });

      if (response.success && response.user) {
        // Update state immediately
        setUser(response.user);
        setIsAuthenticated(true);
        
        // Force a re-render by updating localStorage
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('authToken', response.token || '');
        
        return { success: true };
      }

      return { success: false, error: response.message || 'Registration failed' };
    } catch (error: any) {
      console.error('Signup error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to create account. Please try again.' 
      };
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // CRITICAL: Save guest cart AND guest wishlist BEFORE clearing localStorage
      const guestCart = localStorage.getItem('guest_cart');
      console.log('💾 Preserving guest cart before login:', guestCart ? JSON.parse(guestCart).length + ' items' : '0 items');
      // Save guest wishlist BEFORE the cleanup loop deletes fashionWishlist_guest
      const guestWishlistRaw = localStorage.getItem('fashionWishlist_guest');
      
      const response = await authAPI.login({ email, password });

      if (response.success && response.user) {
        // SECURITY: Clear ALL other users' data before setting new user
        console.log('🧹 Clearing all localStorage data before login...');
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          // Clear all user-specific data that doesn't belong to this user
          if (key.startsWith('fashionOrders_') || key.startsWith('fashionWishlist_')) {
            if (!key.endsWith(`_${response.user.id}`)) {
              localStorage.removeItem(key);
              console.log('🗑️ Removed:', key);
            }
          }
        });
        
        // Also clear any global/mixed keys EXCEPT cart
        localStorage.removeItem('fashionOrders');
        localStorage.removeItem('fashionWishlist');
        // ❌ DON'T remove cart - we need to preserve it!
        // localStorage.removeItem('cart'); // REMOVED - cart must persist
        localStorage.removeItem('recentlyViewed');
        
        // PERSISTENCE FIX: Clear admin mode unless user is an admin
        if (response.user.role !== 'admin') {
          localStorage.removeItem('isAdminMode');
          console.log('🔒 Cleared admin mode (user is not admin)');
        } else {
          console.log('👑 User is admin, admin mode can be activated');
        }
        
        // Restore guest cart after login
        if (guestCart) {
          localStorage.setItem('guest_cart', guestCart);
          console.log('✅ Restored guest cart after login');
        }

        // WISHLIST MIGRATION: Merge guest wishlist items into this user's wishlist
        if (guestWishlistRaw) {
          try {
            const guestItems = JSON.parse(guestWishlistRaw);
            if (Array.isArray(guestItems) && guestItems.length > 0) {
              const userWishlistKey = `fashionWishlist_${response.user.id}`;
              const existingRaw = localStorage.getItem(userWishlistKey);
              const existing = existingRaw ? JSON.parse(existingRaw) : [];
              const existingIds = new Set(existing.map((i: any) => i.id));
              const merged = [...existing, ...guestItems.filter((i: any) => !existingIds.has(i.id))];
              localStorage.setItem(userWishlistKey, JSON.stringify(merged));
              console.log(`💖 Migrated ${guestItems.length} guest wishlist item(s) to user account`);
            }
          } catch (_) { /* ignore parse errors */ }
          localStorage.removeItem('fashionWishlist_guest');
        }
        
        console.log('✅ Cleaned up localStorage for user:', response.user.email);
        
        // Update state immediately
        setUser(response.user);
        setIsAuthenticated(true);
        
        // Store new user data
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('authToken', response.token || '');
        
        return { success: true };
      }

      return { success: false, error: response.message || 'Login failed' };
    } catch (error: any) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Invalid email or password' 
      };
    }
  };

  const logout = () => {
    console.log('🔒 Logging out user...');
    
    // Get userId before clearing to clean up user-specific data
    const userId = user?.id;
    
    // Clear authentication data
    authAPI.logout();
    
    // Reset state
    setUser(null);
    setIsAuthenticated(false);
    
    // Keep guest_cart intact on logout so guest mode can resume its own local cart.
    localStorage.removeItem('fashionCart'); // legacy cleanup
    localStorage.removeItem('cart'); // legacy cleanup
    
    // SECURITY FIX: Clear ALL user-specific data on logout
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('recentlyViewed');
    localStorage.removeItem('savedAddresses');
    
    // PERSISTENCE FIX: Clear admin mode and dashboard state on logout
    localStorage.removeItem('isAdminMode');
    localStorage.removeItem('adminDashboard_activeTab');
    localStorage.removeItem('adminDashboard_activePanel');
    localStorage.removeItem('adminOrders_filters');
    
    // Clear user-specific wishlist and orders
    if (userId) {
      localStorage.removeItem(`fashionWishlist_${userId}`);
      localStorage.removeItem(`fashionOrders_${userId}`);
      console.log(`🗑️ Cleared wishlist and orders for user ${userId}`);
    }
    
    // Also clear guest/global keys as fallback
    localStorage.removeItem('wishlist');
    localStorage.removeItem('fashionWishlist');
    localStorage.removeItem('fashionWishlist_guest');
    localStorage.removeItem('fashionOrders');
    
    console.log('✅ User logged out, ALL session data cleared (cart, admin mode, user data)');
    
    // CRITICAL: Reload page to reset all state
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authAPI.forgotPassword(email);
      if (response.success || response.status === 'success') {
        return { success: true };
      }
      return { success: false, error: response.message || 'Failed to send reset email' };
    } catch (error: any) {
      console.error('Forgot password error:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to send reset email. Please try again.' 
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        signup,
        logout,
        forgotPassword,
      }}
    >
      {isValidating ? (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-sm tracking-wider">VERIFYING SESSION...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
