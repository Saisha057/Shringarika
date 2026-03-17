import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';

interface ReturnOrderModalProps {
  order: {
    orderId: string;
    orderNumber?: string;
    total: string;
    items: Array<{
      id?: string;
      productId?: string;
      name: string;
      quantity: number;
      price: number;
      size?: string;
      color?: string;
      image?: string | null;
    }>;
  };
  onClose: () => void;
  onSubmit: (returnData: ReturnRequest) => void;
}

export interface ReturnRequest {
  reasons: string[];
  otherReason?: string;
  refundMethod: string;
  refundDetails?: any;
  selectedItems?: string[];
  itemsToReturn?: Array<{
    order_item_id?: string;
    product_id?: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
  refundAmount?: number;
  pickupScheduledDate?: string;
  pickupTimeSlot?: string;
  productConditionPhotos?: string[];
  customerConfirmation?: boolean;
  priorityFlag?: boolean;
  disputeFlag?: boolean;
}

const RETURN_REASONS = [
  'Wrong size',
  'Wrong product',
  'Damaged product',
  'Quality issue',
  'Product not as described',
  'Changed mind',
  'Other'
];

const REFUND_METHODS = [
  { value: 'COD', label: 'Cash on Delivery Refund' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Original Payment Method', label: 'Original Payment Method' }
];

export function ReturnOrderModal({ order, onClose, onSubmit }: ReturnOrderModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherReason, setOtherReason] = useState('');
  const [step, setStep] = useState<'items' | 'reasons' | 'refund'>('items');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [refundMethod, setRefundMethod] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [verifyingUPI, setVerifyingUPI] = useState(false);
  const [upiError, setUpiError] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountNumber: '',
    ifscCode: '',
    accountHolderName: ''
  });
  const [pickupScheduledDate, setPickupScheduledDate] = useState('');
  const [pickupTimeSlot, setPickupTimeSlot] = useState('');
  const [customerConfirmation, setCustomerConfirmation] = useState(false);
  const [priorityFlag, setPriorityFlag] = useState(false);
  const [disputeFlag, setDisputeFlag] = useState(false);
  const [productConditionPhotos, setProductConditionPhotos] = useState<string[]>([]);

  const isValidUPIFormat = (upi: string): boolean => {
    const upiRegex = /^[a-z0-9][a-z0-9.\-_]{2,255}@[a-z]{2,}$/;
    return upiRegex.test(upi.toLowerCase());
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons(prev => 
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const selectedReturnItems = order.items
    .map((item, idx) => {
      const itemId = (item as any).id || item.productId || `${item.name}-${idx}`;
      return { ...item, _itemId: itemId };
    })
    .filter((item: any) => selectedItems.includes(item._itemId));

  const calculatedRefundAmount = selectedReturnItems.reduce((sum, item: any) => {
    return sum + (Number(item.price || 0) * Number(item.quantity || 1));
  }, 0);

  const handleConditionPhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const nextPhotos = await Promise.all(
      files.slice(0, 5).map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      })
    );

    setProductConditionPhotos((prev) => {
      return [...prev, ...nextPhotos.filter(Boolean)].slice(0, 5);
    });
  };

  const handleVerifyUPI = async () => {
    if (!upiId.trim()) {
      setUpiError('Please enter a UPI ID');
      return;
    }

    const trimmedUPI = upiId.trim().toLowerCase();
    
    if (!isValidUPIFormat(trimmedUPI)) {
      setUpiError('Invalid UPI format. Use: name@bank (e.g., john@paytm, user@ybl)');
      setUpiVerified(false);
      return;
    }

    const parts = trimmedUPI.split('@');
    if (parts.length !== 2 || parts[0].length < 3) {
      setUpiError('Invalid UPI ID format.');
      setUpiVerified(false);
      return;
    }

    setVerifyingUPI(true);
    setUpiError('');
    setUpiVerified(false);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/payment/verify-upi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ upiId: trimmedUPI })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setUpiVerified(true);
        setUpiError('');
        setUpiId(trimmedUPI);
      } else {
        setUpiError(data.message || 'Invalid UPI ID. Please verify and try again.');
        setUpiVerified(false);
      }
    } catch (error) {
      setUpiError('Failed to verify UPI. Please check your connection.');
      setUpiVerified(false);
    } finally {
      setVerifyingUPI(false);
    }
  };

  const handleContinueToRefund = () => {
    if (selectedReasons.length === 0) {
      alert('Please select at least one return reason');
      return;
    }
    if (selectedReasons.includes('Other') && !otherReason.trim()) {
      alert('Please specify the other reason');
      return;
    }
    setStep('refund');
  };

  const handleSubmit = () => {
    if (!refundMethod) {
      alert('Please select a refund method');
      return;
    }

    if (refundMethod === 'UPI') {
      if (!upiVerified) {
        alert('Please verify your UPI ID first');
        return;
      }
    }

    const returnData: ReturnRequest = {
      reasons: selectedReasons,
      otherReason: selectedReasons.includes('Other') ? otherReason : undefined,
      refundMethod,
      selectedItems,
      itemsToReturn: selectedReturnItems.map((item: any, idx: number) => ({
        order_item_id: item.id || item._itemId || String(idx),
        product_id: item.productId,
        product_name: item.name,
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
      })),
      refundAmount: calculatedRefundAmount,
      pickupScheduledDate: pickupScheduledDate || undefined,
      pickupTimeSlot: pickupTimeSlot || undefined,
      productConditionPhotos,
      customerConfirmation,
      priorityFlag,
      disputeFlag,
      refundDetails: refundMethod === 'UPI' 
        ? { upiId } 
        : refundMethod === 'Bank Transfer' 
          ? bankDetails 
          : undefined
    };

    onSubmit(returnData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-xl font-semibold tracking-wider">RETURN ORDER</h2>
            <p className="text-sm text-neutral-600">Order #{order.orderNumber || order.orderId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'items' ? (
            <>
              <h3 className="text-lg font-medium mb-4">Select Items to Return</h3>
              <p className="text-sm text-neutral-600 mb-4">Choose which items you want to return:</p>
              
              <div className="space-y-3 mb-6">
                {order.items.map((item, idx) => {
                  const itemId = (item as any).id || item.productId || `${item.name}-${idx}`;
                  return (
                    <label key={itemId} className="flex items-start gap-3 p-3 border border-neutral-300 rounded hover:bg-neutral-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(itemId)}
                        onChange={() => handleItemToggle(itemId)}
                        className="w-4 h-4 mt-1 shrink-0"
                      />
                      <div className="flex gap-3 flex-1 min-w-0">
                        {item.image && (
                          <div className="w-16 h-20 shrink-0 bg-neutral-100 border border-neutral-200 rounded overflow-hidden">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.name}</p>
                          {(item.size || item.color) && (
                            <p className="text-xs text-neutral-600">
                              {item.size && `Size: ${item.size}`}
                              {item.size && item.color && ' • '}
                              {item.color && `Color: ${item.color}`}
                            </p>
                          )}
                          <p className="text-xs text-neutral-600">Qty: {item.quantity} × ₹{item.price}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  if (selectedItems.length === 0) {
                    alert('Please select at least one item to return');
                    return;
                  }
                  setStep('reasons');
                }}
                className="w-full py-3 bg-black text-white rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
              >
                CONTINUE
              </button>
            </>
          ) : step === 'reasons' ? (
            <>
              <button
                onClick={() => setStep('items')}
                className="text-sm text-neutral-600 hover:underline mb-4"
              >
                ← Back to item selection
              </button>

              <h3 className="text-lg font-medium mb-4">Why are you returning this order?</h3>
              <p className="text-sm text-neutral-600 mb-4">Select all that apply:</p>
              
              <div className="space-y-3 mb-6">
                {RETURN_REASONS.map(reason => (
                  <label key={reason} className="flex items-center gap-3 p-3 border border-neutral-300 rounded hover:bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedReasons.includes(reason)}
                      onChange={() => handleReasonToggle(reason)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>

              {selectedReasons.includes('Other') && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Please specify:</label>
                  <textarea
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="Enter your reason..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                    rows={3}
                  />
                </div>
              )}

              <button
                onClick={handleContinueToRefund}
                className="w-full py-3 bg-black text-white rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
              >
                CONTINUE TO REFUND METHOD
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('reasons')}
                className="text-sm text-neutral-600 hover:underline mb-4"
              >
                ← Back to reasons
              </button>

              <h3 className="text-lg font-medium mb-4">Select Refund Method</h3>
              <p className="text-sm text-neutral-600 mb-2">Refund Amount (selected items): ₹{calculatedRefundAmount.toFixed(2)}</p>
              <p className="text-xs text-neutral-500 mb-4">This amount is calculated only from the items selected for return.</p>

              <div className="space-y-3 mb-6">
                {REFUND_METHODS.map(method => (
                  <label key={method.value} className="flex items-center gap-3 p-3 border border-neutral-300 rounded hover:bg-neutral-50 cursor-pointer">
                    <input
                      type="radio"
                      name="refundMethod"
                      value={method.value}
                      checked={refundMethod === method.value}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{method.label}</span>
                  </label>
                ))}
              </div>

              {refundMethod === 'UPI' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">UPI ID:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value);
                        setUpiVerified(false);
                        setUpiError('');
                      }}
                      placeholder="yourname@paytm"
                      className={`flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 ${
                        upiError ? 'border-red-500 focus:ring-red-500' : 
                        upiVerified ? 'border-green-500 focus:ring-green-500' : 
                        'border-neutral-300 focus:ring-black'
                      }`}
                      disabled={verifyingUPI}
                    />
                    <button
                      onClick={handleVerifyUPI}
                      disabled={verifyingUPI || !upiId.trim() || !isValidUPIFormat(upiId.trim().toLowerCase()) || upiVerified}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        upiVerified
                          ? 'bg-green-100 text-green-700 cursor-not-allowed'
                          : verifyingUPI || !upiId.trim() || !isValidUPIFormat(upiId.trim().toLowerCase())
                          ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                          : 'bg-black text-white hover:bg-neutral-800'
                      }`}
                    >
                      {verifyingUPI ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : upiVerified ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        'Verify'
                      )}
                    </button>
                  </div>
                  {upiError && (
                    <p className="text-xs text-red-600 mt-1">{upiError}</p>
                  )}
                  {upiVerified && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      UPI ID verified successfully
                    </p>
                  )}
                  <p className="text-xs text-neutral-500 mt-1">
                    Example: yourname@paytm, yourname@ybl, yourname@oksbi
                  </p>
                </div>
              )}

              {refundMethod === 'Bank Transfer' && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Account Holder Name:</label>
                    <input
                      type="text"
                      value={bankDetails.accountHolderName}
                      onChange={(e) => setBankDetails({...bankDetails, accountHolderName: e.target.value})}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Account Number:</label>
                    <input
                      type="text"
                      value={bankDetails.accountNumber}
                      onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">IFSC Code:</label>
                    <input
                      type="text"
                      value={bankDetails.ifscCode}
                      onChange={(e) => setBankDetails({...bankDetails, ifscCode: e.target.value})}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6 border border-neutral-200 rounded p-4">
                <p className="text-sm font-medium">Pickup Scheduling</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Pickup Date</label>
                    <input
                      type="date"
                      value={pickupScheduledDate}
                      onChange={(e) => setPickupScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Pickup Time Slot</label>
                    <select
                      value={pickupTimeSlot}
                      onChange={(e) => setPickupTimeSlot(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="">Select slot</option>
                      <option value="09:00-12:00">09:00 AM - 12:00 PM</option>
                      <option value="12:00-15:00">12:00 PM - 03:00 PM</option>
                      <option value="15:00-18:00">03:00 PM - 06:00 PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6 border border-neutral-200 rounded p-4">
                <p className="text-sm font-medium">Product Condition Photos (optional)</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleConditionPhotoUpload}
                  className="block w-full text-sm"
                />
                {productConditionPhotos.length > 0 && (
                  <p className="text-xs text-neutral-600">{productConditionPhotos.length} photo(s) attached</p>
                )}
              </div>

              <div className="space-y-3 mb-6 border border-neutral-200 rounded p-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={customerConfirmation}
                    onChange={(e) => setCustomerConfirmation(e.target.checked)}
                  />
                  I confirm these selected items are being returned.
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={priorityFlag}
                    onChange={(e) => setPriorityFlag(e.target.checked)}
                  />
                  Mark as priority case
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={disputeFlag}
                    onChange={(e) => setDisputeFlag(e.target.checked)}
                  />
                  Raise dispute/escalation flag
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Refund Timeline:</strong> Once approved, your refund will be processed within 5-7 business days.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={refundMethod === 'UPI' && !upiVerified}
                className={`w-full py-3 rounded-full text-sm tracking-wider transition-colors ${
                  refundMethod === 'UPI' && !upiVerified
                    ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {refundMethod === 'UPI' && !upiVerified 
                  ? 'VERIFY UPI ID FIRST' 
                  : 'SUBMIT RETURN REQUEST'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
