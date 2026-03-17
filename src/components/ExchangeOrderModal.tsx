import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../services/api';

interface ExchangeOrderModalProps {
  order: {
    orderId: string;
    orderNumber?: string;
    items: Array<{
      id?: string;        // order_items.id — the correct exchange identifier
      name: string;
      productId?: string;
      size?: string;
      color?: string;
      quantity: number;
    }>;
  };
  onClose: () => void;
  onSubmit: (exchangeData: ExchangeRequest) => void;
}

export interface ExchangeRequest {
  itemId: string;
  newSize?: string;
  newColor?: string;
  reason?: string;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Pink', 'Purple'];

export function ExchangeOrderModal({ order, onClose, onSubmit }: ExchangeOrderModalProps) {
  // Use item.id (order_items UUID) as the identifier — productId is NOT unique per order
  // when same product ordered in multiple sizes/colors.
  const firstItemId = order.items[0]?.id || order.items[0]?.productId || '';
  const firstItem = order.items[0];
  const [selectedItem, setSelectedItem] = useState(firstItemId);
  const [newSize, setNewSize] = useState('');
  const [newColor, setNewColor] = useState('');
  const [reason, setReason] = useState('Size issue');
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [availableVariants, setAvailableVariants] = useState<Array<{id: string; size: string; color: string; stock: number}>>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>([]);

  const selectedProduct = order.items.find(item =>
    (item.id && item.id === selectedItem) ||
    (item.productId && item.productId === selectedItem) ||
    (item.name === selectedItem)
  );

  // Reset selections when item changes
  useEffect(() => {
    setNewSize('');
    setNewColor('');
  }, [selectedItem]);

  // Fetch variants when product is selected
  useEffect(() => {
    const fetchVariants = async () => {
      if (!selectedProduct?.productId) return;

      setLoadingVariants(true);
      try {
        const response = await api.get(`/products/${selectedProduct.productId}/variants`);

        if (response.data?.data) {
          const variants = response.data.data;
          setAvailableVariants(variants);

          // Extract unique sizes and colors from variants
          const sizes = [...new Set(variants.map((v: any) => v.size).filter(Boolean))] as string[];
          const colors = [...new Set(variants.map((v: any) => v.color).filter(Boolean))] as string[];
          
          setAvailableSizes(sizes);
          setAvailableColors(colors);
          
          console.log('📦 Fetched variants for product:', selectedProduct.productId);
          console.log('   Available sizes:', sizes);
          console.log('   Available colors:', colors);
        } else {
          // Fallback to current item's variant if no variants found
          const fallbackSizes = selectedProduct.size ? [selectedProduct.size] : ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
          const fallbackColors = selectedProduct.color ? [selectedProduct.color] : ['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Pink', 'Purple'];
          setAvailableSizes(fallbackSizes);
          setAvailableColors(fallbackColors);
        }
      } catch (error) {
        console.error('❌ Error fetching variants:', error);
        // Fallback to showing current item's variant plus common options
        const fallbackSizes = selectedProduct.size 
          ? [selectedProduct.size, ...['XS', 'S', 'M', 'L', 'XL', 'XXL'].filter(s => s !== selectedProduct.size)]
          : ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
        const fallbackColors = selectedProduct.color 
          ? [selectedProduct.color, ...['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Pink', 'Purple'].filter(c => c !== selectedProduct.color)]
          : ['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Pink', 'Purple'];
        setAvailableSizes(fallbackSizes);
        setAvailableColors(fallbackColors);
      } finally {
        setLoadingVariants(false);
      }
    };

    fetchVariants();
  }, [selectedProduct?.productId]);

  const handleSubmit = () => {
    if (!selectedItem) {
      alert('Please select an item to exchange');
      return;
    }
    if (!newSize && !newColor) {
      alert('Please select a new size or color');
      return;
    }
    
    // Ensure user selects something different
    const currentSize = selectedProduct?.size;
    const currentColor = selectedProduct?.color;
    if (newSize === currentSize && newColor === currentColor) {
      alert('Please select a different size or color for exchange');
      return;
    }

    onSubmit({
      itemId: selectedItem,
      newSize: newSize || undefined,
      newColor: newColor || undefined,
      reason: reason
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-xl font-semibold tracking-wider">EXCHANGE ORDER</h2>
            <p className="text-sm text-neutral-600">Order #{order.orderNumber || order.orderId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-lg font-medium mb-4">Select Item to Exchange</h3>
          
          <div className="space-y-3 mb-6">
            {order.items.map((item, index) => {
              const itemValue = item.id || item.productId || `item-${index}`;
              return (
                <label key={index} className="flex items-center gap-3 p-3 border border-neutral-300 rounded hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="radio"
                    name="selectedItem"
                    value={itemValue}
                    checked={selectedItem === itemValue}
                    onChange={(e) => setSelectedItem(e.target.value)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-neutral-600">
                      {item.size || item.color ? (
                        <>
                          {item.size && <span>Size: <strong>{item.size}</strong></span>}
                          {item.size && item.color && <span> | </span>}
                          {item.color && <span>Color: <strong>{item.color}</strong></span>}
                        </>
                      ) : (
                        <span className="text-yellow-600">⚠️ No variant details available</span>
                      )}
                      {item.quantity && <span className="ml-2">• Qty: {item.quantity}</span>}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {selectedProduct && (
            <>
              <h3 className="text-lg font-medium mb-4">Select New Options</h3>
              
              {loadingVariants ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                  <p className="text-sm text-neutral-600 mt-2">Loading available options...</p>
                </div>
              ) : (
                <>
                  {/* Size Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">New Size:</label>
                    {availableSizes.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {availableSizes.map(size => (
                          <button
                            key={size}
                            onClick={() => setNewSize(size)}
                            className={`py-2 px-4 border rounded text-sm ${
                              newSize === size
                                ? 'border-black bg-black text-white'
                                : 'border-neutral-300 hover:border-black'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 bg-yellow-50 border border-yellow-200 rounded p-3">
                        No size variants available for this product
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-1">
                      Current size: {selectedProduct.size || 'N/A'}
                    </p>
                  </div>

                  {/* Color Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">New Color:</label>
                    {availableColors.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {availableColors.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewColor(color)}
                            className={`py-2 px-4 border rounded text-sm ${
                              newColor === color
                                ? 'border-black bg-black text-white'
                                : 'border-neutral-300 hover:border-black'
                            }`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 bg-yellow-50 border border-yellow-200 rounded p-3">
                        No color variants available for this product
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-1">
                      Current color: {selectedProduct.color || 'N/A'}
                    </p>
                  </div>

                  {/* Reason */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Reason for Exchange:</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="Size issue">Size doesn't fit</option>
                      <option value="Color preference">Want different color</option>
                      <option value="Style preference">Style preference</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {availableSizes.length === 0 && availableColors.length === 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
                      <p className="text-sm text-red-800">
                        <strong>❌ No Variants Available:</strong> This product has no size or color options available for exchange. Please contact customer support for assistance.
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      <strong>Exchange Process:</strong> We'll verify stock availability and process your exchange within 24-48 hours. You'll receive the new item within 5-7 business days after approval.
                    </p>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={(!newSize && !newColor) || loadingVariants || (availableSizes.length === 0 && availableColors.length === 0)}
                    className="w-full py-3 bg-blue-600 text-white rounded-full text-sm tracking-wider hover:bg-blue-700 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed"
                  >
                    SUBMIT EXCHANGE REQUEST
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
