import { useState, useEffect } from 'react';
import { Package, Search, Filter, Calendar, DollarSign, User, MapPin, Phone, Mail, Truck, X, Check, Clock, AlertCircle, RefreshCw, Download, Eye, Trash, Archive, ArchiveRestore } from 'lucide-react';
import { adminAPI } from '../services/api';
import { ArchivedOrdersPanel } from './ArchivedOrdersPanel';

interface OrderItem {
  productId: string;
  productName: string;
  variant: {
    size: string;
    color: string;
  };
  quantity: number;
  pricePerItem: number;
  lineTotal: number;
  image?: string;
}

interface Order {
  id: string;
  order_number: string;
  user_id?: string;
  guest_uuid?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_items: OrderItem[];
  shipping_address: any;
  contact_details: any;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  tax: number;
  delivery_charge: number;
  discount: number;
  total_price: number;
  currency: string;
  order_status: string;
  status_history: Array<{ status: string; timestamp: string; note: string }>;
  tracking_number?: string;
  estimated_delivery_date: string;
  actual_delivery_date?: string;
  delivery_notes?: string;
  cancellation_reason?: string;
  refund_amount?: number;
  refund_status?: string;
  created_at: string;
  updated_at: string;
  is_paid: boolean;
  is_delivered: boolean;
  // Return/Refund/Exchange fields
  return_requested?: boolean;
  return_status?: string;
  return_request?: {
    reasons: string[];
    refundMethod: string;
    refundDetails?: any;
  };
  refund_method?: string;
  refund_upi_id?: string;
  exchange_requested?: boolean;
  exchange_status?: string;
}

