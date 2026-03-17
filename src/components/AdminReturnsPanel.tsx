import React, { useState, useEffect } from 'react';
import { X, Package, RefreshCw, Calendar, User, Mail, Phone, Camera, CheckCircle, XCircle, AlertCircle, Clock, Truck, Eye, FileText } from 'lucide-react';
import { returnsAPI } from '../services/api';

const AdminReturnsPanel = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      const data = await returnsAPI.getAllReturns();
      if (data.status === 'success') {
        setReturns(data.data.returns);
      }
    } catch (error) {
      console.error('Error fetching returns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (returnId, newStatus, additionalData = {}) => {
    setProcessing(true);
    try {
      const data = await returnsAPI.updateReturnStatus(returnId, newStatus, additionalData.adminNotes);
      if (data.status === 'success') {
        await fetchReturns();
        if (selectedReturn && selectedReturn.id === returnId) {
          setSelectedReturn(data.data.return);
        }
        alert(`Return status updated to: ${newStatus}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update return status');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessRefund = async (returnId) => {
    const refundMethod = prompt('Enter refund method (e.g., original_payment_method, bank_transfer):');
    if (!refundMethod) return;

    const refundReference = prompt('Enter refund reference/transaction ID (optional):');

    setProcessing(true);
    try {
      const data = await returnsAPI.processRefund(returnId, {
        refundMethod,
        refundReference,
      });
      if (data.status === 'success') {
        await fetchReturns();
        if (selectedReturn && selectedReturn.id === returnId) {
          setSelectedReturn(data.data.return);
        }
        alert('Refund processed successfully!');
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      alert('Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (returnId) => {
    const adminNotes = prompt('Enter approval notes (optional):');
    await handleUpdateStatus(returnId, 'approved', { adminNotes });
  };

  const handleReject = async (returnId) => {
    const rejectionReason = prompt('Enter rejection reason:');
    if (!rejectionReason) {
      alert('Rejection reason is required');
      return;
    }
    await handleUpdateStatus(returnId, 'rejected', { rejectionReason });
  };

  const handleMarkResellable = async (returnId) => {
    const resellable = window.confirm('Is this item in resellable condition?');
    const itemCondition = prompt('Enter item condition (e.g., like_new, good, fair):');
    await handleUpdateStatus(returnId, 'accepted', { resellable, itemCondition });
  };

  const filteredReturns = returns.filter((ret) => {
    const matchesStatus = statusFilter === 'all' || ret.status === statusFilter;
    const matchesType = typeFilter === 'all' || ret.return_type === typeFilter;
    const matchesSearch =
      searchQuery === '' ||
      ret.orders?.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.orders?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.orders?.customer_email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      requested: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      under_review: { color: 'bg-yellow-100 text-yellow-800', icon: Eye },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      pickup_scheduled: { color: 'bg-purple-100 text-purple-800', icon: Calendar },
      picked_up: { color: 'bg-indigo-100 text-indigo-800', icon: Truck },
      inspecting: { color: 'bg-orange-100 text-orange-800', icon: Eye },
      accepted: { color: 'bg-teal-100 text-teal-800', icon: CheckCircle },
      completed: { color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.requested;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const typeConfig = {
      return: { color: 'bg-blue-100 text-blue-800', icon: Package },
      refund: { color: 'bg-green-100 text-green-800', icon: RefreshCw },
      exchange: { color: 'bg-purple-100 text-purple-800', icon: RefreshCw },
    };

    const config = typeConfig[type] || typeConfig.return;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {type}
      </span>
    );
  };

  const stats = {
    total: returns.length,
    requested: returns.filter((r) => r.status === 'requested').length,
    approved: returns.filter((r) => r.status === 'approved').length,
    completed: returns.filter((r) => r.status === 'completed').length,
    totalRefunds: returns
      .filter((r) => r.refund_status === 'completed')
      .reduce((sum, r) => sum + Number(r.refund_amount || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Requested</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.requested}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-gray-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Refunds</p>
              <p className="text-2xl font-bold text-pink-600">₹{stats.totalRefunds.toFixed(2)}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-pink-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Order number, customer name, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Statuses</option>
              <option value="requested">Requested</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="pickup_scheduled">Pickup Scheduled</option>
              <option value="picked_up">Picked Up</option>
              <option value="inspecting">Inspecting</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Types</option>
              <option value="return">Return</option>
              <option value="refund">Refund</option>
              <option value="exchange">Exchange</option>
            </select>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order / Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Refund
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No returns found matching your filters
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {ret.orders?.order_number || 'N/A'}
                        </span>
                        <span className="text-xs text-gray-500">{ret.orders?.customer_name}</span>
                        <span className="text-xs text-gray-400">{ret.orders?.customer_email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {ret.return_items && ret.return_items.length > 0 ? (
                          <div className="space-y-1">
                            {ret.return_items.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-xs">
                                {item.productName} × {item.quantity}
                              </div>
                            ))}
                            {ret.return_items.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{ret.return_items.length - 2} more
                              </div>
                            )}
                          </div>
                        ) : (
                          'No items'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(ret.return_type)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{ret.reason}</div>
                      {ret.reason_details && (
                        <div className="text-xs text-gray-500 line-clamp-2">{ret.reason_details}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(ret.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{Number(ret.refund_amount || 0).toFixed(2)}
                      </div>
                      {ret.refund_status && (
                        <div className="text-xs text-gray-500">{ret.refund_status}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ret.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setShowDetailModal(true);
                        }}
                        className="text-pink-600 hover:text-pink-900 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Return Details</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order & Customer Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Order Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Number:</span>
                      <span className="font-medium">{selectedReturn.orders?.order_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Total:</span>
                      <span className="font-medium">₹{Number(selectedReturn.orders?.total_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Customer Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{selectedReturn.orders?.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{selectedReturn.orders?.customer_email}</span>
                    </div>
                    {selectedReturn.orders?.customer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{selectedReturn.orders?.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Return Details */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Return Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <div className="mt-1">{getTypeBadge(selectedReturn.return_type)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <div className="mt-1">{getStatusBadge(selectedReturn.status)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Reason:</span>
                    <div className="mt-1 font-medium">{selectedReturn.reason}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <div className="mt-1 font-medium">
                      {new Date(selectedReturn.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                {selectedReturn.reason_details && (
                  <div className="mt-3">
                    <span className="text-gray-600 text-sm">Details:</span>
                    <p className="mt-1 text-sm text-gray-900">{selectedReturn.reason_details}</p>
                  </div>
                )}
              </div>

              {/* Items Being Returned */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Items Being Returned</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {selectedReturn.return_items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">{item.productName}</div>
                        {item.variant && (
                          <div className="text-xs text-gray-500">Variant: {item.variant}</div>
                        )}
                        <div className="text-sm text-gray-600">Quantity: {item.quantity}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">₹{Number(item.price || 0).toFixed(2)}</div>
                        <div className="text-xs text-gray-500">per item</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Photos */}
              {selectedReturn.photos && selectedReturn.photos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Photos ({selectedReturn.photos.length})
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedReturn.photos.map((photo, idx) => (
                      <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={photo.url || photo}
                          alt={`Return evidence ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Refund Information */}
              {selectedReturn.return_type === 'refund' && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Refund Information</h4>
                  <div className="bg-green-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Refund Amount:</span>
                      <span className="font-bold text-green-700">
                        ₹{Number(selectedReturn.refund_amount || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Refund Status:</span>
                      <span className="font-medium">{selectedReturn.refund_status || 'pending'}</span>
                    </div>
                    {selectedReturn.refund_method && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Refund Method:</span>
                        <span className="font-medium">{selectedReturn.refund_method}</span>
                      </div>
                    )}
                    {selectedReturn.refund_reference && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reference:</span>
                        <span className="font-medium font-mono text-xs">
                          {selectedReturn.refund_reference}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              {selectedReturn.admin_notes && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Admin Notes
                  </h4>
                  <div className="bg-yellow-50 rounded-lg p-4 text-sm text-gray-900">
                    {selectedReturn.admin_notes}
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {selectedReturn.status === 'rejected' && selectedReturn.rejection_reason && (
                <div>
                  <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Rejection Reason
                  </h4>
                  <div className="bg-red-50 rounded-lg p-4 text-sm text-red-900">
                    {selectedReturn.rejection_reason}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                {selectedReturn.status === 'requested' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedReturn.id, 'under_review')}
                      disabled={processing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      Mark Under Review
                    </button>
                    <button
                      onClick={() => handleApprove(selectedReturn.id)}
                      disabled={processing}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(selectedReturn.id)}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}

                {selectedReturn.status === 'under_review' && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedReturn.id)}
                      disabled={processing}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(selectedReturn.id)}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}

                {selectedReturn.status === 'approved' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedReturn.id, 'pickup_scheduled')}
                      disabled={processing}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      Schedule Pickup
                    </button>
                  </>
                )}

                {selectedReturn.status === 'pickup_scheduled' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedReturn.id, 'picked_up')}
                    disabled={processing}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Mark Picked Up
                  </button>
                )}

                {selectedReturn.status === 'picked_up' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedReturn.id, 'inspecting')}
                    disabled={processing}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    Start Inspection
                  </button>
                )}

                {selectedReturn.status === 'inspecting' && (
                  <button
                    onClick={() => handleMarkResellable(selectedReturn.id)}
                    disabled={processing}
                    className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50"
                  >
                    Complete Inspection
                  </button>
                )}

                {selectedReturn.status === 'accepted' &&
                  selectedReturn.return_type === 'refund' &&
                  selectedReturn.refund_status !== 'completed' && (
                    <button
                      onClick={() => handleProcessRefund(selectedReturn.id)}
                      disabled={processing}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      Process Refund
                    </button>
                  )}

                {processing && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-600"></div>
                    Processing...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturnsPanel;
