import { useState } from 'react';
import { Package, Truck, MapPin, Info, Check, X } from 'lucide-react';
import { 
  checkServiceability, 
  getPincodeInfo, 
  calculateShippingCost,
  formatDeliveryEstimate,
  type ShippingRate 
} from '../utils/shipping';

interface ShippingCalculatorProps {
  cartValue: number;
  weight?: number;
  onShippingCalculated?: (rate: ShippingRate) => void;
}

export function ShippingCalculator({ 
  cartValue, 
  weight = 0.5,
  onShippingCalculated 
}: ShippingCalculatorProps) {
  const [pincode, setPincode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);
  const [error, setError] = useState('');
  const [serviceability, setServiceability] = useState<{
    serviceable: boolean;
    message: string;
  } | null>(null);

  const handleCheckPincode = async () => {
    if (!/^\d{6}$/.test(pincode)) {
      setError('Please enter a valid 6-digit pincode');
      return;
    }

    setError('');
    setIsChecking(true);
    setServiceability(null);
    setShippingRate(null);

    try {
      // Check serviceability
      const result = await checkServiceability(pincode);
      setServiceability({
        serviceable: result.serviceable,
        message: result.message,
      });

      if (result.serviceable && result.zone) {
        // Calculate shipping cost
        const rate = calculateShippingCost(cartValue, weight, result.zone);
        setShippingRate(rate);
        
        if (onShippingCalculated) {
          onShippingCalculated(rate);
        }
      }
    } catch (err) {
      setError('Unable to check serviceability. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheckPincode();
    }
  };

  return (
    <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
        <MapPin className="w-4 h-4" />
        <span>CHECK DELIVERY</span>
      </div>

      {/* Pincode Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={pincode}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPincode(value);
            setError('');
            setServiceability(null);
            setShippingRate(null);
          }}
          onKeyPress={handleKeyPress}
          placeholder="Enter Pincode"
          className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-black transition-colors"
          maxLength={6}
        />
        <button
          onClick={handleCheckPincode}
          disabled={isChecking || pincode.length !== 6}
          className="px-4 py-2 bg-black text-white rounded text-sm tracking-wide hover:bg-neutral-800 transition-colors disabled:bg-neutral-400 disabled:cursor-not-allowed"
        >
          {isChecking ? 'CHECKING...' : 'CHECK'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 text-red-600 text-xs">
          <X className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Serviceability Result */}
      {serviceability && (
        <div className={`flex items-start gap-2 text-xs ${
          serviceability.serviceable ? 'text-green-700' : 'text-red-600'
        }`}>
          {serviceability.serviceable ? (
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <X className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{serviceability.message}</span>
        </div>
      )}

      {/* Shipping Details */}
      {shippingRate && serviceability?.serviceable && (
        <div className="space-y-3 pt-2 border-t border-neutral-200">
          {/* Shipping Cost */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-neutral-600" />
              <span className="text-neutral-700">Shipping Charge</span>
            </div>
            <span className="font-semibold">
              {shippingRate.isFreeShipping ? (
                <span className="text-green-600">FREE</span>
              ) : (
                `₹${shippingRate.cost}`
              )}
            </span>
          </div>

          {/* Free Shipping Progress */}
          {!shippingRate.isFreeShipping && shippingRate.zone.freeShippingThreshold > cartValue && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
              <div className="flex items-start gap-2">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  Add ₹{(shippingRate.zone.freeShippingThreshold - cartValue).toFixed(0)} more for FREE shipping!
                </span>
              </div>
            </div>
          )}

          {/* Delivery Estimate */}
          <div className="flex items-start gap-2 text-xs text-neutral-600">
            <Package className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-neutral-900">
                {formatDeliveryEstimate(shippingRate.estimatedDelivery)}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                via {shippingRate.courier.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Zone Info */}
          <div className="text-xs text-neutral-500 bg-white rounded p-2">
            <span className="font-medium">Zone:</span> {shippingRate.zone.name}
          </div>
        </div>
      )}
    </div>
  );
}
