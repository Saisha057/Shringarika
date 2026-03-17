"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Upload, Package2, TrendingUp, ShoppingBag, RotateCcw, Users, Layers, FileText, LogOut, AlertTriangle, Trash } from "lucide-react"
import { useAdmin } from "../context/AdminContext"
import { useAuth } from "../context/AuthContext"
import type { Product } from "../data/products"
import { AdminProductForm } from "./AdminProductForm"
import { StockControlPanel } from "./StockControlPanel"
import { AdminAnalytics } from "./AdminAnalytics"
import { BulkProductUpload } from "./BulkProductUpload"
import { LowStockAlerts } from "./LowStockAlerts"
import { ProductVariantsManager } from "./ProductVariantsManager"
import { DynamicPricingManager } from "./DynamicPricingManager"
import { AdminOrdersPanel } from "./AdminOrdersPanel"
import { ReturnsExchangesManager } from "./ReturnsExchangesManager"
import AdminUsersPanel from "./AdminUsersPanel"
import { CollectionsCampaignsManager } from "./CollectionsCampaignsManager"
import { ContentManagementSystem } from "./ContentManagementSystem"
import { NotificationPanel } from "./admin/NotificationPanel"
import { authAPI, productAPI } from "../services/api"

interface AdminDashboardProps {
  onClose: () => void
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const { products, stock, updateProduct, deleteProduct, toggleProductVisibility, markAsNewArrival, markAsFeatured } =
    useAdmin()
  
  // Deletion confirmation state
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [isDeletingProduct, setIsDeletingProduct] = useState(false)
  const { user, isAuthenticated, login, logout } = useAuth()
  
  // PERSISTENCE: Restore last active tab from localStorage
  const getInitialTab = () => {
    const savedTab = localStorage.getItem('adminDashboard_activeTab');
    if (savedTab && ['products', 'stock', 'analytics', 'pricing'].includes(savedTab)) {
      console.log('📋 Restored admin tab from localStorage:', savedTab);
      return savedTab as "products" | "stock" | "analytics" | "pricing" | "orders" | "returns" | "users" | "collections" | "content";
    }
    return "products";
  };
  
  const [activeTab, setActiveTab] = useState<"products" | "stock" | "analytics" | "pricing" | "orders" | "returns" | "users" | "collections" | "content">(getInitialTab())
  const [showProductForm, setShowProductForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showVariantsManager, setShowVariantsManager] = useState(false)
  const [showOrdersDashboard, setShowOrdersDashboard] = useState(false)
  const [showReturnsManager, setShowReturnsManager] = useState(false)
  const [showUsersPanel, setShowUsersPanel] = useState(false)
  const [showCollectionsManager, setShowCollectionsManager] = useState(false)
  const [showCMSPanel, setShowCMSPanel] = useState(false)
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  // Authentication state
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // Database cleanup state
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  
  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    const storedUser = authAPI.getCurrentUser()
    
