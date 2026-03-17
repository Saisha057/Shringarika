"use client"

import { useState, useEffect } from "react"
import { Package, Search, Filter, Download, RefreshCw, ChevronDown, ChevronUp, Truck, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react"
import { adminAPI } from '../services/api';

interface Order {
  id: string
  orderId: string
  customerName: string
  customerEmail: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  totalAmount: number
  status: 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned' | 'refunded'
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded'
  shippingAddress: {
    street: string
    city: string
    state: string
    pinCode: string
  }
  trackingNumber?: string
  carrier?: string
  createdAt: string
  updatedAt: string
}

interface OrderManagementDashboardProps {
  onClose: () => void
}

export function OrderManagementDashboard({ onClose }: OrderManagementDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [editingTracking, setEditingTracking] = useState<string | null>(null)
  const [trackingForm, setTrackingForm] = useState({ trackingNumber: "", carrier: "" })

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    filterOrders()
  }, [orders, searchQuery, statusFilter])

  const loadOrders = async () => {
    try {
      // First, try to fetch from backend API
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const apiOrders = (data.data?.orders || data.orders || []).map((order: any) => ({
          id: order.id || order._id,
          orderId: order.id || order._id,
          customerName: order.shipping_address?.fullName || order.shippingAddress?.fullName || 'Guest User',
          customerEmail: order.contact_details?.email || order.shippingAddress?.email || 'guest@example.com',
          items: (order.order_items || order.orderItems || []).map((item: any) => ({
            name: item.productName || item.name || item.product_name || 'Product',
            quantity: item.quantity || 0,
            price: item.pricePerItem || item.price || item.unit_price || 0,
            image: item.image || null
          })),
          totalAmount: order.total_price || order.totalPrice || order.total_amount || 0,
          status: order.order_status || order.orderStatus || 'pending',
          paymentStatus: order.is_paid ? 'completed' : 'pending',
          shippingAddress: {
            street: order.shipping_address?.street || order.shippingAddress?.street || 'N/A',
            city: order.shipping_address?.city || order.shippingAddress?.city || 'N/A',
            state: order.shipping_address?.state || order.shippingAddress?.state || 'N/A',
            pinCode: order.shipping_address?.pinCode || order.shippingAddress?.pinCode || 'N/A'
          },
          trackingNumber: order.tracking_number || order.trackingNumber,
          carrier: order.carrier,
          createdAt: order.created_at || order.createdAt || new Date().toISOString(),
          updatedAt: order.updated_at || order.updatedAt || new Date().toISOString()
        }));

        console.log('✅ Loaded orders from API:', apiOrders.length);
        setOrders(apiOrders);
        return;
      }
    } catch (error) {
      console.error('⚠️ Error fetching orders from API, falling back to localStorage:', error);
    }

    // Fallback: Load orders from localStorage
    const allOrders: Order[] = []
    
    // Collect orders from all users
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('fashionOrders_user_')) {
        try {
          const userOrders = JSON.parse(localStorage.getItem(key) || '[]')
          allOrders.push(...userOrders.map((order: any) => ({
            ...order,
            id: order.orderId || order.id,
            customerName: order.customerName || 'Guest User',
            customerEmail: order.customerEmail || 'guest@example.com',
            status: order.status || 'pending',
            paymentStatus: order.paymentStatus || 'completed',
            createdAt: order.orderDate || order.createdAt || new Date().toISOString(),
            updatedAt: order.updatedAt || new Date().toISOString(),
            totalAmount: parseFloat(order.total) || 0,
            shippingAddress: order.shippingAddress || {
              street: 'N/A',
              city: 'N/A',
              state: 'N/A',
              pinCode: 'N/A'
            }
          })))
        } catch (error) {
          console.error('Error parsing orders:', error)
        }
      }
    })

    console.log('📦 Loaded orders from localStorage:', allOrders.length);
    setOrders(allOrders)
  }

  const filterOrders = () => {
    let filtered = [...orders]

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(order =>
        order.orderId.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerEmail.toLowerCase().includes(query) ||
        order.trackingNumber?.toLowerCase().includes(query)
      )
    }

    setFilteredOrders(filtered)
  }

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      // Update in backend API first
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderStatus: newStatus })
      });

      if (response.ok) {
        console.log('✅ Order status updated in database');
      } else {
        console.warn('⚠️ Failed to update order status in database, updating locally only');
      }
    } catch (error) {
      console.error('⚠️ Error updating order status in API:', error);
    }

    // Update local state
    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        return { ...order, status: newStatus, updatedAt: new Date().toISOString() }
      }
      return order
    })

    setOrders(updatedOrders)
    
    // Update in localStorage as backup
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('fashionOrders_user_')) {
        try {
          const userOrders = JSON.parse(localStorage.getItem(key) || '[]')
          const updatedUserOrders = userOrders.map((order: any) => {
            if (order.orderId === orderId || order.id === orderId) {
              return { ...order, status: newStatus, updatedAt: new Date().toISOString() }
            }
            return order
          })
          localStorage.setItem(key, JSON.stringify(updatedUserOrders))
        } catch (error) {
          console.error('Error updating order:', error)
        }
      }
    })
  }

  const updateTracking = async (orderId: string) => {
    if (!trackingForm.trackingNumber || !trackingForm.carrier) {
      alert('Please enter both tracking number and carrier')
      return
    }

    try {
      // Update in backend API first
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trackingNumber: trackingForm.trackingNumber,
          carrier: trackingForm.carrier
        })
      });

      if (response.ok) {
        console.log('✅ Tracking updated in database');
      } else {
        console.warn('⚠️ Failed to update tracking in database, updating locally only');
      }
    } catch (error) {
      console.error('⚠️ Error updating tracking in API:', error);
    }

    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          trackingNumber: trackingForm.trackingNumber,
          carrier: trackingForm.carrier,
          updatedAt: new Date().toISOString()
        }
      }
      return order
    })

    setOrders(updatedOrders)

    // Update in localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('fashionOrders_user_')) {
        try {
          const userOrders = JSON.parse(localStorage.getItem(key) || '[]')
          const updatedUserOrders = userOrders.map((order: any) => {
            if (order.orderId === orderId || order.id === orderId) {
              return {
                ...order,
                trackingNumber: trackingForm.trackingNumber,
                carrier: trackingForm.carrier,
                updatedAt: new Date().toISOString()
              }
            }
            return order
          })
          localStorage.setItem(key, JSON.stringify(updatedUserOrders))
        } catch (error) {
          console.error('Error updating tracking:', error)
        }
      }
    })

    setEditingTracking(null)
    setTrackingForm({ trackingNumber: "", carrier: "" })
  }

  const deleteCompletedOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      alert('Order not found');
      return;
    }

    if (order.status.toLowerCase() !== 'delivered') {
      alert('Only delivered orders can be marked as complete and deleted');
      return;
    }

    if (!confirm('Are you sure you want to mark this order as complete and delete it? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🗑️ [OrderManagement] Deleting completed order:', orderId);
      
      const result = await adminAPI.deleteCompletedOrder(orderId);
      
      if (result.status === 'success') {
        console.log('✅ [OrderManagement] Order deleted successfully');
        
        // Remove from local state
        setOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
        
        // Remove from localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('fashionOrders_user_')) {
            try {
              const userOrders = JSON.parse(localStorage.getItem(key) || '[]');
              const filtered = userOrders.filter((o: any) => o.id !== orderId && o.orderId !== orderId);
              localStorage.setItem(key, JSON.stringify(filtered));
            } catch (error) {
              console.error('Error removing from localStorage:', error);
            }
          }
        });
        
        alert('Order marked as complete and removed successfully');
      } else {
        alert('Failed to delete order: ' + (result.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('❌ [OrderManagement] Error deleting order:', error);
      alert('Error deleting order: ' + (error.message || 'Network error'));
    }
  }

  const exportOrders = () => {
    const csv = [
      ['Order ID', 'Customer', 'Email', 'Status', 'Total', 'Date', 'Tracking'].join(','),
      ...filteredOrders.map(order => [
        order.orderId,
        order.customerName,
        order.customerEmail,
        order.status,
        `₹${order.totalAmount}`,
        new Date(order.createdAt).toLocaleDateString(),
        order.trackingNumber || 'N/A'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'confirmed':
      case 'processing':
      case 'packed':
        return <Package className="w-4 h-4 text-blue-600" />
      case 'shipped':
      case 'out_for_delivery':
        return <Truck className="w-4 h-4 text-purple-600" />
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'cancelled':
      case 'returned':
      case 'refunded':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-indigo-100 text-indigo-800'
      case 'packed': return 'bg-cyan-100 text-cyan-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'out_for_delivery': return 'bg-violet-100 text-violet-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'returned': return 'bg-orange-100 text-orange-800'
      case 'refunded': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => ['confirmed', 'processing', 'packed'].includes(o.status)).length,
    shipped: orders.filter(o => ['shipped', 'out_for_delivery'].includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    revenue: orders.reduce((sum, o) => sum + o.totalAmount, 0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto">
      <div className="bg-white w-full max-w-7xl m-4 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-wider flex items-center gap-3">
                <Package className="w-8 h-8" />
                ORDER MANAGEMENT
              </h2>
              <p className="text-indigo-100 mt-1">Manage and track all customer orders</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-200 text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-6 bg-gray-50">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-600">Total Orders</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
            <div className="text-xs text-gray-600">Processing</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{stats.shipped}</div>
            <div className="text-xs text-gray-600">Shipped</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            <div className="text-xs text-gray-600">Delivered</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-indigo-200">
            <div className="text-2xl font-bold text-indigo-600">₹{stats.revenue.toFixed(0)}</div>
            <div className="text-xs text-gray-600">Revenue</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by order ID, customer name, email, or tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
                <option value="refunded">Refunded</option>
              </select>
              <button
                onClick={loadOrders}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={exportOrders}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  {/* Order Header */}
                  <div
                    className="bg-white p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {getStatusIcon(order.status)}
                        <div>
                          <div className="font-semibold text-sm">#{order.orderId}</div>
                          <div className="text-xs text-gray-600">{order.customerName}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <div className="text-right">
                          <div className="font-semibold text-sm">₹{order.totalAmount.toFixed(2)}</div>
                          <div className="text-xs text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {expandedOrderId === order.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Details (Expanded) */}
                  {expandedOrderId === order.id && (
                    <div className="bg-gray-50 p-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Customer Details */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Customer Details</h4>
                          <div className="text-sm space-y-1">
                            <div><span className="text-gray-600">Name:</span> {order.customerName}</div>
                            <div><span className="text-gray-600">Email:</span> {order.customerEmail}</div>
                            <div><span className="text-gray-600">Address:</span></div>
                            <div className="pl-4 text-xs text-gray-600">
                              {order.shippingAddress.street}<br />
                              {order.shippingAddress.city}, {order.shippingAddress.state}<br />
                              PIN: {order.shippingAddress.pinCode}
                            </div>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Order Items</h4>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-600">{item.name} x{item.quantity}</span>
                                <span className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-gray-300 flex justify-between font-semibold">
                              <span>Total</span>
                              <span>₹{order.totalAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tracking Information */}
                      <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                        <h4 className="font-semibold text-sm mb-2">Tracking Information</h4>
                        {editingTracking === order.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Tracking Number"
                              value={trackingForm.trackingNumber}
                              onChange={(e) => setTrackingForm({ ...trackingForm, trackingNumber: e.target.value })}
                              className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Carrier"
                              value={trackingForm.carrier}
                              onChange={(e) => setTrackingForm({ ...trackingForm, carrier: e.target.value })}
                              className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                            />
                            <button
                              onClick={() => updateTracking(order.id)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingTracking(null)
                                setTrackingForm({ trackingNumber: "", carrier: "" })
                              }}
                              className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="text-sm">
                              {order.trackingNumber ? (
                                <>
                                  <span className="text-gray-600">Tracking:</span> {order.trackingNumber}
                                  <span className="text-gray-600 ml-4">Carrier:</span> {order.carrier}
                                </>
                              ) : (
                                <span className="text-gray-500 italic">No tracking info</span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setEditingTracking(order.id)
                                setTrackingForm({
                                  trackingNumber: order.trackingNumber || "",
                                  carrier: order.carrier || ""
                                })
                              }}
                              className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded text-sm"
                            >
                              {order.trackingNumber ? 'Edit' : 'Add'} Tracking
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status Update Actions */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="text-sm text-gray-600 mr-2">Update Status:</span>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'confirmed')}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                          >
                            Confirm Order
                          </button>
                        )}
                        {order.status === 'confirmed' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'processing')}
                            className="px-3 py-1 text-xs bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200"
                          >
                            Start Processing
                          </button>
                        )}
                        {order.status === 'processing' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'packed')}
                            className="px-3 py-1 text-xs bg-cyan-100 text-cyan-800 rounded hover:bg-cyan-200"
                          >
                            Mark as Packed
                          </button>
                        )}
                        {order.status === 'packed' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'shipped')}
                            className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                          >
                            Ship Order
                          </button>
                        )}
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                            className="px-3 py-1 text-xs bg-violet-100 text-violet-800 rounded hover:bg-violet-200"
                          >
                            Out for Delivery
                          </button>
                        )}
                        {order.status === 'out_for_delivery' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                            className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                          >
                            Mark Delivered
                          </button>
                        )}
                        {order.status === 'delivered' && (
                          <button
                            onClick={() => deleteCompletedOrder(order.id)}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Mark Complete & Delete
                          </button>
                        )}
                        {!['cancelled', 'delivered', 'returned', 'refunded'].includes(order.status) && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                          >
                            Cancel Order
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
