import { useState } from 'react';
import { Search, Package } from 'lucide-react';
import API from '../lib/api';

interface OrderTrackingPageProps {
  onBack: () => void;
}

export function OrderTrackingPage({ onBack }: OrderTrackingPageProps) {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const trackOrder = async () => {
    if (!orderId.trim()) {
      setError('Please enter an order ID');
      return;
    }

    setIsLoading(true);
    setError('');
    setOrder(null);

    try {
      const response = await API.get(
        `/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );
      
      setOrder(response.data.data || response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Order not found. Please check your order ID.');
      } else if (err.response?.status === 401) {
        setError('Please login to track your order.');
      } else {
        setError('Failed to track order. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusStep = (status: string) => {
    const normalized = status.toLowerCase();
    const steps = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out for delivery', 'delivered'];
    return steps.indexOf(normalized);
  };

  const OrderStatusTimeline = ({ status }: { status: string }) => {
    const normalized = status.toLowerCase();
    const currentStep = getStatusStep(status);
    
    // Handle special statuses
    if (normalized === 'cancelled' || normalized === 'returned' || normalized === 'refunded') {
      return (
        <div className="mb-8">
          <h3 className="font-semibold mb-4">Order Status</h3>
          <div className={`p-6 rounded-lg text-center ${
            normalized === 'cancelled' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className={`text-2xl font-bold mb-2 ${
              normalized === 'cancelled' ? 'text-red-800' : 'text-yellow-800'
            }`}>
              {normalized === 'cancelled' ? '❌ Order Cancelled' : '🔄 ' + status}
            </p>
            <p className="text-sm text-gray-600">
              {normalized === 'cancelled' 
                ? 'This order has been cancelled. Refund will be processed if payment was made.' 
                : 'Your request is being processed by our team.'}
            </p>
          </div>
        </div>
      );
    }
    
    const steps = [
      { label: 'Order Placed', status: 'pending' },
      { label: 'Confirmed', status: 'confirmed' },
      { label: 'Processing', status: 'processing' },
      { label: 'Packed', status: 'packed' },
      { label: 'Shipped', status: 'shipped' },
      { label: 'Out for Delivery', status: 'out for delivery' },
      { label: 'Delivered', status: 'delivered' }
    ];

    return (
      <div className="mb-8">
        <h3 className="font-semibold mb-4">Order Status</h3>
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={step.status} className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-4 bg-white transition-all ${
                      isCompleted
                        ? 'border-black'
                        : 'border-gray-300'
                    } ${isCurrent ? 'ring-4 ring-black ring-opacity-20' : ''}`}
                  >
                    {isCompleted && (
                      <div className="w-4 h-4 bg-black rounded-full" />
                    )}
                  </div>
                  <span className={`text-xs mt-2 ${isCompleted ? 'font-semibold' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => {
              // Try browser history first, fallback to callback
              if (window.history.length > 1) {
                window.history.back();
              } else {
                onBack();
              }
            }}
            className="text-sm mb-4 hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold tracking-wide">Track Your Order</h1>
          <p className="text-gray-600 mt-2">Enter your order ID to see its current status</p>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && trackOrder()}
                placeholder="Enter Order ID (e.g., ORD-123456)"
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
              />
            </div>
            <button
              onClick={trackOrder}
              disabled={isLoading}
              className={`px-8 py-3 rounded-lg font-semibold tracking-wider transition-colors ${
                isLoading
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-neutral-800'
              }`}
            >
              {isLoading ? 'TRACKING...' : 'TRACK'}
            </button>
          </div>

          {error && (
            <p className="text-red-600 text-sm mt-3">{error}</p>
          )}
        </div>

        {/* Order Details */}
        {order && (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            {/* Status Timeline */}
            <OrderStatusTimeline status={order.status} />

            {/* Order Info */}
            <div className="border-t pt-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Order ID</p>
                  <p className="font-semibold">{order.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Order Date</p>
                  <p className="font-semibold">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-semibold">{order.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold">Rs.{order.total_price}</p>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shipping_address && (
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">Shipping Address</h4>
                  <p className="text-gray-700">
                    {order.shipping_address.street}<br />
                    {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.pinCode}<br />
                    {order.shipping_address.country || 'India'}
                  </p>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h4 className="font-semibold mb-3">Order Items</h4>
                <div className="space-y-3">
                  {order.order_items?.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-neutral-50 rounded">
                      <div className="w-16 h-16 bg-neutral-200 rounded flex items-center justify-center">
                        {item.product?.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{item.product?.name || 'Product'}</p>
                        <p className="text-sm text-gray-600">
                          Quantity: {item.quantity} | Size: {item.size || 'N/A'}
                        </p>
                      </div>
                      <p className="font-semibold">Rs.{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        {!order && !error && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              Enter your order ID above to track your order
            </p>
            <p className="text-sm text-gray-400 mt-2">
              You can find your order ID in your order confirmation email
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
