import { 
  ChevronLeft, User, Package, MapPin, 
  Settings, CreditCard, Heart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

interface MyAccountDashboardProps {
  onNavigateHome: () => void;
  onNavigateToOrders: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings: () => void;
  onNavigateToAddressBook: () => void;
  onNavigateToWishlist: () => void;
}

export function MyAccountDashboard({ 
  onNavigateHome, 
  onNavigateToOrders,
  onNavigateToProfile,
  onNavigateToSettings,
  onNavigateToAddressBook,
  onNavigateToWishlist,
}: MyAccountDashboardProps) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    storeCredit: 0,
    savedAddresses: 0,
    wishlistItems: 0,
  });

  useEffect(() => {
    // Calculate user stats
    if (user?.id) {
      // Fetch orders from API for accurate count
      const fetchOrders = async () => {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch('/api/orders/myorders', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const orders = data.data?.orders || [];
            const totalOrders = orders.length;
            const totalSpent = orders.reduce((sum: number, order: any) => sum + parseFloat(order.total_price || order.total || 0), 0);
            
            // Get other stats
            const userStoreCredit = parseFloat(localStorage.getItem(`storeCredit_${user.id}`) || '0');
            
            // ✅ FIX: Check all possible address storage keys
            let savedAddresses = [];
            const addressKey1 = `savedAddresses_${user.id}`;
            const addressKey2 = `addresses_${user.id}`;
            const addressKey3 = `userAddresses_${user.id}`;
            
            if (localStorage.getItem(addressKey1)) {
              savedAddresses = JSON.parse(localStorage.getItem(addressKey1) || '[]');
            } else if (localStorage.getItem(addressKey2)) {
              savedAddresses = JSON.parse(localStorage.getItem(addressKey2) || '[]');
            } else if (localStorage.getItem(addressKey3)) {
              savedAddresses = JSON.parse(localStorage.getItem(addressKey3) || '[]');
            }
            
            const wishlistKey = `fashionWishlist_${user.id}`;
            const wishlist = JSON.parse(localStorage.getItem(wishlistKey) || '[]');
            
            setStats({
              totalOrders,
              totalSpent,
              storeCredit: userStoreCredit,
              savedAddresses: savedAddresses.length,
              wishlistItems: wishlist.length,
            });
            return;
          }
        } catch (error) {
          console.error('Failed to fetch orders from API:', error);
        }
        
        // Fallback to localStorage if API fails
        const ordersKey = `fashionOrders_${user.id}`;
        const savedOrders = localStorage.getItem(ordersKey);
        const orders = savedOrders ? JSON.parse(savedOrders) : [];
        
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum: number, order: any) => sum + parseFloat(order.total || 0), 0);
      
        // Get store credit
        const userStoreCredit = parseFloat(localStorage.getItem(`storeCredit_${user.id}`) || '0');
        
        // ✅ FIX: Check all possible address storage keys
        let savedAddresses = [];
        const addressKey1 = `savedAddresses_${user.id}`;
        const addressKey2 = `addresses_${user.id}`;
        const addressKey3 = `userAddresses_${user.id}`;
        
        if (localStorage.getItem(addressKey1)) {
          savedAddresses = JSON.parse(localStorage.getItem(addressKey1) || '[]');
        } else if (localStorage.getItem(addressKey2)) {
          savedAddresses = JSON.parse(localStorage.getItem(addressKey2) || '[]');
        } else if (localStorage.getItem(addressKey3)) {
          savedAddresses = JSON.parse(localStorage.getItem(addressKey3) || '[]');
        }
        
        // Get wishlist count
        const wishlistKey = `fashionWishlist_${user.id}`;
        const wishlist = JSON.parse(localStorage.getItem(wishlistKey) || '[]');
        
        setStats({
          totalOrders,
          totalSpent,
          storeCredit: userStoreCredit,
          savedAddresses: savedAddresses.length,
          wishlistItems: wishlist.length,
        });
      };
      
      fetchOrders();
    }
  }, [user]);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm hover:underline mb-4 text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-5xl tracking-wider mb-2">MY ACCOUNT</h1>
              <p className="text-neutral-300">Welcome back, {user?.name || 'Guest'}!</p>
            </div>
            <button
              onClick={logout}
              className="px-4 md:px-6 py-2 md:py-3 border border-white rounded-full text-sm tracking-wider hover:bg-white hover:text-black transition-colors"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 border-b border-neutral-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          <div className="text-center p-3 md:p-4 bg-neutral-50 rounded-lg">
            <Package className="w-6 h-6 md:w-8 md:h-8 text-black mx-auto mb-2" />
            <p className="text-xl md:text-2xl font-bold">{stats.totalOrders}</p>
            <p className="text-xs md:text-sm text-neutral-600">Orders</p>
          </div>
          <div className="text-center p-3 md:p-4 bg-neutral-50 rounded-lg">
            <CreditCard className="w-6 h-6 md:w-8 md:h-8 text-black mx-auto mb-2" />
            <p className="text-xl md:text-2xl font-bold">₹{stats.totalSpent.toFixed(0)}</p>
            <p className="text-xs md:text-sm text-neutral-600">Spent</p>
          </div>
          <div className="text-center p-3 md:p-4 bg-neutral-50 rounded-lg">
            <MapPin className="w-6 h-6 md:w-8 md:h-8 text-black mx-auto mb-2" />
            <p className="text-xl md:text-2xl font-bold">{stats.savedAddresses}</p>
            <p className="text-xs md:text-sm text-neutral-600">Addresses</p>
          </div>
          <div className="text-center p-3 md:p-4 bg-neutral-50 rounded-lg">
            <Heart className="w-6 h-6 md:w-8 md:h-8 text-red-500 mx-auto mb-2" />
            <p className="text-xl md:text-2xl font-bold">{stats.wishlistItems}</p>
            <p className="text-xs md:text-sm text-neutral-600">Wishlist</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <h2 className="text-2xl md:text-3xl tracking-wider mb-6 md:mb-8">QUICK ACTIONS</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Profile Card */}
          <button
            onClick={onNavigateToProfile}
            className="p-6 md:p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <User className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl tracking-wider mb-2">Profile</h3>
            <p className="text-sm md:text-base text-neutral-600">
              Manage your personal information and preferences
            </p>
          </button>

          {/* Orders Card */}
          <button
            onClick={onNavigateToOrders}
            className="p-6 md:p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl tracking-wider mb-2">My Orders</h3>
            <p className="text-sm md:text-base text-neutral-600">
              Track your orders and view order history
            </p>
            {stats.totalOrders > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-xs rounded-full">
                <span>{stats.totalOrders} Active {stats.totalOrders === 1 ? 'Order' : 'Orders'}</span>
              </div>
            )}
          </button>

          {/* Address Book Card */}
          <button
            onClick={onNavigateToAddressBook}
            className="p-6 md:p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl tracking-wider mb-2">Address Book</h3>
            <p className="text-sm md:text-base text-neutral-600">
              Manage your saved delivery addresses
            </p>
            {stats.savedAddresses > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-neutral-100 text-neutral-700 text-xs rounded-full">
                <span>{stats.savedAddresses} Saved {stats.savedAddresses === 1 ? 'Address' : 'Addresses'}</span>
              </div>
            )}
          </button>

          {/* Wishlist Card */}
          <button
            onClick={onNavigateToWishlist}
            className="p-6 md:p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl tracking-wider mb-2">Wishlist</h3>
            <p className="text-sm md:text-base text-neutral-600">
              View and manage your favorite items
            </p>
            {stats.wishlistItems > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 text-xs rounded-full">
                <span>{stats.wishlistItems} {stats.wishlistItems === 1 ? 'Item' : 'Items'}</span>
              </div>
            )}
          </button>

          {/* Settings Card */}
          <button
            onClick={onNavigateToSettings}
            className="p-6 md:p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl tracking-wider mb-2">Settings</h3>
            <p className="text-sm md:text-base text-neutral-600">
              Update your account settings and preferences
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
