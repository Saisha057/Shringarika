import { ChevronLeft, Package, MapPin, Clock, CheckCircle, Truck, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { orderAPI } from '../services/api';
import { OrderTracking } from './OrderTracking';
import { OrderTimeline } from './OrderTimeline';
import { ReturnOrderModal, type ReturnRequest } from './ReturnOrderModal';
import { ExchangeOrderModal, type ExchangeRequest } from './ExchangeOrderModal';
import type { CourierService } from '../utils/shipping';

interface OrdersPageProps {
  onNavigateHome: () => void;
  onViewProduct?: (productId: number) => void;
}

interface Order {
  orderId: string;
  orderDate: string;
  total: string;
  orderStatus?: string;
  status?: string; // Backend sends this
  return_requested?: boolean; // Track if return already requested
  return_status?: string; // Track return status
  returnStatus?: string;
  exchange_requested?: boolean; // Track if exchange already requested
  exchange_status?: string; // Track exchange status
  items: Array<{ 
    name: string; 
    quantity: number; 
    price: number;
    size?: string;
    color?: string;
    image?: string | null;
    productId?: string;
  }>;
  customer: { address: string };
  estimatedDelivery: string;
  shipping?: {
    trackingNumber?: string;
    courier?: CourierService;
    zone?: string;
    estimatedDelivery?: {
      min: Date;
      max: Date;
    };
  };
}

export function OrdersPage({ onNavigateHome, onViewProduct }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [exchangeModalOrder, setExchangeModalOrder] = useState<Order | null>(null);

  console.log('🎬 OrdersPage mounted/remounted (refreshKey:', refreshKey, ')');

  useEffect(() => {
    const fetchOrders = async () => {
      console.log('📥 fetchOrders called, refreshKey:', refreshKey);
      
      // CRITICAL SECURITY: Load only authenticated user's orders - NO CROSS-ACCOUNT ACCESS
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const userId = user?.id;
      const token = localStorage.getItem('authToken');
      
      console.log('🔒 DATA ISOLATION CHECK - Orders Page');
      console.log('  User ID:', userId || 'NONE (guest)');
      console.log('  Has Token:', !!token);

      if (!userId) {
        console.log('📦 No user authenticated, showing no orders');
        setOrders([]);
        return;
      }

      // CRITICAL: Clean up old global fashionOrders key if it exists
      const oldGlobalOrders = localStorage.getItem('fashionOrders');
      if (oldGlobalOrders) {
        console.log('🧹 Found old global fashionOrders key - migrating to user-specific storage...');
        try {
          const allOrders = JSON.parse(oldGlobalOrders);
          // Migrate user's orders to their specific key
          const userOldOrders = allOrders.filter((order: any) => order.userId === userId);
          if (userOldOrders.length > 0) {
            const userOrdersKey = `fashionOrders_${userId}`;
            // Only migrate if user doesn't already have orders in new key
            const existingUserOrders = localStorage.getItem(userOrdersKey);
            if (!existingUserOrders) {
              // Remove userId field from orders before saving
              const cleanedOrders = userOldOrders.map((order: any) => {
                const { userId: _, ...orderWithoutUserId } = order;
                return orderWithoutUserId;
              });
              localStorage.setItem(userOrdersKey, JSON.stringify(cleanedOrders));
              console.log('✅ Migrated', cleanedOrders.length, 'orders to user-specific key');
            }
          }
        } catch (error) {
          console.error('❌ Failed to migrate old orders:', error);
        }
        // Delete the old global key to prevent future confusion
        localStorage.removeItem('fashionOrders');
        console.log('🗑️ Removed old global fashionOrders key');
      }

      // ✅ FIX A1 & A2: DATABASE IS PRIMARY SOURCE
      // Only fallback to localStorage if API fails
      try {
        if (token) {
          console.log('📦 [PRIMARY] Fetching orders from database API...');
          const response = await orderAPI.getMyOrders();
          
          if (response?.status === 'success' && response?.data?.orders) {
            // Transform backend orders to frontend format
            const backendOrders = response.data.orders.map((order: any) => {
              // Normalize status - trust only order_status from database
              const normalizedStatus = order.order_status || 'Pending';
              
              console.log(`🎯 [ORDER ${order.id}] Backend status: ${order.status}, order_status: ${order.order_status}, normalized: ${normalizedStatus}`);
              
              return {
              orderId: order.id || order._id,
              orderDate: new Date(order.created_at || order.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              }),
              total: (order.total_price || order.totalPrice || 0).toString(),
              status: normalizedStatus,
              orderStatus: normalizedStatus,
              return_requested: order.return_requested || false,
              return_status: order.return_status || null,
              exchange_requested: order.exchange_requested || false,
              exchange_status: order.exchange_status || null,
              items: (order.order_items || order.orderItems || []).map((item: any) => ({
                id: item.id,                                      // order_items.id — used as exchange identifier
                name: item.productName || item.name,
                quantity: item.quantity,
                price: item.pricePerItem || item.price,
                size: item.product_variants?.size || item.size,
                color: item.product_variants?.color || item.color,
                image: item.image || item.image_url || null,
                productId: item.productId || item.product,
              })),
              customer: {
                address: order.shipping_address 
                  ? `${order.shipping_address.address || order.shipping_address.street || ''}, ${order.shipping_address.city || ''}, ${order.shipping_address.state || ''} - ${order.shipping_address.pincode || order.shipping_address.pinCode || ''}`
                  : order.shippingAddress
                    ? `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pinCode}`
                    : 'Address not available'
              },
              estimatedDelivery: order.estimated_delivery_date || order.estimatedDeliveryDate
                ? new Date(order.estimated_delivery_date || order.estimatedDeliveryDate).toLocaleDateString('en-IN')
                : 'N/A',
              shipping: order.tracking_number ? {
                trackingNumber: order.tracking_number,
                courier: order.courier_service,
              } : undefined,
            };
            });
            
            const firstOrder = backendOrders[0];
            if (firstOrder) {
              console.log('📦 [SAMPLE ORDER] First order status:', firstOrder.status, '| orderStatus:', firstOrder.orderStatus);
            }
            
            console.log('✅ [DATABASE] Loaded', backendOrders.length, 'orders from database');
            // Sort by date (most recent first) - already sorted by backend but ensure
            backendOrders.sort((a: any, b: any) => {
              const dateA = new Date(a.orderDate).getTime();
              const dateB = new Date(b.orderDate).getTime();
              return dateB - dateA;
            });
            setOrders(backendOrders);
            return; // SUCCESS - database is primary source
          } else {
            console.warn('⚠️ Backend returned unexpected format:', response);
          }
        } else {
          console.warn('⚠️ No auth token available');
        }
      } catch (error: any) {
        console.error('❌ [DATABASE] Failed to fetch from API:', error);
        console.log('⚠️ Falling back to localStorage (offline mode)...');
      }

      // ✅ FALLBACK ONLY: Load from localStorage if database failed
      const userOrdersKey = `fashionOrders_${userId}`;
      console.log('📦 [FALLBACK] Loading from localStorage:', userOrdersKey);
      const savedOrders = localStorage.getItem(userOrdersKey);
      
      if (savedOrders) {
        try {
          const userOrders = JSON.parse(savedOrders);
          const normalizedFallbackOrders = userOrders.map((order: any) => ({
            ...order,
            items: (order.items || []).filter((item: any) => {
              const hasValidId = Boolean(item?.id);
              if (!hasValidId) {
                console.warn('⚠️ [FALLBACK] Skipping item without id in localStorage order:', order.orderId || order.id);
              }
              return hasValidId;
            })
          }));
          console.log('📦 [FALLBACK] Loaded', normalizedFallbackOrders.length, 'orders from localStorage');
          // Sort by date
          normalizedFallbackOrders.sort((a: Order, b: Order) => {
            const dateA = new Date(a.orderDate).getTime();
            const dateB = new Date(b.orderDate).getTime();
            return dateB - dateA;
          });
          setOrders(normalizedFallbackOrders);
        } catch (error) {
          console.error('❌ Failed to parse localStorage orders:', error);
          setOrders([]);
        }
      } else {
        console.log('📦 No orders found (database and localStorage both empty)');
        setOrders([]);
      }
    };

    fetchOrders();
  }, [refreshKey]); // Re-fetch when refreshKey changes

  // Auto-refresh when window gains focus (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Window focused, refreshing orders...');
      setRefreshKey(prev => prev + 1);
    };

    const handleReturnsStatusUpdated = () => {
      console.log('🔄 Returns status updated event received, refreshing orders...');
      setRefreshKey(prev => prev + 1);
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible, refreshing orders...');
        setRefreshKey(prev => prev + 1);
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('returns-status-updated', handleReturnsStatusUpdated);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('returns-status-updated', handleReturnsStatusUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Manual refresh function
  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered...');
    setRefreshKey(prev => prev + 1);
  };

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
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-5xl tracking-wider mb-2">MY ORDERS</h1>
              <p className="text-neutral-600">Track and manage your orders</p>
            </div>
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                setRefreshKey(prev => prev + 1);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-neutral-300 hover:bg-neutral-50 transition-colors"
            >
              <Package className="w-4 h-4" />
              <span className="text-sm">REFRESH</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h2 className="text-2xl tracking-wider mb-2">NO ORDERS YET</h2>
            <p className="text-neutral-600 mb-6">
              When you place orders, they will appear here.
            </p>
            <button
              onClick={onNavigateHome}
              className="bg-black text-white px-8 py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
            >
              START SHOPPING
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.orderId}
                className="border border-neutral-300 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                {/* Order Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-neutral-200">
                  <div>
                    <h3 className="text-lg tracking-wider mb-1">
                      Order #{order.orderId}
                    </h3>
                    <p className="text-sm text-neutral-600">
                      Placed on {order.orderDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl tracking-wider">₹{order.total}</p>
                    <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>Order Confirmed</span>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="mb-4">
                  <h4 className="text-sm tracking-wider mb-3">ITEMS</h4>
                  <div className="space-y-3">
                    {order.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-neutral-50 rounded"
                      >
                        {/* Product Image - CLICKABLE */}
                        <div 
                          className="w-20 h-24 bg-white border border-neutral-200 shrink-0 overflow-hidden rounded relative cursor-pointer hover:border-neutral-400 transition-colors"
                          onClick={() => {
                            // Navigate to product detail page if productId exists and onViewProduct is provided
                            if (item.productId && onViewProduct) {
                              const productId = typeof item.productId === 'string' 
                                ? parseInt(item.productId) 
                                : item.productId;
                              onViewProduct(productId);
                            } else {
                              console.warn('Product ID not available or onViewProduct not provided');
                            }
                          }}
                          title="Click to view product details"
                        >
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.fallback-text')) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'fallback-text w-full h-full flex items-center justify-center bg-neutral-100 text-xs text-neutral-400';
                                  fallback.textContent = 'No Image';
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-xs text-neutral-400">
                              No Image
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 mb-1">{item.name}</p>
                          {(item.size || item.color) && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {item.size && (
                                <span className="text-xs px-2 py-1 bg-white border border-neutral-300 rounded">
                                  Size: {item.size}
                                </span>
                              )}
                              {item.color && (
                                <span className="text-xs px-2 py-1 bg-white border border-neutral-300 rounded">
                                  Color: {item.color}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-neutral-600">Qty: {item.quantity}</span>
                            <span className="font-medium">₹{(Number(item.price || 0) * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-neutral-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm tracking-wider mb-1">Delivery Address</p>
                      <p className="text-sm text-neutral-600">{order.customer.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-neutral-600 shrink-0 mt-0.5" />
                    <div>
                      {/* Check both orderStatus and status fields for delivered state */}
                      {(order.orderStatus?.toLowerCase() === 'delivered' || order.status?.toLowerCase() === 'delivered') ? (
                        <>
                          <p className="text-sm tracking-wider mb-1">Delivered</p>
                          <p className="text-sm text-green-600 font-medium">✓ Your order has been delivered</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm tracking-wider mb-1">Estimated Delivery</p>
                          <p className="text-sm text-neutral-600">
                            {(() => {
                              // Calculate delivery date from order placement
                              try {
                                // Parse order date (format: "29 Dec, 2024")
                                const orderDateStr = order.orderDate;
                                let orderDate: Date;
                                
                                // Try parsing the date
                                if (orderDateStr.includes(',')) {
                                  // Format: "29 Dec, 2024"
                                  const parts = orderDateStr.split(/[\s,]+/);
                                  const day = parseInt(parts[0]);
                                  const monthStr = parts[1];
                                  const year = parseInt(parts[2]);
                                  const monthMap: {[key: string]: number} = {
                                    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                                    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
                                  };
                                  orderDate = new Date(year, monthMap[monthStr], day);
                                } else {
                                  orderDate = new Date(orderDateStr);
                                }
                                
                                // Add 7 days for delivery
                                const deliveryDate = new Date(orderDate);
                                deliveryDate.setDate(deliveryDate.getDate() + 7);
                                
                                // Format for display
                                return deliveryDate.toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                });
                              } catch (error) {
                                // Fallback to stored date if parsing fails
                                return order.estimatedDelivery || 'Calculating...';
                              }
                            })()}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
<div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-neutral-200">
                  <button 
                    onClick={() => {
                      // Calculate delivery date
                      let deliveryDateStr = 'Calculating...';
                      try {
                        const orderDateStr = order.orderDate;
                        let orderDate: Date;
                        
                        if (orderDateStr.includes(',')) {
                          const parts = orderDateStr.split(/[\s,]+/);
                          const day = parseInt(parts[0]);
                          const monthStr = parts[1];
                          const year = parseInt(parts[2]);
                          const monthMap: {[key: string]: number} = {
                            Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                            Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
                          };
                          orderDate = new Date(year, monthMap[monthStr], day);
                        } else {
                          orderDate = new Date(orderDateStr);
                        }
                        
                        const deliveryDate = new Date(orderDate);
                        deliveryDate.setDate(deliveryDate.getDate() + 7);
                        deliveryDateStr = deliveryDate.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });
                      } catch (error) {
                        deliveryDateStr = order.estimatedDelivery || 'N/A';
                      }
                      
                      // Show real-time tracking with actual order status
                      const statusMessage = order.status || order.orderStatus || 'Processing';
                      const statusEmoji = 
                        statusMessage.toLowerCase() === 'delivered' ? '✓' :
                        statusMessage.toLowerCase() === 'shipped' ? '🚚' :
                        statusMessage.toLowerCase() === 'out for delivery' ? '📦' :
                        statusMessage.toLowerCase() === 'packed' ? '📦' :
                        statusMessage.toLowerCase() === 'processing' ? '⚙️' :
                        statusMessage.toLowerCase() === 'confirmed' ? '✓' :
                        statusMessage.toLowerCase() === 'pending' ? '⏳' :
                        statusMessage.toLowerCase() === 'cancelled' ? '❌' :
                        statusMessage.toLowerCase() === 'returned' ? '↩️' :
                        statusMessage.toLowerCase() === 'refunded' ? '💰' : '📋';
                      
                      const deliveryInfo = statusMessage.toLowerCase() === 'delivered' 
                        ? 'Your order has been delivered!' 
                        : `Estimated Delivery: ${deliveryDateStr}`;
                      
                      alert(`Order #${order.orderId}\n\nCurrent Status: ${statusMessage} ${statusEmoji}\n${deliveryInfo}\n\nYour order status is updated in real-time.`);
                    }}
                    className="px-4 py-2 border border-neutral-300 rounded-full text-sm tracking-wider hover:bg-neutral-50 transition-colors"
                  >
                    Track Order
                  </button>
                  <button 
                    onClick={() => setExpandedOrderId(expandedOrderId === order.orderId ? null : order.orderId)}
                    className="px-4 py-2 border border-neutral-300 rounded-full text-sm tracking-wider hover:bg-neutral-50 transition-colors"
                  >
                    {expandedOrderId === order.orderId ? 'Hide' : 'View'} Details
                  </button>
                  
                  {/* Return & Exchange buttons - only show for delivered orders that haven't been requested yet */}
                  {/* Mutual exclusivity: if either is already requested, hide the other button */}
                  {order.orderStatus?.toLowerCase() === 'delivered' && (
                    <>
                      {/* Return button: only show if no return AND no exchange has been requested */}
                      {!order.return_requested && !order.exchange_requested && (
                        <button 
                          onClick={() => setReturnModalOrder(order)}
                          className="px-4 py-2 bg-red-600 text-white rounded-full text-sm tracking-wider hover:bg-red-700 transition-colors"
                        >
                          Return Order
                        </button>
                      )}
                      {(order.return_requested || order.return_status || order.returnStatus) && (
                        <span
                          style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background:
                              (order.return_status === 'approved' || order.returnStatus === 'approved')
                                ? '#dcfce7'
                                : '#fef9c3',
                            color:
                              (order.return_status === 'approved' || order.returnStatus === 'approved')
                                ? '#166534'
                                : '#854d0e'
                          }}
                        >
                          Return: {(order.return_status || order.returnStatus || 'requested').replace(/_/g, ' ').toUpperCase()}
                        </span>
                      )}
                      {/* Exchange button: only show if no exchange AND no return has been requested */}
                      {!order.exchange_requested && !order.return_requested && (
                        <button 
                          onClick={() => setExchangeModalOrder(order)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm tracking-wider hover:bg-blue-700 transition-colors"
                        >
                          Exchange Order
                        </button>
                      )}
                      {order.exchange_requested && (
                        <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm tracking-wider border border-blue-300">
                          Exchange {order.exchange_status || 'Requested'}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedOrderId === order.orderId && (
                  <div className="mt-4 pt-4 border-t border-neutral-200 space-y-4">
                    <OrderTimeline orderId={order.orderId} />

                    {/* Tracking Information */}
                    {order.shipping?.trackingNumber && order.shipping?.courier && (
                      <div className="bg-neutral-50 rounded p-4">
                        <OrderTracking 
                          trackingNumber={order.shipping.trackingNumber}
                          courier={order.shipping.courier}
                          orderId={order.orderId}
                          estimatedDelivery={order.shipping.estimatedDelivery?.max}
                        />
                      </div>
                    )}

                    {/* Shipping Zone Info */}
                    {order.shipping?.zone && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span className="text-blue-800">
                            <span className="font-semibold">Shipping Zone:</span> {order.shipping.zone}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-neutral-50 rounded p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium tracking-wider mb-2">ORDER SUMMARY</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Subtotal ({order.items.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                            <span>₹{order.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Shipping</span>
                            <span className="text-green-600">FREE</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-neutral-300 font-medium">
                            <span>Total Amount Paid</span>
                            <span className="text-lg">₹{order.total}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium tracking-wider mb-2">PAYMENT METHOD</p>
                        <p className="text-sm text-neutral-600">Cash on Delivery (COD)</p>
                        <p className="text-xs text-neutral-500 mt-1">Payment will be collected at delivery</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium tracking-wider mb-2">ORDER DETAILS</p>
                        <div className="space-y-1 text-sm">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start py-1">
                              <div className="flex-1">
                                <p className="font-medium text-neutral-800">{item.name}</p>
                                <div className="flex gap-2 text-xs text-neutral-600 mt-0.5">
                                  {item.size && <span className="px-2 py-0.5 bg-white border border-neutral-300 rounded">Size: {item.size}</span>}
                                  {item.color && <span className="px-2 py-0.5 bg-white border border-neutral-300 rounded">Color: {item.color}</span>}
                                  <span>Qty: {item.quantity}</span>
                                </div>
                              </div>
                              <span className="font-medium ml-2">₹{(Number(item.price || 0) * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Return Modal */}
      {returnModalOrder && (
        <ReturnOrderModal
          order={returnModalOrder}
          onClose={() => setReturnModalOrder(null)}
          onSubmit={async (returnData: ReturnRequest) => {
            try {
              console.log('📤 Submitting return request for order:', returnModalOrder.orderId);
              const response = await orderAPI.requestReturn(returnModalOrder.orderId, returnData);
              
              if (response.status === 'success') {
                alert('Return request submitted successfully! You will receive an email confirmation shortly.');
                setReturnModalOrder(null);
                setRefreshKey(prev => prev + 1); // Refresh orders
              } else {
                alert('Failed to submit return request. Please try again.');
              }
            } catch (error: any) {
              console.error('Error submitting return request:', error);
              alert(error.response?.data?.message || 'Failed to submit return request. Please try again.');
            }
          }}
        />
      )}

      {/* Exchange Modal */}
      {exchangeModalOrder && (
        <ExchangeOrderModal
          order={exchangeModalOrder}
          onClose={() => setExchangeModalOrder(null)}
          onSubmit={async (exchangeData: ExchangeRequest) => {
            try {
              if (!exchangeData.itemId) {
                alert('Could not identify the selected item. Please refresh and try again.');
                return;
              }
              console.log('📤 Submitting exchange request for order:', exchangeModalOrder.orderId);
              const response = await orderAPI.requestExchange(exchangeModalOrder.orderId, exchangeData);
              
              if (response.status === 'success') {
                alert('Exchange request submitted successfully! We will verify stock availability and contact you shortly.');
                setExchangeModalOrder(null);
                setRefreshKey(prev => prev + 1); // Refresh orders
              } else {
                alert('Failed to submit exchange request. Please try again.');
              }
            } catch (error: any) {
              console.error('Error submitting exchange request:', error);
              alert(error.response?.data?.message || 'Failed to submit exchange request. Please try again.');
            }
          }}
        />
      )}
    </div>
  );
}
