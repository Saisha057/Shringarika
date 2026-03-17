import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { UPIVerification } from './UPIVerification';
import api from '../services/api';

interface RefundRequestModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundRequestModal({ order, onClose, onSuccess }: RefundRequestModalProps) {
  const [reason, setReason] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [verifiedUpiId, setVerifiedUpiId] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isCOD = order.paymentMethod === 'COD' || order.payment_method === 'COD';

  const handleUPIVerified = (upiId: string, name: string) => {
    setUpiVerified(true);
    setVerifiedUpiId(upiId);
    setVerifiedName(name);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError('Please provide a reason for refund');
      return;
    }

    if (isCOD && !upiVerified) {
      setError('Please verify your UPI ID for COD refund');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.post('/refund/request', {
        orderId: order.orderId || order.id,
        reason: reason.trim(),
        refundUpiId: isCOD ? verifiedUpiId : undefined
      });

      if (response.data.success) {
        alert('Refund request submitted successfully! Our team will review it within 24-48 hours.');
        onSuccess();
        onClose();
      } else {
        setError(response.data.message || 'Failed to submit refund request');
      }
    } catch (err: any) {
      console.error('Refund request error:', err);
      setError(err.response?.data?.message || 'Failed to submit refund request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Request Refund</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Info */}
          <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Order ID:</span>
              <span className="font-medium">#{order.orderId || order.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Order Total:</span>
              <span className="font-medium">₹{order.total || order.total_price}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-medium">{isCOD ? 'Cash on Delivery' : 'Prepaid'}</span>
            </div>
          </div>

          {/* COD Info */}
          {isCOD && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">UPI Refund for COD Order</p>
                  <p className="text-blue-700">
                    Since this was a Cash on Delivery order, we'll refund the amount directly to your UPI ID.
                    Please verify your UPI ID below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Refund Reason */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Reason for Refund <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please describe why you want to return this order..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
              rows={4}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Examples: Wrong size, defective product, didn't match description, etc.
            </p>
          </div>

          {/* UPI Verification (COD only) */}
          {isCOD && (
            <div>
              <UPIVerification
                onVerified={handleUPIVerified}
                context="refund"
                orderId={order.orderId || order.id}
                required={true}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Refund Policy */}
          <div className="text-xs text-gray-600 space-y-1 bg-gray-50 rounded-lg p-4">
            <p className="font-medium text-gray-800">Refund Policy:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Refund requests are reviewed within 24-48 hours</li>
              <li>Product must be unused and in original packaging</li>
              <li>{isCOD ? 'UPI refunds are processed within 3-5 business days' : 'Refunds are processed to original payment method'}</li>
              <li>Refund amount includes product price (shipping excluded)</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-full font-medium hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim() || (isCOD && !upiVerified)}
              className={`flex-1 px-6 py-3 rounded-full font-medium transition-colors ${
                submitting || !reason.trim() || (isCOD && !upiVerified)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-neutral-800'
              }`}
            >
              {submitting ? 'Submitting...' : 'Submit Refund Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
