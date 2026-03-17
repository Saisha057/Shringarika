import { useState, useEffect } from 'react';
import { Package, Truck, MapPin, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getTrackingInfo, COURIER_SERVICES, type CourierTrackingInfo, type CourierService } from '../utils/shipping';

interface OrderTrackingProps {
  trackingNumber: string;
  courier: CourierService;
  orderId: string;
  estimatedDelivery?: Date;
}

export function OrderTracking({ trackingNumber, courier, orderId, estimatedDelivery }: OrderTrackingProps) {
  const [trackingInfo, setTrackingInfo] = useState<CourierTrackingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTrackingInfo();
  }, [trackingNumber, courier]);

  const fetchTrackingInfo = async () => {
    setIsLoading(true);
    setError('');

    try {
      const info = await getTrackingInfo(trackingNumber, courier);
      setTrackingInfo(info);
    } catch (err) {
      setError('Unable to fetch tracking information');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: CourierTrackingInfo['status']) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
      case 'returned':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'out-for-delivery':
        return <Truck className="w-5 h-5 text-blue-600 animate-pulse" />;
      default:
        return <Package className="w-5 h-5 text-orange-600" />;
    }
  };

  const getStatusColor = (status: CourierTrackingInfo['status']) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'failed':
      case 'returned':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'out-for-delivery':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-orange-50 border-orange-200 text-orange-800';
    }
  };

  const getStatusText = (status: CourierTrackingInfo['status']) => {
    const statusMap: Record<CourierTrackingInfo['status'], string> = {
      'pending': 'Order Pending',
      'picked-up': 'Picked Up',
      'in-transit': 'In Transit',
      'out-for-delivery': 'Out for Delivery',
      'delivered': 'Delivered',
      'failed': 'Delivery Failed',
      'returned': 'Returned',
    };
    return statusMap[status];
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </div>
    );
  }

  if (error || !trackingInfo) {
    return (
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error || 'Unable to load tracking information'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-50 border-b border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-neutral-700" />
            <h3 className="font-semibold tracking-wide">SHIPMENT TRACKING</h3>
          </div>
          <a
            href={trackingInfo.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>Track on {trackingInfo.courierName}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-neutral-500 mb-1">Tracking Number</div>
            <div className="font-mono font-semibold">{trackingNumber}</div>
          </div>
          <div>
            <div className="text-neutral-500 mb-1">Order ID</div>
            <div className="font-semibold">{orderId}</div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="p-6">
        <div className={`rounded-lg border p-4 mb-6 ${getStatusColor(trackingInfo.status)}`}>
          <div className="flex items-start gap-3">
            {getStatusIcon(trackingInfo.status)}
            <div className="flex-1">
              <div className="font-semibold text-sm mb-1">
                {getStatusText(trackingInfo.status)}
              </div>
              {trackingInfo.currentLocation && (
                <div className="text-xs flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>{trackingInfo.currentLocation}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              {trackingInfo.status === 'delivered' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-300"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Delivered</div>
              {trackingInfo.status === 'delivered' && (
                <div className="text-xs text-neutral-500 mt-0.5">
                  {trackingInfo.lastUpdate.toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-1">
              {['out-for-delivery', 'delivered'].includes(trackingInfo.status) ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : trackingInfo.status === 'in-transit' ? (
                <div className="w-5 h-5 rounded-full border-2 border-blue-600 bg-blue-600"></div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-300"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Out for Delivery</div>
              {trackingInfo.status === 'out-for-delivery' && (
                <div className="text-xs text-neutral-500 mt-0.5">Expected today</div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-1">
              {['in-transit', 'out-for-delivery', 'delivered'].includes(trackingInfo.status) ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : trackingInfo.status === 'picked-up' ? (
                <div className="w-5 h-5 rounded-full border-2 border-orange-600 bg-orange-600"></div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-300"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">In Transit</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-1">
              {trackingInfo.status !== 'pending' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-orange-600 bg-orange-600"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Picked Up</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-1">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Order Placed</div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {new Date(Date.now() - 86400000).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Estimated Delivery */}
        {trackingInfo.estimatedDelivery && trackingInfo.status !== 'delivered' && (
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-neutral-600" />
              <span className="text-neutral-700">Estimated Delivery:</span>
              <span className="font-semibold">
                {trackingInfo.estimatedDelivery.toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        )}

        {/* Last Update */}
        <div className="mt-4 text-xs text-neutral-500 text-center">
          Last updated: {trackingInfo.lastUpdate.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
