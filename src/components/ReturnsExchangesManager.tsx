"use client"

import { useState, useEffect } from "react"
import { RotateCcw, Search, Filter, CheckCircle, XCircle, Clock, Package, AlertCircle } from "lucide-react"
import api, { returnsAPI } from '../services/api'

interface ReturnRequest {
  id: string
  orderId: string
  customerName: string
  customerEmail: string
  items: Array<{
    name: string
    quantity: number
    price: number
    reason: string
  }>
  totalRefundAmount: number
  status: 'pending' | 'approved' | 'rejected' | 'picked_up' | 'received' | 'inspected' | 'refunded'
  returnReason: string
  returnType: 'refund' | 'exchange' | 'store_credit'
  refundMethod: 'original' | 'store_credit' | 'bank_transfer'
  createdAt: string
  updatedAt: string
  inspectionNotes?: string
  pickupScheduled?: string
  slaDeadline?: string
  trackingNumber?: string
  carrierName?: string
  returnItemsRaw?: any[]
  priorityFlag?: boolean
  refundTransactionId?: string
  refundCompletedAt?: string
}

interface ReturnsExchangesManagerProps {
  onClose: () => void
}

export function ReturnsExchangesManager({ onClose }: ReturnsExchangesManagerProps) {
  const [returns, setReturns] = useState<ReturnRequest[]>([])
  const [filteredReturns, setFilteredReturns] = useState<ReturnRequest[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null)
  const [inspectionNotes, setInspectionNotes] = useState("")
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [pendingApprovalReturnId, setPendingApprovalReturnId] = useState<string | null>(null)
  const [showPickupModal, setShowPickupModal] = useState(false)
  const [pickupReturnId, setPickupReturnId] = useState<string | null>(null)
  const [pickupDetails, setPickupDetails] = useState({ carrier: '', trackingNumber: '' })
  const [bankVerified, setBankVerified] = useState(false)
  const [selectedRefundMethod, setSelectedRefundMethod] = useState<string>('original_payment_method')
  const [refundDetails, setRefundDetails] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
    adminNotes: '',
    selectedUpiApp: ''
  })

  useEffect(() => {
    loadReturns()
  }, [])

  useEffect(() => {
    filterReturns()
  }, [returns, searchQuery, statusFilter])

  const loadReturns = async () => {
    try {
      const data = await returnsAPI.getAllReturns();
      if (data.status === 'success' && data.data?.returns) {
        console.log('✅ Loaded returns from backend:', data.data.returns.length);
        // Transform DB snake_case fields to match the frontend ReturnRequest interface
        const transformed: ReturnRequest[] = data.data.returns.map((r: any) => ({
          id: r.id,
          orderId: r.order_id,
          customerName: r.customer_name || r.orders?.customer_name || r.users?.name || 'Guest User',
          customerEmail: r.customer_email || r.orders?.customer_email || r.users?.email || 'N/A',
          items: Array.isArray(r.return_items)
            ? r.return_items.map((item: any) => ({
                name: item.product_name || item.productName || item.name || 'Product',
                quantity: item.quantity || 1,
                price: item.price || 0,
                reason: item.reason || r.reason || ''
              }))
            : [],
          totalRefundAmount: r.refund_amount || 0,
          status: r.status === 'requested' ? 'pending' : (r.status || 'pending'),
          returnReason: r.reason || '',
          returnType: (r.return_type as ReturnRequest['returnType']) || 'refund',
          refundMethod: (r.refund_method as ReturnRequest['refundMethod']) || 'original',
          createdAt: r.created_at,
          updatedAt: r.updated_at || r.created_at,
          inspectionNotes: r.admin_notes || undefined,
          pickupScheduled: r.pickup_scheduled || undefined,
          slaDeadline: r.sla_deadline || undefined,
          trackingNumber: r.tracking_number || undefined,
          carrierName: r.carrier_name || undefined,
          returnItemsRaw: Array.isArray(r.return_items) ? r.return_items : [],
          priorityFlag: Boolean(r.priority_flag),
          refundTransactionId: r.refund_transaction_id || undefined,
          refundCompletedAt: r.refund_completed_at || undefined,
        }));
        setReturns(transformed);
        return;
      }
      console.warn('⚠️ Failed to load returns from backend, using localStorage fallback');
    } catch (error) {
      console.error('❌ Error loading returns from backend:', error);
    }

    // Fallback to localStorage if API fails
    const storedReturns = localStorage.getItem('returnRequests')
    if (storedReturns) {
      setReturns(JSON.parse(storedReturns))
    } else {
      // Initialize with sample data
      const sampleReturns: ReturnRequest[] = [
        {
          id: 'RET001',
          orderId: 'ORD12345',
          customerName: 'Priya Sharma',
          customerEmail: 'priya@example.com',
          items: [
            { name: 'Silk Saree - Red', quantity: 1, price: 2999, reason: 'Wrong size' }
          ],
          totalRefundAmount: 2999,
          status: 'pending',
          returnReason: 'Size too small, need larger size',
          returnType: 'exchange',
          refundMethod: 'original',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'RET002',
          orderId: 'ORD12346',
          customerName: 'Anjali Reddy',
          customerEmail: 'anjali@example.com',
          items: [
            { name: 'Designer Kurti - Blue', quantity: 1, price: 1499, reason: 'Damaged product' }
          ],
          totalRefundAmount: 1499,
          status: 'approved',
          returnReason: 'Product arrived with stains',
          returnType: 'refund',
          refundMethod: 'original',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          pickupScheduled: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
      setReturns(sampleReturns)
      localStorage.setItem('returnRequests', JSON.stringify(sampleReturns))
    }
  }

  const filterReturns = () => {
    let filtered = [...returns]

    if (statusFilter !== "all") {
      filtered = filtered.filter(ret => ret.status === statusFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(ret =>
        ret.id.toLowerCase().includes(query) ||
        ret.orderId.toLowerCase().includes(query) ||
        ret.customerName.toLowerCase().includes(query) ||
        ret.customerEmail.toLowerCase().includes(query)
      )
    }

    setFilteredReturns(filtered)
  }

  const updateReturnStatus = async (
    returnId: string,
    newStatus: ReturnRequest['status'],
    notes: string = '',
    refundMethodOverride?: string,
    paymentDetails?: {
      upiId?: string
      selectedUpiApp?: string
      accountNumber?: string
      ifscCode?: string
      accountHolderName?: string
      bankName?: string
    }
  ) => {
    // Map frontend status names to backend status names
    const backendStatus = newStatus === 'pending' ? 'requested' : newStatus;
    let responseData: any = null
    try {
      if (newStatus === 'approved' || newStatus === 'rejected') {
        // Approve/reject must go through the orders endpoint so it updates BOTH
        // the orders table and the returns table (synced refund + SMS logic).
        const returnRecord = returns.find(r => r.id === returnId);
        if (!returnRecord) throw new Error(`Return record ${returnId} not found in local state`);
        const orderId = (returnRecord as any).orderId || (returnRecord as any).order_id;
        const returnType = (returnRecord as any).returnType || (returnRecord as any).return_type;
        console.log('[UpdateStatus] orderId:', orderId, 'returnId:', returnId, 'action:', newStatus === 'approved' ? 'approve' : 'reject');
        if (!orderId) {
          console.error('[UpdateStatus] orderId is undefined - cannot call approve/reject');
          throw new Error('Order ID missing from return record');
        }
        // Decide endpoint based on returnType
        const isExchange = returnType === 'exchange';
        const action = newStatus === 'approved' ? 'approve' : 'reject';
        const resource = isExchange ? 'exchange' : 'return';
        const apiResponse = await api.put(`/orders/${orderId}/${resource}/${action}`, {
          adminNotes: notes,
          notes: notes,
          refundMethod: refundMethodOverride || selectedRefundMethod,
          rejectionReason: notes,
          refundUpiId: paymentDetails?.upiId,
          selectedUpiApp: paymentDetails?.selectedUpiApp,
          refundAccountNumber: paymentDetails?.accountNumber,
          refundIfscCode: paymentDetails?.ifscCode,
          refundBankName: paymentDetails?.bankName,
        });
        responseData = apiResponse?.data
      } else {
        // All other intermediate statuses (picked_up, received, inspected, refunded)
        // only need to update the returns table — use the returns endpoint.
        await returnsAPI.updateReturnStatus(returnId, backendStatus, notes);
      }
    } catch (err) {
      console.error('❌ Failed to update return status in backend:', err);
      alert(`Failed to update status: ${err instanceof Error ? err.message : String(err)}`);
      return; // Stop here — do NOT update UI if backend call failed
    }

    const updatedReturns = returns.map(ret => {
      if (ret.id === returnId) {
        return {
          ...ret,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...(notes && { inspectionNotes: notes })
        }
      }
      return ret
    })

    setReturns(updatedReturns)
    localStorage.setItem('returnRequests', JSON.stringify(updatedReturns))
    console.log('[ReturnStatus] UI updated - order page will reflect on next user fetch')
    window.dispatchEvent(new CustomEvent('returns-status-updated'))

    // If refunded, update order status in orders
    if (newStatus === 'refunded') {
      const returnReq = updatedReturns.find(r => r.id === returnId)
      if (returnReq) {
        updateOrderStatus(returnReq.orderId, 'refunded')
      }
    }

    if (newStatus === 'approved') {
      const paymentMsg = responseData?.paymentMessage || ''
      const successMessage = paymentMsg
        ? `Return approved!\n\n${paymentMsg}`
        : 'Return approved successfully!'
      alert(successMessage)
    }

    return responseData
  }

  const updateOrderStatus = (orderId: string, status: string) => {
    // Update order status in localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('fashionOrders_user_')) {
        try {
          const userOrders = JSON.parse(localStorage.getItem(key) || '[]')
          const updatedUserOrders = userOrders.map((order: any) => {
            if (order.orderId === orderId || order.id === orderId) {
              return { ...order, status, updatedAt: new Date().toISOString() }
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

  const approveReturn = (returnId: string) => {
    const returnRecord = returns.find(r => r.id === returnId)
    if (!returnRecord) return

    setPendingApprovalReturnId(returnRecord.id)
    setSelectedRefundMethod(((returnRecord as any).refund_method || returnRecord.refundMethod || 'original_payment_method') as string)
    setRefundDetails({
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      upiId: '',
      adminNotes: '',
      selectedUpiApp: ''
    })
    setBankVerified(false)
    setShowRefundModal(true)
  }

  const rejectReturn = (returnId: string) => {
    const reason = prompt('Enter reason for rejection:')
    if (reason) {
      updateReturnStatus(returnId, 'rejected', reason)
      alert('Return rejected. Customer will be notified.')
    }
  }

  const markAsReceived = (returnId: string) => {
    updateReturnStatus(returnId, 'received')
    setSelectedReturn(returns.find(r => r.id === returnId) || null)
  }

  const completeInspection = (returnId: string, approved: boolean) => {
    if (approved) {
      updateReturnStatus(returnId, 'inspected', inspectionNotes)
      alert('Inspection complete. Return is ready for refund initiation.')
    } else {
      updateReturnStatus(returnId, 'rejected', inspectionNotes)
      alert('Return rejected after inspection.')
    }
    setSelectedReturn(null)
    setInspectionNotes("")
  }

  const handleProcessRefund = async (returnRecord: any) => {
    try {
      const refundMethod = returnRecord.refund_method || returnRecord.method || returnRecord.refundMethod || 'original_payment_method'
      const adminNotesValue = returnRecord.admin_notes || returnRecord.inspectionNotes || inspectionNotes || ''
      const upiId = returnRecord.upi_id || (String(adminNotesValue).includes('UPI ID:')
        ? String(adminNotesValue).split('UPI ID:')[1]?.split('|')[0]?.trim()
        : null)

      console.log('[HandleRefund] Processing refund via:', refundMethod)
      console.log('[HandleRefund] UPI ID:', upiId)

      const refundPayload: any = {
        refundMethod,
        amount: returnRecord.refund_amount || returnRecord.refundAmount || returnRecord.totalRefundAmount,
        adminNotes: adminNotesValue,
        upiId: upiId || null,
      }

      const confirmed = window.confirm(
        `Initiate ${String(refundMethod).replace(/_/g, ' ')} refund of Rs.${refundPayload.amount} to customer?\n` +
        (upiId ? `UPI ID: ${upiId}` : '') +
        '\n\nThis will initiate the actual money transfer.'
      )

      if (!confirmed) return

      const response = await returnsAPI.processReturnRefund(returnRecord.id, refundPayload)
      console.log('[HandleRefund] Refund response:', response)

      if (response?.status === 'success') {
        alert(`Refund initiated successfully!\nPayout ID: ${response.payoutId}`)
        await loadReturns()
      } else {
        alert('Refund initiation failed. Please check logs.')
      }
    } catch (error: any) {
      console.error('[HandleRefund] Error:', error)
      alert(`Refund failed: ${error.response?.data?.error || error.message}`)
    }
  }

  const getStatusIcon = (status: ReturnRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-blue-600" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'picked_up':
      case 'received':
        return <Package className="w-4 h-4 text-purple-600" />
      case 'inspected':
        return <AlertCircle className="w-4 h-4 text-orange-600" />
      case 'refunded':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: ReturnRequest['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'picked_up': return 'bg-purple-100 text-purple-800'
      case 'received': return 'bg-indigo-100 text-indigo-800'
      case 'inspected': return 'bg-orange-100 text-orange-800'
      case 'refunded': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'pending').length,
    approved: returns.filter(r => r.status === 'approved').length,
    processing: returns.filter(r => ['picked_up', 'received', 'inspected'].includes(r.status)).length,
    refunded: returns.filter(r => r.status === 'refunded').length,
    rejected: returns.filter(r => r.status === 'rejected').length,
    totalRefundAmount: returns.filter(r => r.status === 'refunded').reduce((sum, r) => sum + r.totalRefundAmount, 0)
  }

  const upiApps = [
    {
      id: 'gpay',
      label: 'Google Pay',
      color: '#4285F4',
      svg: '<svg viewBox="0 0 48 48" width="24" height="24"><circle cx="24" cy="24" r="22" fill="#4285F4"/><text x="24" y="29" text-anchor="middle" fill="white" font-size="10" font-weight="700" font-family="Arial">GPay</text></svg>'
    },
    {
      id: 'phonepe',
      label: 'PhonePe',
      color: '#5F259F',
      svg: '<svg viewBox="0 0 48 48" width="24" height="24"><rect width="48" height="48" rx="8" fill="#5F259F"/><text x="24" y="31" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="Arial">Pe</text></svg>'
    },
    {
      id: 'paytm',
      label: 'Paytm',
      color: '#002970',
      svg: '<svg viewBox="0 0 48 48" width="24" height="24"><rect width="48" height="48" rx="8" fill="#002970"/><text x="24" y="30" text-anchor="middle" fill="#00BAF2" font-size="11" font-weight="700" font-family="Arial">PAYTM</text></svg>'
    },
    {
      id: 'razorpay',
      label: 'Razorpay',
      color: '#3395FF',
      svg: '<svg viewBox="0 0 48 48" width="24" height="24"><rect width="48" height="48" rx="8" fill="#3395FF"/><text x="24" y="30" text-anchor="middle" fill="white" font-size="9" font-weight="700" font-family="Arial">RZP</text></svg>'
    },
    {
      id: 'bhim',
      label: 'BHIM UPI',
      color: '#138808',
      svg: '<svg viewBox="0 0 48 48" width="24" height="24"><rect width="48" height="48" rx="8" fill="#138808"/><text x="24" y="22" text-anchor="middle" fill="white" font-size="10" font-weight="700" font-family="Arial">BHIM</text><text x="24" y="35" text-anchor="middle" fill="white" font-size="8" font-family="Arial">UPI</text></svg>'
    },
    {
      id: 'neft',
      label: 'NEFT/IMPS',
      color: '#FF6B35',
      svg: '<svg viewBox="0 0 48 48" width="24" height="24"><rect width="48" height="48" rx="8" fill="#FF6B35"/><text x="24" y="22" text-anchor="middle" fill="white" font-size="9" font-weight="700" font-family="Arial">NEFT</text><text x="24" y="35" text-anchor="middle" fill="white" font-size="8" font-family="Arial">IMPS</text></svg>'
    }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto">
      <div className="bg-white w-full max-w-7xl m-4 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="bg-linear-to-r from-orange-600 to-red-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-wider flex items-center gap-3">
                <RotateCcw className="w-8 h-8" />
                RETURNS & EXCHANGES
              </h2>
              <p className="text-orange-100 mt-1">Manage return requests and refunds</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-orange-200 text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-6 bg-gray-50">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-600">Total Returns</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
            <div className="text-xs text-gray-600">Approved</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{stats.processing}</div>
            <div className="text-xs text-gray-600">In Progress</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.refunded}</div>
            <div className="text-xs text-gray-600">Refunded</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-xs text-gray-600">Rejected</div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by return ID, order ID, or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="picked_up">Picked Up</option>
              <option value="received">Received</option>
              <option value="inspected">Inspected</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Returns List */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {filteredReturns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No return requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReturns.map((returnReq) => (
                <div key={returnReq.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(returnReq.status)}
                        <div>
                          <div className="font-semibold">Return #{returnReq.id}</div>
                          <div className="text-sm text-gray-600">Order: #{returnReq.orderId}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Customer</div>
                          <div className="font-medium">{returnReq.customerName}</div>
                          <div className="text-sm text-gray-600">{returnReq.customerEmail}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Items</div>
                          {returnReq.items.map((item, idx) => (
                            <div key={idx} className="text-sm">
                              {item.name} x{item.quantity} - ₹{item.price}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <div className="text-sm text-gray-600 mb-1">Return Reason</div>
                        <div className="text-sm">{returnReq.returnReason}</div>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <span className="text-gray-600">Type: <span className="font-medium">{returnReq.returnType}</span></span>
                        <span className="text-gray-600">Refund: <span className="font-medium">₹{returnReq.totalRefundAmount}</span></span>
                        <span className="text-gray-600">Method: <span className="font-medium">{returnReq.refundMethod.replace('_', ' ')}</span></span>
                      </div>

                      {returnReq.inspectionNotes && (
                        <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                          <span className="font-medium">Notes:</span> {returnReq.inspectionNotes}
                        </div>
                      )}

                      {returnReq.slaDeadline && (
                        <div style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          background: new Date(returnReq.slaDeadline) < new Date() ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${new Date(returnReq.slaDeadline) < new Date() ? '#fecaca' : '#bbf7d0'}`,
                          fontSize: '12px',
                          color: new Date(returnReq.slaDeadline) < new Date() ? '#dc2626' : '#166534'
                        }}>
                          {new Date(returnReq.slaDeadline) < new Date() ? 'SLA BREACHED' : 'Within SLA'} - Deadline: {new Date(returnReq.slaDeadline).toLocaleDateString('en-IN')}
                        </div>
                      )}

                      {returnReq.trackingNumber && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#4b5563' }}>
                          Tracking: <strong>{returnReq.trackingNumber}</strong>
                          {returnReq.carrierName && ` via ${returnReq.carrierName}`}
                        </div>
                      )}

                      {Array.isArray(returnReq.returnItemsRaw) && returnReq.returnItemsRaw.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                            Items Being Returned:
                          </p>
                          {returnReq.returnItemsRaw.map((item: any, idx: number) => (
                            <div key={idx} style={{ fontSize: '12px', color: '#6b7280', padding: '2px 0' }}>
                              - {item.product_name || item.productName || item.name} x{item.quantity} - Rs.{Number(item.price || 0) * Number(item.quantity || 1)}
                            </div>
                          ))}
                        </div>
                      )}

                      {returnReq.priorityFlag && (
                        <div style={{
                          marginTop: '6px',
                          padding: '4px 8px',
                          background: '#fef3c7',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#92400e',
                          fontWeight: '600'
                        }}>
                          PRIORITY CASE
                        </div>
                      )}

                      {returnReq.refundTransactionId && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#059669' }}>
                          Refund TXN: <strong>{returnReq.refundTransactionId}</strong>
                          {returnReq.refundCompletedAt && ` - Completed: ${new Date(returnReq.refundCompletedAt).toLocaleDateString('en-IN')}`}
                        </div>
                      )}
                    </div>

                    <div className="ml-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(returnReq.status)}`}>
                        {returnReq.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <div className="text-xs text-gray-600 mt-2">
                        {new Date(returnReq.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                    {returnReq.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveReturn(returnReq.id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          Approve Return
                        </button>
                        <button
                          onClick={() => rejectReturn(returnReq.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                        >
                          Reject Return
                        </button>
                      </>
                    )}
                    {returnReq.status === 'approved' && (
                      <button
                        onClick={() => {
                          setPickupReturnId(returnReq.id)
                          setPickupDetails({ carrier: '', trackingNumber: '' })
                          setShowPickupModal(true)
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                      >
                        Mark as Picked Up
                      </button>
                    )}
                    {returnReq.status === 'picked_up' && (
                      <button
                        onClick={() => markAsReceived(returnReq.id)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
                      >
                        Mark as Received
                      </button>
                    )}
                    {returnReq.status === 'inspected' && (
                      <button
                        onClick={() => handleProcessRefund(returnReq as any)}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded text-sm"
                      >
                        Initiate Refund Payment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inspection Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Product Inspection</h3>
            <p className="text-sm text-gray-600 mb-4">
              Return ID: <span className="font-medium">{selectedReturn.id}</span>
            </p>
            <textarea
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              placeholder="Enter inspection notes (condition, damages, etc.)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button
                onClick={() => completeInspection(selectedReturn.id, true)}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                Approve & Refund
              </button>
              <button
                onClick={() => completeInspection(selectedReturn.id, false)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setSelectedReturn(null)
                  setInspectionNotes("")
                }}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPickupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '10px', width: '380px' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: '700' }}>
              Enter Pickup Details
            </h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                Carrier / Logistics Partner
              </label>
              <select
                value={pickupDetails.carrier}
                onChange={e => setPickupDetails(p => ({ ...p, carrier: e.target.value }))}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
              >
                <option value="">Select carrier...</option>
                <option value="Delhivery">Delhivery</option>
                <option value="BlueDart">BlueDart</option>
                <option value="Ekart">Ekart Logistics</option>
                <option value="DTDC">DTDC</option>
                <option value="India Post">India Post</option>
                <option value="Shadowfax">Shadowfax</option>
                <option value="Xpressbees">Xpressbees</option>
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                AWB / Tracking Number
              </label>
              <input
                type="text"
                placeholder="Enter tracking number..."
                value={pickupDetails.trackingNumber}
                onChange={e => setPickupDetails(p => ({ ...p, trackingNumber: e.target.value }))}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowPickupModal(false)}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!pickupDetails.carrier || !pickupDetails.trackingNumber) {
                    alert('Carrier and tracking number are required.');
                    return;
                  }
                  setShowPickupModal(false)
                  await updateReturnStatus(
                    pickupReturnId!,
                    'picked_up',
                    `Carrier: ${pickupDetails.carrier} | AWB: ${pickupDetails.trackingNumber}`
                  )
                  setPickupDetails({ carrier: '', trackingNumber: '' })
                  setPickupReturnId(null)
                }}
                style={{
                  flex: 2,
                  padding: '8px',
                  background: '#7c3aed',
                  color: 'white',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Confirm Pickup
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundModal && pendingApprovalReturnId && (() => {
        const currentReturn: any = returns.find(r => r.id === pendingApprovalReturnId)
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              background: 'white', borderRadius: '12px',
              width: '100%', maxWidth: '480px',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              padding: '24px'
            }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                  Approve Return Request
                </h2>
                <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>
                  Order: {currentReturn?.order_id || currentReturn?.orderId}
                </p>
              </div>

              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: '8px', padding: '12px', marginBottom: '20px'
              }}>
                <p style={{ margin: 0, fontWeight: '600', color: '#15803d' }}>
                  Refund Amount: ₹{currentReturn?.refund_amount || currentReturn?.refundAmount || currentReturn?.totalRefundAmount || 0}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#166534' }}>
                  Product: {currentReturn?.product_name || currentReturn?.items?.[0]?.name || 'N/A'}
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                  Refund Method *
                </label>
                <select
                  value={selectedRefundMethod}
                  onChange={e => {
                    setSelectedRefundMethod(e.target.value)
                    setRefundDetails({
                      accountHolderName: '',
                      accountNumber: '',
                      ifscCode: '',
                      bankName: '',
                      upiId: '',
                      adminNotes: refundDetails.adminNotes,
                      selectedUpiApp: ''
                    })
                    setBankVerified(false)
                  }}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: '6px', border: '1px solid #d1d5db',
                    fontSize: '14px', background: 'white'
                  }}
                >
                  <option value="original_payment_method">Original Payment Method</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="upi">UPI Transfer</option>
                  <option value="store_credit">Store Credit / Wallet</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              {selectedRefundMethod === 'original_payment_method' && (
                <div style={{
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  borderRadius: '8px', padding: '12px', marginBottom: '16px'
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#1d4ed8' }}>
                    Refund will be processed to the original payment method used during purchase.
                    This typically takes 5-7 business days.
                  </p>
                </div>
              )}

              {selectedRefundMethod === 'bank_transfer' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    background: '#fefce8', border: '1px solid #fde68a',
                    borderRadius: '6px', padding: '10px', marginBottom: '12px'
                  }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>
                      Collect bank details from the customer before proceeding.
                      Refund via NEFT/IMPS takes 2-3 business days after initiation.
                    </p>
                  </div>

                  {[
                    { label: 'Account Holder Name *', key: 'accountHolderName', placeholder: 'As per bank records' },
                    { label: 'Account Number *', key: 'accountNumber', placeholder: 'Enter account number' },
                    { label: 'IFSC Code *', key: 'ifscCode', placeholder: 'e.g. SBIN0001234' },
                    { label: 'Bank Name', key: 'bankName', placeholder: 'e.g. State Bank of India' }
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                        {field.label}
                      </label>
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={refundDetails[field.key as keyof typeof refundDetails]}
                        onChange={e => setRefundDetails(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={{
                          width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                          borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px'
                        }}
                      />
                    </div>
                  ))}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={bankVerified}
                      onChange={(e) => setBankVerified(e.target.checked)}
                    />
                    Bank account details verified with customer
                  </label>
                </div>
              )}

              {selectedRefundMethod === 'upi' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: '6px', padding: '10px', marginBottom: '12px'
                  }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#166534' }}>
                      UPI refunds are instant once initiated.
                      Verify the UPI ID with the customer before approving.
                    </p>
                  </div>

                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                    Customer UPI ID *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. customer@upi or 9876543210@paytm"
                    value={refundDetails.upiId}
                    onChange={e => setRefundDetails(prev => ({ ...prev, upiId: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                      borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px'
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                    Supported: Google Pay, PhonePe, Paytm, BHIM, any UPI app
                  </p>

                  {refundDetails.upiId && (
                    <div style={{ marginTop: '12px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: '600',
                        marginBottom: '8px'
                      }}>
                        Select Payment App to Send Refund *
                      </label>
                      <p style={{
                        fontSize: '11px',
                        color: '#666',
                        marginBottom: '10px'
                      }}>
                        The refund of Rs.{currentReturn?.refund_amount || currentReturn?.refundAmount || currentReturn?.totalRefundAmount || 0} will be sent from your business account to {refundDetails.upiId}
                      </p>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px'
                      }}>
                        {upiApps.map(app => (
                          <button
                            key={app.id}
                            onClick={() => setRefundDetails(prev => ({ ...prev, selectedUpiApp: app.id }))}
                            style={{
                              padding: '12px 10px',
                              borderRadius: '10px',
                              border: refundDetails.selectedUpiApp === app.id
                                ? `2px solid ${app.color}`
                                : '1px solid #e5e7eb',
                              background: refundDetails.selectedUpiApp === app.id
                                ? `${app.color}18`
                                : 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              boxShadow: refundDetails.selectedUpiApp === app.id
                                ? `0 0 0 3px ${app.color}30`
                                : 'none'
                            }}
                          >
                            <span
                              dangerouslySetInnerHTML={{ __html: app.svg }}
                              style={{ display: 'flex', alignItems: 'center' }}
                            />
                            <span style={{
                              fontSize: '11px',
                              fontWeight: refundDetails.selectedUpiApp === app.id ? '600' : '400',
                              color: refundDetails.selectedUpiApp === app.id ? app.color : '#374151'
                            }}>
                              {app.label}
                            </span>
                          </button>
                        ))}
                      </div>

                      {refundDetails.selectedUpiApp && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px',
                          background: '#f0fdf4',
                          borderRadius: '6px',
                          border: '1px solid #bbf7d0',
                          fontSize: '12px',
                          color: '#166534'
                        }}>
                          Will send Rs.{currentReturn?.refund_amount || currentReturn?.refundAmount || currentReturn?.totalRefundAmount || 0} to <strong>{refundDetails.upiId}</strong> via <strong>{refundDetails.selectedUpiApp}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedRefundMethod === 'store_credit' && (
                <div style={{
                  background: '#fdf4ff', border: '1px solid #e9d5ff',
                  borderRadius: '8px', padding: '12px', marginBottom: '16px'
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b21a8' }}>
                    ₹{currentReturn?.refund_amount || currentReturn?.refundAmount || currentReturn?.totalRefundAmount || 0} store credit will be added to the customer's wallet instantly.
                    Customer can use it on their next purchase.
                  </p>
                </div>
              )}

              {selectedRefundMethod === 'cheque' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    background: '#fff7ed', border: '1px solid #fed7aa',
                    borderRadius: '6px', padding: '10px', marginBottom: '12px'
                  }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9a3412' }}>
                      Cheque refunds take 7-10 business days.
                      Ensure the mailing address is verified with the customer.
                    </p>
                  </div>

                  {[
                    { label: 'Payee Name *', key: 'accountHolderName', placeholder: 'Name on cheque' },
                    { label: 'Mailing Address', key: 'bankName', placeholder: 'Full address for cheque delivery' }
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                        {field.label}
                      </label>
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={refundDetails[field.key as keyof typeof refundDetails]}
                        onChange={e => setRefundDetails(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={{
                          width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                          borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                  Admin Notes (optional)
                </label>
                <textarea
                  placeholder="Internal notes about this approval..."
                  value={refundDetails.adminNotes}
                  onChange={e => setRefundDetails(prev => ({ ...prev, adminNotes: e.target.value }))}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                    borderRadius: '6px', border: '1px solid #d1d5db',
                    fontSize: '13px', resize: 'vertical'
                  }}
                />
              </div>

              {(() => {
                const missingFields: string[] = []
                if (selectedRefundMethod === 'bank_transfer') {
                  if (!refundDetails.accountHolderName) missingFields.push('Account Holder Name')
                  if (!refundDetails.accountNumber) missingFields.push('Account Number')
                  if (!refundDetails.ifscCode) missingFields.push('IFSC Code')
                  if (!bankVerified) missingFields.push('Bank Verification')
                }
                if (selectedRefundMethod === 'upi') {
                  if (!refundDetails.upiId) missingFields.push('UPI ID')
                  if (!refundDetails.selectedUpiApp) missingFields.push('Payment App')
                }
                if (selectedRefundMethod === 'cheque' && !refundDetails.accountHolderName) {
                  missingFields.push('Payee Name')
                }

                return (
                  <>
                    {missingFields.length > 0 && (
                      <div style={{
                        background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: '6px', padding: '10px', marginBottom: '12px'
                      }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#dc2626' }}>
                          Please fill in: {missingFields.join(', ')}
                        </p>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => {
                          setShowRefundModal(false)
                          setPendingApprovalReturnId(null)
                        }}
                        style={{
                          flex: 1, padding: '10px',
                          borderRadius: '6px', border: '1px solid #d1d5db',
                          background: 'white', cursor: 'pointer', fontSize: '14px'
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        disabled={missingFields.length > 0}
                        onClick={async () => {
                          setShowRefundModal(false)

                          let refundInfo = ''
                          if (selectedRefundMethod === 'bank_transfer') {
                            refundInfo = `Bank: ${refundDetails.bankName || 'N/A'} | ` +
                              `A/C: ${refundDetails.accountNumber} | ` +
                              `IFSC: ${refundDetails.ifscCode} | ` +
                              `Name: ${refundDetails.accountHolderName}`
                          } else if (selectedRefundMethod === 'upi') {
                            refundInfo = `UPI ID: ${refundDetails.upiId} | App: ${refundDetails.selectedUpiApp}`
                          } else if (selectedRefundMethod === 'cheque') {
                            refundInfo = `Payee: ${refundDetails.accountHolderName} | ` +
                              `Address: ${refundDetails.bankName}`
                          }

                          const combinedNotes = [
                            refundDetails.adminNotes,
                            refundInfo
                          ].filter(Boolean).join(' | ')

                          await updateReturnStatus(
                            pendingApprovalReturnId!,
                            'approved',
                            combinedNotes,
                            selectedRefundMethod,
                            {
                              upiId: refundDetails.upiId,
                              selectedUpiApp: refundDetails.selectedUpiApp,
                              accountNumber: refundDetails.accountNumber,
                              ifscCode: refundDetails.ifscCode,
                              accountHolderName: refundDetails.accountHolderName,
                              bankName: refundDetails.bankName,
                            }
                          )

                          setPendingApprovalReturnId(null)
                        }}
                        style={{
                          flex: 2, padding: '10px',
                          borderRadius: '6px', border: 'none',
                          background: missingFields.length > 0 ? '#d1d5db' : '#16a34a',
                          color: 'white', cursor: missingFields.length > 0 ? 'not-allowed' : 'pointer',
                          fontSize: '14px', fontWeight: '600'
                        }}
                      >
                        Approve Return Request
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