export function AdminOrdersPanel() {
  // PERSISTENCE: Restore filters from localStorage
  const getInitialFilters = () => {
    const saved = localStorage.getItem('adminOrders_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('📋 Restored order filters from localStorage:', parsed);
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
    return {
      searchQuery: '',
      statusFilter: 'all',
      paymentFilter: 'all',
      paymentMethodFilter: 'all'
    };
  };
  
  const initialFilters = getInitialFilters();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilters.statusFilter);
  const [paymentFilter, setPaymentFilter] = useState<string>(initialFilters.paymentFilter);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>(initialFilters.paymentMethodFilter);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundFormData, setRefundFormData] = useState({
    orderId: '',
    refundAmount: 0,
    refundPaymentMode: 'bank',
    refundBankName: '',
    refundAccountNumber: '',
    refundIfscCode: '',
    refundUpiId: '',
    refundTransactionId: '',
    refundTransactionDate: new Date().toISOString().split('T')[0],
    refundNotes: ''
  });
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showArchivedPanel, setShowArchivedPanel] = useState(false);
  const [isArchivingOld, setIsArchivingOld] = useState(false);

  // Status options
  const statusOptions = [
    'Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 
    'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'
  ];

  const paymentStatusOptions = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'];

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, statusFilter, paymentFilter, paymentMethodFilter]);
  
  // PERSISTENCE: Save filter state to localStorage whenever filters change
  useEffect(() => {
    const filters = {
      searchQuery,
      statusFilter,
      paymentFilter,
      paymentMethodFilter
    };
    localStorage.setItem('adminOrders_filters', JSON.stringify(filters));
    console.log('💾 Saved order filters to localStorage:', filters);
  }, [searchQuery, statusFilter, paymentFilter, paymentMethodFilter]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 [AdminOrders] Fetching fresh orders from /api/admin/orders...');
      const response = await adminAPI.getAllOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page: 1,
        limit: 100,
      });
      
      if (response.status === 'success' && response.data?.orders) {
        console.log('✅ [AdminOrders] Loaded', response.data.orders.length, 'orders from database');
        setOrders(response.data.orders);
      } else {
        console.error('❌ [AdminOrders] Failed to load orders:', response);
        setOrders([]);
      }
    } catch (error) {
      console.error('❌ [AdminOrders] Error fetching orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(order => 
        order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_phone?.includes(searchQuery)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.order_status === statusFilter);
    }

    // Payment status filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(order => order.payment_status === paymentFilter);
    }

    // Payment method filter (COD vs Prepaid)
    if (paymentMethodFilter !== 'all') {
      if (paymentMethodFilter === 'cod') {
        filtered = filtered.filter(order => order.payment_method === 'COD');
      } else if (paymentMethodFilter === 'prepaid') {
        filtered = filtered.filter(order => order.payment_method !== 'COD' && order.payment_method);
      }
    }

    setFilteredOrders(filtered);
  };

  const handleCleanupDeliveredOrders = async () => {
    const deliveredOrders = orders.filter(o => o.order_status === 'Delivered');
    
    if (deliveredOrders.length === 0) {
      alert('ℹ️ No delivered orders to clean up.');
      return;
    }

    try {
      setIsCleaningUp(true);
      console.log(`🗑️ Cleaning up ${deliveredOrders.length} delivered orders...`);
      
      // Delete each delivered order
      const deletePromises = deliveredOrders.map(order => 
        adminAPI.deleteCompletedOrder(order.id)
          .catch(err => console.error('Failed to delete order:', order.id, err))
      );
      
      await Promise.all(deletePromises);
      
      console.log('✅ Delivered orders cleaned up successfully');
      alert(`✅ Successfully deleted ${deliveredOrders.length} delivered orders!`);
      setShowCleanupConfirm(false);
      await fetchOrders(); // Refresh the orders list
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      alert('❌ Failed to cleanup delivered orders. Please try again.');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, note?: string) => {
    try {
      setIsUpdating(true);
      console.log('🔄 Updating order status:', orderId, 'to', newStatus);
      const response = await adminAPI.updateOrderStatus(orderId, newStatus, note);
      
      // Refresh orders to get latest data from database
      await fetchOrders();
      
      console.log('✅ Order status updated successfully');
      alert(`✅ Order status updated to: ${newStatus}\n\n📧 Email and SMS notifications sent to customer.`);
    } catch (error: any) {
      console.error('❌ Error updating order:', error);
      
      // Display more specific error message
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update order status';
      
      if (errorMessage.includes('check constraint')) {
        alert('❌ Invalid order status!\n\nPlease select a valid status from the dropdown.\n\nValid statuses:\n- Pending\n- Confirmed\n- Processing\n- Packed\n- Shipped\n- Out for Delivery\n- Delivered\n- Cancelled\n- Returned\n- Refunded');
      } else if (errorMessage.includes('validStatuses')) {
        // Backend returned list of valid statuses
        const validStatuses = error?.response?.data?.validStatuses?.join('\n- ') || '';
        alert(`❌ Invalid order status!\n\nValid statuses:\n- ${validStatuses}`);
      } else {
        alert(`❌ Failed to update order status\n\n${errorMessage}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApproveReturn = async (orderId: string, refundAmount: number) => {
    // Show refund modal to collect payment details
    setRefundFormData({
      orderId: orderId,
      refundAmount: refundAmount,
      refundPaymentMode: selectedOrder?.return_request?.refundMethod || 'bank',
      refundBankName: selectedOrder?.return_request?.refundDetails?.bankDetails?.bankName || '',
      refundAccountNumber: selectedOrder?.return_request?.refundDetails?.bankDetails?.accountNumber || '',
      refundIfscCode: selectedOrder?.return_request?.refundDetails?.bankDetails?.ifscCode || '',
      refundUpiId: selectedOrder?.return_request?.refundDetails?.upiId || '',
      refundTransactionId: '',
      refundTransactionDate: new Date().toISOString().split('T')[0],
      refundNotes: ''
    });
    setShowRefundModal(true);
  };

  const submitRefundApproval = async () => {
    if (refundFormData.refundPaymentMode === 'bank' && (!refundFormData.refundBankName || !refundFormData.refundAccountNumber || !refundFormData.refundIfscCode)) {
      alert('❌ Please fill in all bank details');
      return;
    }
    if (refundFormData.refundPaymentMode === 'upi' && !refundFormData.refundUpiId) {
      alert('❌ Please enter UPI ID');
      return;
    }
    if (!refundFormData.refundTransactionId) {
      alert('❌ Please enter transaction ID');
      return;
    }

    try {
      setIsUpdating(true);
      console.log('🔄 Approving return with refund details:', refundFormData);
      
      const response = await adminAPI.approveReturn(
        refundFormData.orderId,
        refundFormData.refundAmount,
        refundFormData.refundNotes,
        refundFormData
      );
      
      await fetchOrders();
      setSelectedOrder(null);
      setShowRefundModal(false);
      
      console.log('✅ Return approved with refund details');
      alert('✅ Return Approved & Refund Processed!\n\n📧 Customer will receive email and SMS notifications.\n💰 Refund details saved.');
    } catch (error: any) {
      console.error('❌ Error approving return:', error);
      alert(`❌ Failed to approve return\n\n${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectReturn = async (orderId: string) => {
    const reason = window.prompt('Enter reason for rejection (optional):');
    
    const confirmed = window.confirm(
      `Reject return request?\n\nThis action:\n❌ Will reject the return\n📧 Send notification to customer\n\nContinue?`
    );
    
    if (!confirmed) return;

    try {
      setIsUpdating(true);
      console.log('🔄 Rejecting return for order:', orderId);
      
      // You'll need to add this endpoint
      const response = await adminAPI.rejectReturn(orderId, reason || 'Return request rejected');
      
      await fetchOrders();
      setSelectedOrder(null);
      
      console.log('✅ Return rejected');
      alert('✅ Return Rejected\n\n📧 Customer will be notified via email and SMS.');
    } catch (error: any) {
      console.error('❌ Error rejecting return:', error);
      alert(`❌ Failed to reject return\n\n${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApproveExchange = async (orderId: string) => {
    const notes = window.prompt('Enter notes for exchange approval (optional):');
    const confirmed = window.confirm(
      `Approve exchange request?\n\nThis will mark the exchange as approved and notify the customer.\n\nContinue?`
    );
    if (!confirmed) return;
    try {
      setIsUpdating(true);
      await adminAPI.approveExchange(orderId, notes || undefined);
      await fetchOrders();
      setSelectedOrder(null);
      alert('✅ Exchange Approved\n\n📱 Customer will be notified via SMS.');
    } catch (error: any) {
      console.error('❌ Error approving exchange:', error);
      alert(`❌ Failed to approve exchange\n\n${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectExchange = async (orderId: string) => {
    const reason = window.prompt('Enter reason for rejection (optional):');
    const confirmed = window.confirm(
      `Reject exchange request?\n\nThis will reject the exchange and notify the customer.\n\nContinue?`
    );
    if (!confirmed) return;
    try {
      setIsUpdating(true);
      await adminAPI.rejectExchange(orderId, reason || undefined);
      await fetchOrders();
      setSelectedOrder(null);
      alert('✅ Exchange Rejected\n\n📱 Customer will be notified via SMS.');
    } catch (error: any) {
      console.error('❌ Error rejecting exchange:', error);
      alert(`❌ Failed to reject exchange\n\n${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Confirmed': 'bg-blue-100 text-blue-800',
      'Processing': 'bg-indigo-100 text-indigo-800',
      'Packed': 'bg-purple-100 text-purple-800',
      'Shipped': 'bg-cyan-100 text-cyan-800',
      'Out for Delivery': 'bg-teal-100 text-teal-800',
      'Delivered': 'bg-green-100 text-green-800',
      'Cancelled': 'bg-red-100 text-red-800',
      'Returned': 'bg-orange-100 text-orange-800',
      'Refunded': 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'paid': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800',
      'refunded': 'bg-purple-100 text-purple-800',
      'partially_refunded': 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleArchiveOldOrders = async () => {
    const oldDelivered = orders.filter(o => {
      if (o.order_status !== 'Delivered') return false;
      const updatedAt = new Date(o.updated_at || o.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return updatedAt <= sevenDaysAgo;
    });

    if (oldDelivered.length === 0) {
      alert('ℹ️ No delivered orders older than 7 days found to archive.');
      return;
    }

    if (!confirm(`Archive ${oldDelivered.length} delivered order(s) that are 7+ days old? They will be moved to the Archived Orders panel.`)) return;

    try {
      setIsArchivingOld(true);
      const result = await adminAPI.archiveOldOrders();
      alert(`✅ ${result.archived || oldDelivered.length} order(s) archived successfully!`);
      await fetchOrders();
    } catch (error: any) {
      console.error('❌ Error archiving old orders:', error);
      alert('❌ Failed to archive old orders: ' + (error?.response?.data?.message || error?.message || 'Unknown error'));
    } finally {
      setIsArchivingOld(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Order Number', 'Date', 'Customer', 'Email', 'Phone', 'Total', 'Status', 'Payment'];
    const rows = filteredOrders.map(order => [
      order.order_number,
      new Date(order.created_at).toLocaleDateString(),
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      `${order.currency}${order.total_price}`,
      order.order_status,
      order.payment_status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-light tracking-wider mb-2">ORDERS MANAGEMENT</h1>
          <p className="text-neutral-600">View and manage all customer orders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Total Orders</p>
                <p className="text-3xl font-light">{orders.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Pending</p>
                <p className="text-3xl font-light">
                  {orders.filter(o => ['Pending', 'Confirmed', 'Processing'].includes(o.order_status)).length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">In Transit</p>
                <p className="text-3xl font-light">
                  {orders.filter(o => ['Packed', 'Shipped', 'Out for Delivery'].includes(o.order_status)).length}
                </p>
              </div>
              <Truck className="w-8 h-8 text-indigo-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Delivered</p>
                <p className="text-3xl font-light">
                  {orders.filter(o => o.order_status === 'Delivered').length}
                </p>
              </div>
              <Check className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-emerald-50 p-6 rounded-lg shadow-sm border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-700 font-semibold">Total Revenue</p>
                <p className="text-3xl font-light text-emerald-900">
                  ₹{orders.reduce((sum, o) => sum + (o.total_price || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-purple-50 p-6 rounded-lg shadow-sm border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-semibold">💵 COD Orders</p>
                <p className="text-3xl font-light text-purple-900">
                  {orders.filter(o => o.payment_method === 'COD').length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-orange-50 p-6 rounded-lg shadow-sm border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 font-semibold">💳 Prepaid Orders</p>
                <p className="text-3xl font-light text-orange-900">
                  {orders.filter(o => o.payment_method !== 'COD' && o.payment_method).length}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-red-50 p-6 rounded-lg shadow-sm border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-semibold">Cancelled</p>
                <p className="text-3xl font-light text-red-900">
                  {orders.filter(o => o.order_status === 'Cancelled').length}
                </p>
              </div>
              <X className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-amber-50 p-6 rounded-lg shadow-sm border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 font-semibold">Returned/Refunded</p>
                <p className="text-3xl font-light text-amber-900">
                  {orders.filter(o => ['Returned', 'Refunded'].includes(o.order_status)).length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search orders, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="all">All Payment Status</option>
              {paymentStatusOptions.map(status => (
                <option key={status} value={status}>{status.toUpperCase()}</option>
              ))}
            </select>

            {/* Payment Method Filter (COD vs Prepaid) */}
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-purple-50"
            >
              <option value="all">All Payment Methods</option>
              <option value="cod">💵 COD Only</option>
              <option value="prepaid">💳 Prepaid Only</option>
            </select>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowArchivedPanel(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                title="View archived orders"
              >
                <Archive className="w-4 h-4" />
                Archived
              </button>
              <button
                onClick={handleArchiveOldOrders}
                disabled={isArchivingOld}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 text-sm"
                title="Archive delivered orders 7+ days old"
              >
                {isArchivingOld ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                Archive Old
              </button>
              <button
                onClick={() => setShowCleanupConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                title="Delete all delivered orders"
              >
                <Trash className="w-4 h-4" />
                Cleanup
              </button>
              <button
                onClick={fetchOrders}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Cleanup Confirmation Modal */}
        {showCleanupConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <Trash className="w-8 h-8" />
                <h2 className="text-2xl tracking-wider">CLEANUP DELIVERED ORDERS</h2>
              </div>
              <p className="mb-6 text-neutral-700">
                This will <strong>permanently delete all DELIVERED orders</strong> from the database. 
                <br/><br/>
                Orders found: <strong className="text-red-600">{orders.filter(o => o.order_status === 'Delivered').length}</strong>
                <br/><br/>
                This action cannot be undone!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCleanupDeliveredOrders}
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

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Return/Refund</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-neutral-500">
                      <Package className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                      <p className="text-lg">No orders found</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{order.order_number || order.id.slice(0, 8)}</p>
                          <p className="text-xs text-neutral-500">{order.user_id ? 'User' : 'Guest'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-xs text-neutral-500">{order.customer_email}</p>
                          <p className="text-xs text-neutral-500">{order.customer_phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{order.order_items?.length || 0} items</p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{order.currency}{order.total_price.toFixed(2)}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {order.payment_method === 'COD' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                                💵 COD
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">
                                💳 {order.payment_method || 'Prepaid'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.return_requested || order.return_status ? (
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              order.return_status === 'approved' ? 'bg-green-100 text-green-800' :
                              order.return_status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.return_status || 'requested'}
                            </span>
                            {order.return_request?.refundMethod && (
                              <p className="text-xs text-neutral-600">
                                via {order.return_request.refundMethod}
                              </p>
                            )}
                            {order.return_request?.refundDetails?.upiId && (
                              <p className="text-xs text-neutral-500 font-mono">
                                {order.return_request.refundDetails.upiId}
                              </p>
                            )}
                          </div>
                        ) : order.exchange_requested || order.exchange_status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            order.exchange_status === 'approved' ? 'bg-blue-100 text-blue-800' :
                            order.exchange_status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            Exchange: {order.exchange_status || 'requested'}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-neutral-500">{new Date(order.created_at).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-light tracking-wider">ORDER DETAILS</h2>
                <p className="text-sm text-neutral-600">{selectedOrder.order_number}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-lg flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Customer Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-neutral-600">Name:</span> {selectedOrder.customer_name}</p>
                    <p><span className="text-neutral-600">Email:</span> {selectedOrder.customer_email}</p>
                    <p><span className="text-neutral-600">Phone:</span> {selectedOrder.customer_phone}</p>
                    <p><span className="text-neutral-600">Type:</span> {selectedOrder.user_id ? 'Registered User' : 'Guest Checkout'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Shipping Address
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p>{selectedOrder.shipping_address.fullName}</p>
                    <p>{selectedOrder.shipping_address.doorNo}, {selectedOrder.shipping_address.street}</p>
                    <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state}</p>
                    <p>PIN: {selectedOrder.shipping_address.pinCode}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Items
                </h3>
                <div className="space-y-3">
                  {selectedOrder.order_items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg">
                      {item.image && (
                        <img src={item.image} alt={item.productName} className="w-16 h-16 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-neutral-600">
                          Size: {item.variant.size} {item.variant.color && `• Color: ${item.variant.color}`}
                        </p>
                        <p className="text-sm text-neutral-600">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{selectedOrder.currency}{item.lineTotal.toFixed(2)}</p>
                        <p className="text-xs text-neutral-600">{selectedOrder.currency}{item.pricePerItem.toFixed(2)} each</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Order Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Subtotal:</span>
                    <span>{selectedOrder.currency}{selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Tax (GST):</span>
                    <span>{selectedOrder.currency}{selectedOrder.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Delivery Charge:</span>
                    <span>{selectedOrder.currency}{selectedOrder.delivery_charge.toFixed(2)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-{selectedOrder.currency}{selectedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-neutral-200">
                    <span>Total:</span>
                    <span>{selectedOrder.currency}{selectedOrder.total_price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="font-medium text-lg mb-4">Update Order Status</h3>
                <div className="flex gap-2 flex-wrap">
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(selectedOrder.id, status)}
                      disabled={isUpdating || status === selectedOrder.order_status}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        status === selectedOrder.order_status
                          ? 'bg-black text-white cursor-not-allowed'
                          : 'bg-neutral-100 hover:bg-neutral-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Return/Exchange Request Handling */}
              {(selectedOrder.return_requested || selectedOrder.exchange_requested) && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    {selectedOrder.return_requested ? 'Return' : 'Exchange'} Request
                  </h3>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-neutral-700">Status:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedOrder.return_status === 'approved' || selectedOrder.exchange_status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : selectedOrder.return_status === 'rejected' || selectedOrder.exchange_status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedOrder.return_status || selectedOrder.exchange_status || 'Pending'}
                        </span>
                      </div>
                      
                      {selectedOrder.return_request && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-neutral-700">Reasons:</span>
                            <span className="text-sm text-neutral-600">{selectedOrder.return_request.reasons?.join(', ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-neutral-700">Refund Method:</span>
                            <span className="text-sm text-neutral-600 font-medium">{selectedOrder.return_request.refundMethod}</span>
                          </div>
                          {selectedOrder.return_request.refundDetails?.upiId && (
                            <div className="flex justify-between">
                              <span className="text-sm font-medium text-neutral-700">UPI ID:</span>
                              <span className="text-sm text-neutral-600 font-mono">{selectedOrder.return_request.refundDetails.upiId}</span>
                            </div>
                          )}
                          {selectedOrder.return_request.refundDetails?.bankDetails && (
                            <div className="space-y-1 mt-2 pt-2 border-t border-yellow-300">
                              <div className="text-xs font-medium text-neutral-700">Bank Details:</div>
                              <div className="text-xs text-neutral-600">
                                <div>Account: {selectedOrder.return_request.refundDetails.bankDetails.accountNumber}</div>
                                <div>IFSC: {selectedOrder.return_request.refundDetails.bankDetails.ifscCode}</div>
                                <div>Name: {selectedOrder.return_request.refundDetails.bankDetails.accountHolderName}</div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {(selectedOrder.return_status === 'requested' || !selectedOrder.return_status) && selectedOrder.return_requested && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApproveReturn(selectedOrder.id, selectedOrder.total_price)}
                        disabled={isUpdating}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Approve Return & Initiate Refund
                      </button>
                      <button
                        onClick={() => handleRejectReturn(selectedOrder.id)}
                        disabled={isUpdating}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Reject Return
                      </button>
                    </div>
                  )}

                  {(selectedOrder.exchange_status === 'requested' || !selectedOrder.exchange_status) && selectedOrder.exchange_requested && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApproveExchange(selectedOrder.id)}
                        disabled={isUpdating}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Approve Exchange
                      </button>
                      <button
                        onClick={() => handleRejectExchange(selectedOrder.id)}
                        disabled={isUpdating}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Reject Exchange
                      </button>
                    </div>
                  )}

                  {(selectedOrder.return_status === 'approved' || selectedOrder.exchange_status === 'approved') && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                      <p className="font-medium">✅ Request approved</p>
                      <p className="text-xs mt-1">
                        {selectedOrder.return_requested 
                          ? `Refund of ₹${selectedOrder.refund_amount || selectedOrder.total_price} will be processed to ${selectedOrder.return_request?.refundMethod}`
                          : 'Exchange process initiated'}
                      </p>
                    </div>
                  )}

                  {(selectedOrder.return_status === 'rejected' || selectedOrder.exchange_status === 'rejected') && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                      <p className="font-medium">❌ Request rejected</p>
                    </div>
                  )}
                </div>
              )}

              {/* Status History */}
              {selectedOrder.status_history && selectedOrder.status_history.length > 0 && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Status History
                  </h3>
                  <div className="space-y-3">
                    {selectedOrder.status_history.map((history, index) => (
                      <div key={index} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-black mt-2"></div>
                        <div className="flex-1">
                          <p className="font-medium">{history.status}</p>
                          <p className="text-neutral-600">{new Date(history.timestamp).toLocaleString()}</p>
                          {history.note && <p className="text-neutral-500 text-xs">{history.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Refund Payment Details Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-light tracking-wider">REFUND PAYMENT DETAILS</h2>
                <p className="text-sm text-neutral-600">Enter refund transaction details</p>
              </div>
              <button onClick={() => setShowRefundModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900">Refund Amount: ₹{refundFormData.refundAmount}</p>
                <p className="text-xs text-blue-700 mt-1">Order ID: {refundFormData.orderId}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Refund Method *</label>
                  <select
                    value={refundFormData.refundPaymentMode}
                    onChange={(e) => setRefundFormData({ ...refundFormData, refundPaymentMode: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                {refundFormData.refundPaymentMode === 'bank' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Bank Name *</label>
                      <input
                        type="text"
                        value={refundFormData.refundBankName}
                        onChange={(e) => setRefundFormData({ ...refundFormData, refundBankName: e.target.value })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="e.g., HDFC Bank"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Account Number *</label>
                      <input
                        type="text"
                        value={refundFormData.refundAccountNumber}
                        onChange={(e) => setRefundFormData({ ...refundFormData, refundAccountNumber: e.target.value })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">IFSC Code *</label>
                      <input
                        type="text"
                        value={refundFormData.refundIfscCode}
                        onChange={(e) => setRefundFormData({ ...refundFormData, refundIfscCode: e.target.value })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="e.g., HDFC0001234"
                      />
                    </div>
                  </>
                )}

                {refundFormData.refundPaymentMode === 'upi' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">UPI ID *</label>
                    <input
                      type="text"
                      value={refundFormData.refundUpiId}
                      onChange={(e) => setRefundFormData({ ...refundFormData, refundUpiId: e.target.value })}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="e.g., customer@upi"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Transaction ID *</label>
                  <input
                    type="text"
                    value={refundFormData.refundTransactionId}
                    onChange={(e) => setRefundFormData({ ...refundFormData, refundTransactionId: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Enter transaction/reference ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Transaction Date *</label>
                  <input
                    type="date"
                    value={refundFormData.refundTransactionDate}
                    onChange={(e) => setRefundFormData({ ...refundFormData, refundTransactionDate: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={refundFormData.refundNotes}
                    onChange={(e) => setRefundFormData({ ...refundFormData, refundNotes: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    rows={3}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-neutral-200">
                <button
                  onClick={() => setShowRefundModal(false)}
                  disabled={isUpdating}
                  className="flex-1 bg-neutral-100 text-neutral-700 px-6 py-3 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRefundApproval}
                  disabled={isUpdating}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdating ? 'Processing...' : (
                    <>
                      <Check className="w-5 h-5" />
                      Approve Return & Process Refund
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archived Orders Panel */}
      {showArchivedPanel && (
        <ArchivedOrdersPanel onClose={() => setShowArchivedPanel(false)} />
      )}
    </div>
  );
}
