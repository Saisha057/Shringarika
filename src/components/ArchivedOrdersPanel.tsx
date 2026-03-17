"use client"

import { useState, useEffect } from "react"
import { X, RefreshCw, Archive, Clock, Calendar } from "lucide-react"
import { adminAPI } from "../services/api"

interface Order {
  id: string // Changed from number to string (UUID)
  user_id: number
  customer_name?: string // ✅ FIXED: Backend returns customer_name, not user_name
  user_email?: string
  user_phone?: string
  total?: number | string // ✅ FIXED: Backend returns 'total', not 'total_price', may be string
  total_price?: number // Keep as fallback
  order_status: string // Changed from status to match DB
  status?: string // Optional fallback
  payment_method: string
  created_at: string
  updated_at?: string
  delivered_at?: string
  is_archived?: boolean // Archive flag
  archived_at?: string // Archive timestamp
  archived_by?: string // Admin who archived
  shipping_address?: {
    fullName?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    pincode?: string
  }
  order_items: Array<{
    product_id: string
    name: string
    quantity: number | string // May be string from DB
    size: string
    price: number | string // May be string from DB
    pricePerItem?: number // Alternative field name
  }>
}

interface ArchivedOrdersPanelProps {
  onClose: () => void
}

export function ArchivedOrdersPanel({ onClose }: ArchivedOrdersPanelProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [unarchiving, setUnarchiving] = useState<string | null>(null)

  const loadArchivedOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminAPI.getArchivedOrders()
      console.log("📦 Archived orders response:", response)
      
      const ordersData = response.data || []
      
      // Sort by updated_at (approximate archived time)
      const sortedOrders = ordersData.sort((a: Order, b: Order) => {
        const dateA = new Date(a.updated_at || 0).getTime()
        const dateB = new Date(b.updated_at || 0).getTime()
        return dateB - dateA
      })
      
      setOrders(sortedOrders)
      console.log(`✅ Loaded ${sortedOrders.length} archived orders`)
    } catch (err: any) {
      console.error("❌ Failed to load archived orders:", err)
      setError(err.response?.data?.message || "Failed to load archived orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArchivedOrders()
  }, [])

  const handleUnarchive = async (orderId: string) => {
    if (!confirm("Restore this order to active orders?")) return

    setUnarchiving(orderId)
    try {
      await adminAPI.unarchiveOrder(orderId)
      console.log(`✅ Unarchived order ${orderId}`)
      
      // Remove from list
      setOrders(orders.filter(o => o.id !== orderId))
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null)
      }
    } catch (err: any) {
      console.error("❌ Failed to unarchive order:", err)
      alert(err.response?.data?.message || "Failed to unarchive order")
    } finally {
      setUnarchiving(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysArchived = (archivedAt: string) => {
    const now = new Date()
    const archived = new Date(archivedAt)
    const diffTime = Math.abs(now.getTime() - archived.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="w-6 h-6 text-orange-600" />
            <div>
              <h2 className="text-2xl font-bold tracking-wider">ARCHIVED ORDERS</h2>
              <p className="text-sm text-gray-600 mt-1">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'} archived
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadArchivedOrders}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
              <button
                onClick={loadArchivedOrders}
                className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
              >
                Try Again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No archived orders</p>
              <p className="text-gray-500 text-sm mt-2">
                Orders are automatically archived 7 days after delivery
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-bold text-lg">#{order.id}</span>
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                          {order.order_status || order.status}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500 text-sm">
                          <Clock className="w-4 h-4" />
                          {getDaysArchived(order.archived_at || order.updated_at || new Date().toISOString())} days archived
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <p className="text-gray-600">Customer</p>
                          <p className="font-medium">
                            {order.customer_name || order.shipping_address?.fullName || 'Guest'}
                          </p>
                          <p className="text-gray-500 text-xs">{order.user_email || order.shipping_address?.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Total Amount</p>
                          <p className="font-bold text-lg">
                            ₹{(typeof order.total === 'number' ? order.total : typeof order.total === 'string' ? parseFloat(order.total) : order.total_price || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Ordered: {formatDate(order.created_at)}
                        </span>
                        {order.delivered_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Delivered: {formatDate(order.delivered_at)}
                          </span>
                        )}
                        {(order.archived_at || order.updated_at) && (
                          <span className="flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            Archived: {formatDate(order.archived_at || order.updated_at!)}
                          </span>
                        )}
                      </div>

                      {/* Order Items Preview */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-600 mb-2">
                          {order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'}
                        </p>
                        <div className="space-y-1">
                          {order.order_items.slice(0, 2).map((item, idx) => {
                            const itemPrice = typeof item.price === 'number' ? item.price : (typeof item.price === 'string' ? parseFloat(item.price) : item.pricePerItem || 0)
                            const itemQty = typeof item.quantity === 'number' ? item.quantity : (typeof item.quantity === 'string' ? parseInt(item.quantity) : 1)
                            return (
                              <div key={idx} className="text-sm text-gray-700 flex justify-between">
                                <span>
                                  {item.name} {item.size && `(${item.size})`} × {itemQty}
                                </span>
                                <span className="font-medium">₹{(itemPrice * itemQty).toLocaleString()}</span>
                              </div>
                            )
                          })}
                          {order.order_items.length > 2 && (
                            <p className="text-xs text-gray-500">
                              +{order.order_items.length - 2} more items
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Unarchive Button */}
                    <button
                      onClick={() => handleUnarchive(order.id)}
                      disabled={unarchiving === order.id}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                      {unarchiving === order.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Restoring...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Unarchive
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