    if (!token || !storedUser) {
      console.log('⚠️ No authentication token found - showing login form')
      setShowLoginForm(true)
    } else {
      console.log('✅ Authenticated as:', storedUser.email)
      setShowLoginForm(false)
    }
  }, [isAuthenticated, user])
  
  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)
    
    try {
      const result = await login(loginEmail, loginPassword)
      if (result.success) {
        console.log('✅ Admin login successful')
        setShowLoginForm(false)
        setLoginEmail('')
        setLoginPassword('')
      } else {
        setLoginError(result.error || 'Login failed')
      }
    } catch (error) {
      setLoginError('Login failed. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }
  
  // Handle logout
  const handleLogout = () => {
    logout()
    setShowLoginForm(true)
    onClose()
  }
  
  // Database cleanup - DELETE ALL PRODUCTS
  const handleCleanupDatabase = async () => {
    setIsCleaningUp(true)
    try {
      console.log('🗑️ Cleaning up database - deleting all products...')
      
      // Delete all products one by one
      const deletePromises = products.map(product => 
        productAPI.delete(String(product.id))
          .catch(err => console.error('Failed to delete:', product.id, err))
      )
      
      await Promise.all(deletePromises)
      
      // Clear localStorage
      localStorage.removeItem('adminProducts')
      localStorage.removeItem('adminStock')
      
      console.log('✅ Database cleaned successfully')
      alert('All products have been deleted from the database!')
      setShowCleanupConfirm(false)
      window.location.reload() // Refresh to show empty state
    } catch (error) {
      console.error('❌ Cleanup failed:', error)
      alert('Failed to cleanup database. Please try again.')
    } finally {
      setIsCleaningUp(false)
    }
  }
  
  const [refreshKey, setRefreshKey] = useState(0) // Force refresh trigger
  
  // PERSISTENCE: Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (['products', 'stock', 'analytics', 'pricing'].includes(activeTab)) {
      localStorage.setItem('adminDashboard_activeTab', activeTab);
      console.log('💾 Saved admin tab to localStorage:', activeTab);
    }
  }, [activeTab]);

  // PERSISTENCE: Restore active panel on mount
  useEffect(() => {
    const savedPanel = localStorage.getItem('adminDashboard_activePanel');
    if (savedPanel) {
      console.log('📋 Restoring admin panel from localStorage:', savedPanel);
      switch(savedPanel) {
        case 'orders':
          setShowOrdersDashboard(true);
          break;
        case 'returns':
          setShowReturnsManager(true);
          break;
        case 'users':
          setShowUsersPanel(true);
          break;
        case 'collections':
          setShowCollectionsManager(true);
          break;
        case 'cms':
          setShowCMSPanel(true);
          break;
      }
    }
  }, []);
  
  // Monitor products changes
  useEffect(() => {
    console.log("📦 AdminDashboard: Products updated. Count:", products.length)
    console.log("📋 Product IDs:", products.map(p => `${p.id}:${p.name}`).join(", "))
  }, [products])

  // Poll returns and notifications independently; one failure must not block the other.
  useEffect(() => {
    const fetchDashboardSignals = async () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');

      if (!token) {
        console.log('[AdminDashboard] No token yet - skipping initial fetch');
        return;
      }

      // Fetch returns separately — failure here must not affect notifications
      try {
        const returnsRes = await fetch('/api/returns', {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        console.log('[AdminDashboard] Returns fetch status:', returnsRes.status);
        if (returnsRes.ok) {
          const data = await returnsRes.json();
          const returns = data.data?.returns || data.returns || data || [];
          const pending = Array.isArray(returns)
            ? returns.filter((r: any) => r.status === 'pending' || r.status === 'Pending').length
            : 0;
          setPendingReturnsCount(pending);
        } else {
          console.warn('Returns fetch failed - notification count unaffected');
        }
      } catch (err: any) {
        console.error('Returns fetch error (non-blocking):', err?.message || err);
      }

      // Fetch notifications independently
      try {
        const notifRes = await fetch('/api/admin/notifications', {
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        console.log('[AdminDashboard] Notifications fetch status:', notifRes.status);
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          const items = Array.isArray(notifData)
            ? notifData
            : (notifData.notifications || notifData.data?.notifications || []);
          const unread = Array.isArray(items)
            ? items.filter((n: any) => n.is_read === false)
            : [];
          setUnreadNotificationsCount(unread.length);
          console.log('Unread notifications:', unread.length);
        }
      } catch (err: any) {
        console.error('Notification fetch error:', err?.message || err);
      }
    };

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      return;
    }

    console.log('[AdminDashboard] Token confirmed - fetching dashboard signals');
    const initialTimer = setTimeout(() => {
      fetchDashboardSignals();
    }, 300);
    const interval = setInterval(fetchDashboardSignals, 5 * 60 * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isAuthenticated, user, showLoginForm])

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setShowProductForm(true)
  }

  const handleCloseForm = () => {
    console.log("🔄 Closing form and refreshing product list...")
    setShowProductForm(false)
    setEditingProduct(null)
    // Force component re-render by updating refresh key
    setRefreshKey(prev => prev + 1)
    console.log("📊 Current products count:", products.length)
  }

  // Delete with in-UI confirmation dialog
  const handleDeleteProduct = (product: Product) => {
    setDeletingProductId(String(product.id))
  }

  const confirmDeleteProduct = async () => {
    if (!deletingProductId) return
    setIsDeletingProduct(true)
    try {
      await deleteProduct(deletingProductId)
    } catch (err) {
      // error already alerted inside deleteProduct
    } finally {
      setIsDeletingProduct(false)
      setDeletingProductId(null)
    }
  }

  // If analytics tab is active, show full-screen analytics
  if (activeTab === "analytics") {
    return <AdminAnalytics onClose={() => setActiveTab("products")} />
  }

  // Show login form if not authenticated
  if (showLoginForm) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl tracking-wider mb-2">ADMIN LOGIN</h1>
            <p className="text-neutral-600">Please login to access the admin dashboard</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {loginError}
              </div>
            )}
            
            <div>
              <label className="block text-sm tracking-wider mb-2">EMAIL</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-neutral-300 focus:border-black outline-none"
                placeholder="admin@example.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm tracking-wider mb-2">PASSWORD</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-neutral-300 focus:border-black outline-none"
                placeholder="Enter your password"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-black text-white py-3 tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'LOGGING IN...' : 'LOGIN'}
            </button>
            
            <button
              type="button"
              onClick={onClose}
              className="w-full border-2 border-neutral-300 py-3 tracking-wider hover:bg-neutral-100 transition-colors"
            >
              CANCEL
            </button>
          </form>
          
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> You must be logged in as an admin to access this dashboard. 
              If you don't have admin credentials, please contact the system administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-2 md:p-4 lg:p-8 pb-16 sm:pb-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-3xl lg:text-4xl tracking-wider">ADMIN DASHBOARD</h1>
            {user && (
              <p className="text-sm text-neutral-600 mt-2">
                Logged in as: <strong>{user.email}</strong> ({user.role})
              </p>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={handleLogout}
              className="px-3 md:px-4 py-2 bg-neutral-700 hover:bg-neutral-800 text-white rounded transition-colors text-xs md:text-sm tracking-wider flex items-center gap-2 flex-1 md:flex-initial justify-center"
            >
              <LogOut className="w-4 h-4" />
              LOGOUT
            </button>
            <button
              onClick={onClose}
              className="px-3 md:px-4 py-2 bg-neutral-300 hover:bg-neutral-400 rounded transition-colors text-xs md:text-sm tracking-wider flex-1 md:flex-initial"
            >
              EXIT ADMIN
            </button>
          </div>
        </div>
        
        {/* Cleanup Confirmation Modal */}
        {showCleanupConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <AlertTriangle className="w-8 h-8" />
                <h2 className="text-2xl tracking-wider">DANGER ZONE</h2>
              </div>
              <p className="mb-6 text-neutral-700">
                This will <strong>permanently delete ALL products</strong> from the database. 
                This action cannot be undone!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCleanupDatabase}
                  disabled={isCleaningUp}
                  className="flex-1 bg-red-600 text-white py-3 rounded hover:bg-red-700 transition-colors disabled:opacity-50 tracking-wider"
                >
                  {isCleaningUp ? 'DELETING...' : 'YES, DELETE ALL'}
                </button>
                <button
                  onClick={() => setShowCleanupConfirm(false)}
                  disabled={isCleaningUp}
                  className="flex-1 border-2 border-neutral-300 py-3 rounded hover:bg-neutral-100 transition-colors tracking-wider"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2 w-full mb-6 md:mb-8">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-1 py-1.5 sm:px-3 sm:py-2 text-xs tracking-wider font-medium truncate border transition-colors ${
              activeTab === "products"
                ? "bg-black text-white border-black"
                : "bg-white text-black border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <span className="hidden sm:inline">PRODUCTS</span>
            <span className="sm:hidden text-xs">PROD</span>
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-1 py-1.5 sm:px-3 sm:py-2 text-xs tracking-wider font-medium truncate border transition-colors ${
              activeTab === "stock"
                ? "bg-black text-white border-black"
                : "bg-white text-black border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <span className="hidden sm:inline">STOCK</span>
            <span className="sm:hidden text-xs">STOCK</span>
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-1 py-1.5 sm:px-3 sm:py-2 text-xs tracking-wider font-medium truncate border transition-colors ${
              (activeTab as string) === "analytics"
                ? "bg-black text-white border-black"
                : "bg-white text-black border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <span className="hidden sm:inline">ANALYTICS</span>
            <span className="sm:hidden text-xs">STATS</span>
          </button>
          <button
            onClick={() => {
              localStorage.setItem('adminDashboard_activePanel', 'orders');
              setShowOrdersDashboard(true);
            }}
            className={`px-1 py-1.5 sm:px-3 sm:py-2 text-xs tracking-wider font-medium truncate border transition-colors ${
              showOrdersDashboard
                ? "bg-black text-white border-black"
                : "bg-white text-black border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <span className="hidden sm:inline">ORDERS</span>
            <span className="sm:hidden text-xs">ORDERS</span>
          </button>
          <button
            onClick={() => {
              localStorage.setItem('adminDashboard_activePanel', 'returns');
              setShowReturnsManager(true);
            }}
            className={`relative px-1 py-1.5 sm:px-3 sm:py-2 text-xs tracking-wider font-medium truncate border transition-colors ${
              showReturnsManager
                ? "bg-black text-white border-black"
                : "bg-white text-black border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <span className="hidden sm:inline">RETURNS</span>
            <span className="sm:hidden text-xs">RETURNS</span>
            {pendingReturnsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                {pendingReturnsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              localStorage.setItem('adminDashboard_activePanel', 'users');
              setShowUsersPanel(true);
            }}
            className={`px-1 py-1.5 sm:px-3 sm:py-2 text-xs tracking-wider font-medium truncate border transition-colors ${
              showUsersPanel
                ? "bg-black text-white border-black"
                : "bg-white text-black border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <span className="hidden sm:inline">USERS</span>
            <span className="sm:hidden text-xs">USERS</span>
          </button>
        </div>

        <div className="mb-2 text-xs text-neutral-600">
          Unread notifications: {unreadNotificationsCount}
        </div>
        <NotificationPanel />

        {/* Products Tab */}
        {activeTab === "products" && (
          <div>
            {/* Delete Confirmation Modal */}
            {deletingProductId && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
                  <div className="flex items-center gap-3 mb-4 text-red-600">
                    <Trash2 className="w-6 h-6" />
                    <h2 className="text-xl tracking-wider">CONFIRM DELETE</h2>
                  </div>
                  <p className="mb-6 text-neutral-700">
                    Are you sure you want to <strong>permanently delete</strong> this product? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={confirmDeleteProduct}
                      disabled={isDeletingProduct}
                      className="flex-1 bg-red-600 text-white py-3 rounded hover:bg-red-700 transition-colors disabled:opacity-50 tracking-wider text-sm"
                    >
                      {isDeletingProduct ? 'DELETING...' : 'YES, DELETE'}
                    </button>
                    <button
                      onClick={() => setDeletingProductId(null)}
                      disabled={isDeletingProduct}
                      className="flex-1 border-2 border-neutral-300 py-3 rounded hover:bg-neutral-100 transition-colors tracking-wider text-sm"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4 md:mb-6 flex flex-col md:flex-row gap-2 md:gap-3">
              <button
                onClick={() => {
                  setEditingProduct(null)
                  setShowProductForm(true)
                }}
                className="flex items-center justify-center gap-2 w-full md:w-auto px-3 md:px-6 py-2 md:py-3 bg-black text-white hover:bg-neutral-900 rounded transition-colors text-xs md:text-sm tracking-wider"
              >
                <Plus className="w-4 h-4" />
                ADD NEW PRODUCT
              </button>
              <button
                onClick={() => setShowCleanupConfirm(true)}
                className="flex items-center justify-center gap-2 w-full md:w-auto px-3 md:px-6 py-2 md:py-3 bg-red-600 text-white hover:bg-red-700 rounded transition-colors text-xs md:text-sm tracking-wider"
              >
                <Trash className="w-4 h-4" />
                CLEAR ALL PRODUCTS
              </button>
            </div>

            {showProductForm && <AdminProductForm product={editingProduct} onClose={handleCloseForm} />}
            {showBulkUpload && <BulkProductUpload onClose={() => setShowBulkUpload(false)} />}
            {showVariantsManager && variantProduct && (
              <ProductVariantsManager
                product={variantProduct}
                onClose={() => {
                  setShowVariantsManager(false)
                  setVariantProduct(null)
                }}
                onSave={(variants) => {
                  console.log('Saved variants:', variants)
                  setShowVariantsManager(false)
                  setVariantProduct(null)
                }}
              />
            )}

            {/* Products Grid */}
            {!products || products.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-neutral-300">
                <p className="text-neutral-600 mb-4">No products yet. Add your first product!</p>
                <button
                  onClick={() => {
                    setEditingProduct(null)
                    setShowProductForm(true)
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white hover:bg-neutral-900 rounded transition-colors text-sm tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  ADD FIRST PRODUCT
                </button>
              </div>
            ) : (() => {
              // Show only active (non-deleted) products
              const filteredProducts = products.filter(p => p && p.id && p.name && p.is_active !== false)

              if (filteredProducts.length === 0) {
                return (
                  <div className="text-center py-12 bg-white rounded-lg border border-neutral-300">
                    <Package2 className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                    <p className="text-neutral-600">No active products.</p>
                  </div>
                )
              }

              return (
                <div key={refreshKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={`${product.id}-${refreshKey}`}
                      className="bg-white border border-neutral-300 rounded-lg p-3 md:p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2 md:mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold tracking-wide text-xs md:text-sm mb-1 line-clamp-2">
                            {product.name}
                          </h3>
                          <p className="text-xs text-neutral-600">₹{Number(product.price || 0).toFixed(2)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {product.label && (
                            <span className="px-2 py-1 bg-black text-white text-xs tracking-wider rounded">
                              {product.label}
                            </span>
                          )}

                        </div>
                      </div>

                      <p className="text-xs text-neutral-600 mb-3 md:mb-4 line-clamp-2">{product.description || 'No description'}</p>

                      {/* Status Indicators */}
                      <div className="flex gap-1 mb-3 flex-wrap">
                      {(stock as Record<string, any>)[product.id]?.isVisible === false && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">HIDDEN</span>
                      )}
                      {(stock as Record<string, any>)[product.id]?.isNewArrival && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">NEW</span>
                      )}
                      {(stock as Record<string, any>)[product.id]?.isFeatured && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">FEATURED</span>
                        )}
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 md:px-3 py-2 bg-neutral-200 hover:bg-neutral-300 rounded text-xs transition-colors"
                        >
                          <Edit2 className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">EDIT</span>
                        </button>
                        <button
                          onClick={() => {
                            setVariantProduct(product)
                            setShowVariantsManager(true)
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 md:px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs transition-colors"
                          title="Manage Variants"
                        >
                          <Package2 className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">VARIANTS</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 md:px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs transition-colors"
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">DELETE</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Stock Control Tab */}
        {activeTab === "stock" && <StockControlPanel />}
      </div>

      {/* Low Stock Alerts Widget */}
      <LowStockAlerts />

      {/* Management Panels */}
      {showOrdersDashboard && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <div className="p-4">
            <button
              onClick={() => {
                localStorage.removeItem('adminDashboard_activePanel');
                setShowOrdersDashboard(false);
              }}
              className="mb-4 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
            >
              ← BACK TO DASHBOARD
            </button>
            <AdminOrdersPanel />
          </div>
        </div>
      )}
      {showReturnsManager && <ReturnsExchangesManager onClose={() => {
        localStorage.removeItem('adminDashboard_activePanel');
        setShowReturnsManager(false);
      }} />}
      {showUsersPanel && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <div className="p-8">
            <button
              onClick={() => {
                localStorage.removeItem('adminDashboard_activePanel');
                setShowUsersPanel(false);
              }}
              className="mb-6 flex items-center gap-2 px-4 py-2 bg-neutral-200 hover:bg-neutral-300 rounded transition-colors"
            >
              ← BACK TO DASHBOARD
            </button>
            <AdminUsersPanel />
          </div>
        </div>
      )}
      {showCollectionsManager && <CollectionsCampaignsManager onClose={() => {
        localStorage.removeItem('adminDashboard_activePanel');
        setShowCollectionsManager(false);
      }} />}
      {showCMSPanel && <ContentManagementSystem onClose={() => {
        localStorage.removeItem('adminDashboard_activePanel');
        setShowCMSPanel(false);
      }} />}
    </div>
  )
}
