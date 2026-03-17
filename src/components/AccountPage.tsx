import { ChevronLeft, User, Package, CreditCard, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface AccountPageProps {
  onNavigateHome: () => void;
  onNavigateToOrders: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings: () => void;
}

export function AccountPage({ 
  onNavigateHome, 
  onNavigateToOrders,
  onNavigateToProfile,
  onNavigateToSettings,
}: AccountPageProps) {
  const { user } = useAuth();
  const [orderCount, setOrderCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderStats = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Try to fetch from backend first
        const response = await axios.get(`/api/orders/user/${user.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.data.success && response.data.data) {
          const orders = response.data.data;
          setOrderCount(orders.length);
          const total = orders.reduce((sum: number, order: any) => sum + (parseFloat(order.total) || 0), 0);
          setTotalSpent(total);
          console.log('✅ Order stats loaded from backend:', { count: orders.length, total });
        }
      } catch (error) {
        console.log('⚠️ Backend not available, loading from localStorage');
        
        // Fallback to localStorage
        const orderKey = `fashionOrders_${user.id}`;
        const savedOrders = localStorage.getItem(orderKey);
        
        if (savedOrders) {
          try {
            const orders = JSON.parse(savedOrders);
            setOrderCount(orders.length);
            const total = orders.reduce((sum: number, order: any) => sum + (parseFloat(order.total) || 0), 0);
            setTotalSpent(total);
            console.log('✅ Order stats loaded from localStorage:', { count: orders.length, total });
          } catch (e) {
            console.error('Failed to parse orders from localStorage');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrderStats();
  }, [user?.id]);
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>
          
          <h1 className="text-5xl tracking-wider mb-2">MY ACCOUNT</h1>
          <p className="text-neutral-600">Manage your account and preferences</p>
          
          {/* Order Stats */}
          {!loading && user && (
            <div className="flex gap-6 mt-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-neutral-600" />
                <span className="text-lg font-medium">{orderCount}</span>
                <span className="text-neutral-600">{orderCount === 1 ? 'Order' : 'Orders'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-neutral-600" />
                <span className="text-lg font-medium">₹{totalSpent.toFixed(2)}</span>
                <span className="text-neutral-600">Spent</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <button
            onClick={onNavigateToProfile}
            className="p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <User className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl tracking-wider mb-2">Profile</h2>
            <p className="text-neutral-600">
              Manage your personal information and preferences
            </p>
          </button>

          {/* Orders Card */}
          <button
            onClick={onNavigateToOrders}
            className="p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl tracking-wider mb-2">Orders</h2>
            <p className="text-neutral-600">
              Track your orders and view order history
            </p>
          </button>

          {/* Payment Methods Card */}
          <button
            className="p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl tracking-wider mb-2">Payment Methods</h2>
            <p className="text-neutral-600">
              Manage your saved payment methods
            </p>
          </button>

          {/* Settings Card */}
          <button
            onClick={onNavigateToSettings}
            className="p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl tracking-wider mb-2">Settings</h2>
            <p className="text-neutral-600">
              Update your account settings and preferences
            </p>
          </button>

          {/* Address Book Card */}
          <button
            className="p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl tracking-wider mb-2">Address Book</h2>
            <p className="text-neutral-600">
              Manage your saved delivery addresses
            </p>
          </button>

          {/* Help & Support Card */}
          <button
            className="p-8 border-2 border-neutral-300 rounded-lg hover:border-black hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl tracking-wider mb-2">Help & Support</h2>
            <p className="text-neutral-600">
              Get help with orders, returns, and more
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
