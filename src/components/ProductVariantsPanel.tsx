import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, AlertCircle, Package, RefreshCw, Check, X } from 'lucide-react';

interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string | null;
  sku: string | null;
  stock: number;
  price?: number | null;
  is_active?: boolean;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
  isLowStock?: boolean;
  lowStockThreshold?: number;
}

interface ProductVariantsPanelProps {
  productId: string;
  onClose?: () => void;
}

const LOW_STOCK_THRESHOLD = 5;

export function ProductVariantsPanel({ productId, onClose }: ProductVariantsPanelProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Auto-generate state
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [defaultStock, setDefaultStock] = useState(50);
  
  // Predefined options
  const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'Free Size'];
  const COLOR_OPTIONS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Orange', 'Brown', 'Grey', 'Multicolor'];
  
  // Fetch variants
  const fetchVariants = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/products/${productId}/variants`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch variants');
      
      const data = await response.json();
      const variantsWithStatus = data.data.map((v: ProductVariant) => ({
        ...v,
        isLowStock: v.stock < LOW_STOCK_THRESHOLD
      }));
      setVariants(variantsWithStatus);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load variants');
      console.error('Error fetching variants:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchVariants();
  }, [productId]);
  
  // Update a single variant field
  const updateVariantField = (variantId: string, field: keyof ProductVariant, value: any) => {
    setVariants(prev => prev.map(v => 
      v.id === variantId ? { ...v, [field]: value } : v
    ));
  };
  
  // Save a single variant
  const saveVariant = async (variant: ProductVariant) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `/api/products/${productId}/variants/${variant.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            size: variant.size,
            color: variant.color,
            sku: variant.sku,
            stock: variant.stock,
            price: variant.price,
            is_active: variant.is_active
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to update variant');
      
      const data = await response.json();
      
      // Update the variant in state with server response
      setVariants(prev => prev.map(v => 
        v.id === variant.id ? { ...data.data, isLowStock: data.data.stock < LOW_STOCK_THRESHOLD } : v
      ));
      
      setSuccess(`Variant updated successfully${data.data.isLowStock ? ' - Low stock alert!' : ''}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save variant');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSaving(false);
    }
  };
  
  // Delete a variant
  const deleteVariant = async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/products/${productId}/variants/${variantId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to delete variant');
      
      setVariants(prev => prev.filter(v => v.id !== variantId));
      setSuccess('Variant deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete variant');
      setTimeout(() => setError(''), 3000);
    }
  };
  
  // Auto-generate variants
  const autoGenerateVariants = async () => {
    if (selectedSizes.length === 0) {
      setError('Please select at least one size');
      return;
    }
    
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `/api/products/${productId}/auto-variants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sizes: selectedSizes,
            colors: selectedColors.length > 0 ? selectedColors : null,
            defaultStock: defaultStock
          })
        }
      );
      
      if (!response.ok) throw new Error('Failed to generate variants');
      
      const data = await response.json();
      setSuccess(`Created ${data.data.count} new variants`);
      setShowAutoGenerate(false);
      setSelectedSizes([]);
      setSelectedColors([]);
      await fetchVariants(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to generate variants');
    } finally {
      setSaving(false);
    }
  };
  
  // Restock a variant
  const restockVariant = async (variantId: string) => {
    const quantity = prompt('Enter quantity to add:');
    if (!quantity || isNaN(parseInt(quantity))) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/products/${productId}/variants/${variantId}/restock`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ quantity: parseInt(quantity) })
        }
      );
      
      if (!response.ok) throw new Error('Failed to restock');
      
      const data = await response.json();
      setVariants(prev => prev.map(v => 
        v.id === variantId ? { ...data.data, isLowStock: data.data.stock < LOW_STOCK_THRESHOLD } : v
      ));
      
      setSuccess(data.message);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to restock');
      setTimeout(() => setError(''), 3000);
    }
  };
  
  const lowStockCount = variants.filter(v => v.isLowStock).length;
  const outOfStockCount = variants.filter(v => v.stock === 0).length;
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Variants</h2>
          <p className="text-sm text-gray-600 mt-1">
            {variants.length} variants • {lowStockCount} low stock • {outOfStockCount} out of stock
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAutoGenerate(!showAutoGenerate)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Auto Generate
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
          )}
        </div>
      </div>
      
      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
          <Check size={20} />
          {success}
        </div>
      )}
      
      {/* Auto Generate Form */}
      {showAutoGenerate && (
        <div className="mb-6 p-6 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-purple-900">Auto Generate All Combinations</h3>
          
          <div className="space-y-4">
            {/* Size Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Sizes *
              </label>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSizes(prev => 
                        prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                      );
                    }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                      selectedSizes.includes(size)
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Colors (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColors(prev => 
                        prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
                      );
                    }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                      selectedColors.includes(color)
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Default Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Stock for Each Variant
              </label>
              <input
                type="number"
                value={defaultStock}
                onChange={(e) => setDefaultStock(parseInt(e.target.value) || 0)}
                min="0"
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            {/* Generate Button */}
            <div className="flex gap-2">
              <button
                onClick={autoGenerateVariants}
                disabled={saving || selectedSizes.length === 0}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Generate {selectedSizes.length * (selectedColors.length || 1)} Variants
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowAutoGenerate(false);
                  setSelectedSizes([]);
                  setSelectedColors([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Variants Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw size={32} className="animate-spin text-purple-600" />
        </div>
      ) : variants.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">No variants found. Create your first variant!</p>
          <button
            onClick={() => setShowAutoGenerate(true)}
            className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Auto Generate Variants
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Size</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Color</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Active</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id} className="border-b hover:bg-gray-50 transition">
                  {/* Status Badge */}
                  <td className="px-4 py-3">
                    {variant.stock === 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        OUT OF STOCK
                      </span>
                    ) : variant.isLowStock ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <AlertCircle size={12} className="mr-1" />
                        LOW STOCK
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        IN STOCK
                      </span>
                    )}
                  </td>
                  
                  {/* Size */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={variant.size}
                      onChange={(e) => updateVariantField(variant.id, 'size', e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </td>
                  
                  {/* Color */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={variant.color || ''}
                      onChange={(e) => updateVariantField(variant.id, 'color', e.target.value || null)}
                      placeholder="Optional"
                      className="w-28 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </td>
                  
                  {/* SKU */}
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={variant.sku || ''}
                      onChange={(e) => updateVariantField(variant.id, 'sku', e.target.value || null)}
                      placeholder="Auto"
                      className="w-32 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                    />
                  </td>
                  
                  {/* Stock */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={variant.stock}
                        onChange={(e) => updateVariantField(variant.id, 'stock', parseInt(e.target.value) || 0)}
                        min="0"
                        className={`w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm ${
                          variant.stock === 0 ? 'border-red-300 bg-red-50' :
                          variant.isLowStock ? 'border-yellow-300 bg-yellow-50' :
                          'border-gray-300'
                        }`}
                      />
                      {variant.isLowStock && (
                        <button
                          onClick={() => restockVariant(variant.id)}
                          title="Restock"
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Package size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                  
                  {/* Price */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={variant.price || ''}
                      onChange={(e) => updateVariantField(variant.id, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Base"
                      step="0.01"
                      className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </td>
                  
                  {/* Active */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={variant.is_active !== false}
                      onChange={(e) => updateVariantField(variant.id, 'is_active', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </td>
                  
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => saveVariant(variant)}
                        disabled={saving}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Save"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => deleteVariant(variant.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ProductVariantsPanel;
