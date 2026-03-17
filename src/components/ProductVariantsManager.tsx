"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, Save, X, Package, Loader2 } from "lucide-react"
import type { Product } from "../data/products"
import { productAPI } from "../services/api"
import { createClient } from "@supabase/supabase-js"

// Utility: Validate if ID is a proper UUID (backend ID)
function isUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ProductVariant {
  id: string
  productId: number
  sku: string
  size?: string
  color?: string
  material?: string
  stock: number
  priceModifier: number // percentage modifier (e.g., 10 = +10%, -5 = -5%)
  barcode?: string
  image?: string
}

interface ProductVariantsManagerProps {
  product: Product
  onClose: () => void
  onSave: (variants: ProductVariant[]) => void
}

export function ProductVariantsManager({ product, onClose, onSave }: ProductVariantsManagerProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [sizes, setSizes] = useState<string[]>(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
  const [colors, setColors] = useState<string[]>(['Red', 'Blue', 'Green', 'Black', 'White', 'Pink', 'Yellow', 'Purple'])
  const [materials, setMaterials] = useState<string[]>(['Silk', 'Cotton', 'Chiffon', 'Georgette', 'Banarasi', 'Kanjivaram'])
  const [customSize, setCustomSize] = useState('')
  const [customColor, setCustomColor] = useState('')
  const [customMaterial, setCustomMaterial] = useState('')
  const [autoGenerateMode, setAutoGenerateMode] = useState(false)
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [defaultStock, setDefaultStock] = useState<number>(50) // Admin-configurable default
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prevent realtime from overwriting unsaved admin edits
  const isDirty = useRef(false)
  // Prevent realtime from firing mid-save (between create/update/delete calls)
  const isSaving = useRef(false)
  // Collect backend UUIDs to delete from DB when admin clicks Save
  const pendingDeletes = useRef<string[]>([])

  const fetchVariantsWithRetry = async (
    productId: string,
    retries = 3,
    delayMs = 1000
  ) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await productAPI.getVariants(productId);
        return response;
      } catch (error: any) {
        if (error?.response?.status === 429) {
          console.warn(`[Variants] Rate limited, attempt ${attempt}/${retries}. Waiting ${delayMs}ms...`);
          if (attempt < retries) {
            await sleep(delayMs * attempt);
            continue;
          }
        }
        throw error;
      }
    }
    throw new Error('Max retries reached for variants fetch');
  }

  useEffect(() => {
    loadVariants()
    
    // Set up real-time subscription for variant changes
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase credentials missing - real-time updates disabled')
      return
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const productId = typeof product.id === 'number' ? String(product.id) : product.id
    
    console.log('🔄 Setting up real-time subscription for product:', productId)
    
    const channel = supabase
      .channel(`product_inventory_${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'product_inventory',
          filter: `product_id=eq.${productId}`
        },
        (payload) => {
          console.log('🔔 Real-time variant update:', payload)
          // Skip reload if admin has unsaved edits OR a save is in progress
          // This prevents realtime from clobbering unsaved changes
          if (isDirty.current || isSaving.current) {
            console.log('⏸️ Skipping realtime reload — unsaved edits or save in progress')
            return
          }
          loadVariants()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active')
        }
      })
    
    return () => {
      console.log('🔌 Cleaning up real-time subscription')
      supabase.removeChannel(channel)
    }
  }, [product.id])

  const loadVariants = async () => {
    setLoading(true)
    setError(null)
    try {
      // Load from backend ONLY - backend is single source of truth
      const productId = typeof product.id === 'number' ? String(product.id) : product.id
      const response = await fetchVariantsWithRetry(productId)
      
      if (response.data) {
        // Map backend data to local format
        const backendVariants = response.data.map((v: any) => ({
          id: v.id, // Backend UUID
          productId: product.id,
          sku: v.sku || generateSKU(product.id, v.size, v.color, v.material),
          size: v.size,
          color: v.color,
          material: v.material || undefined,
          stock: v.stock || 0,
          priceModifier: 0,
        }))
        setVariants(backendVariants)

        // Merge any DB-stored colors/materials that aren't in the default lists
        // This prevents "–" from showing for values like "Brown" or "Chiken kari"
        const dbColors = backendVariants.map((v: any) => v.color).filter(Boolean) as string[]
        const dbMaterials = backendVariants.map((v: any) => v.material).filter(Boolean) as string[]
        setColors(prev => {
          const additions = dbColors.filter(c => !prev.includes(c))
          return additions.length > 0 ? [...prev, ...additions] : prev
        })
        setMaterials(prev => {
          const additions = dbMaterials.filter(m => !prev.includes(m))
          return additions.length > 0 ? [...prev, ...additions] : prev
        })

        console.log(`✅ Loaded ${backendVariants.length} variants from backend`)
      } else {
        setVariants([])
      }
    } catch (err: any) {
      console.error('❌ Failed to load variants from backend:', err)
      setError(`Failed to load variants: ${err.message || 'Unknown error'}`)
      setVariants([]) // Don't fall back to localStorage
    } finally {
      setLoading(false)
    }
  }

  const generateSKU = (productId: number, size?: string, color?: string, material?: string): string => {
    const category = product.category.substring(0, 4).toUpperCase()
    const sizeCode = size ? size.substring(0, 2).toUpperCase() : 'OS'
    const colorCode = color ? color.substring(0, 3).toUpperCase() : 'STD'
    const materialCode = material ? material.substring(0, 3).toUpperCase() : 'REG'
    const timestamp = Date.now().toString().slice(-4)
    return `${category}-${productId}-${sizeCode}-${colorCode}-${materialCode}-${timestamp}`
  }

  const addVariant = () => {
    const newVariant: ProductVariant = {
      id: Date.now().toString(),
      productId: product.id,
      sku: generateSKU(product.id),
      size: undefined,
      color: undefined,
      material: undefined,
      stock: 0,
      priceModifier: 0,
    }
    isDirty.current = true
    setVariants([...variants, newVariant])
  }

  const autoGenerateVariants = async () => {
    setError(null)
    
    // Generate all combinations
    if (selectedSizes.length === 0 && selectedColors.length === 0 && selectedMaterials.length === 0) {
      alert('Please select at least one size, color, or material')
      return
    }

    setLoading(true)

    try {
      // Try to create variants on backend
      const productId = typeof product.id === 'number' ? String(product.id) : product.id
      const response = await productAPI.autoGenerateVariants(productId, {
        sizes: selectedSizes.length > 0 ? selectedSizes : ['One Size'],
        colors: selectedColors.length > 0 ? selectedColors : undefined,
        materials: selectedMaterials.length > 0 ? selectedMaterials : undefined,
        defaultStock: defaultStock, // Use admin-configured value
      })

      // Reload variants from backend
      await loadVariants()
      
      setAutoGenerateMode(false)
      setSelectedSizes([])
      setSelectedColors([])
      setSelectedMaterials([])
    } catch (err: any) {
      console.error('Failed to auto-generate variants on backend:', err)
      // Do NOT fall back to local generation — local variants can't be tracked
      // and cause ghost variant / duplicate issues when realtime reloads
      setError(`Failed to generate variants: ${err.message || 'Unknown error'}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    isDirty.current = true
    setVariants(variants.map(v => {
      if (v.id === id) {
        const updated = { ...v, [field]: value }
        // Auto-regenerate SKU if size, color, or material changes
        if (field === 'size' || field === 'color' || field === 'material') {
          updated.sku = generateSKU(product.id, updated.size, updated.color, updated.material)
        }
        return updated
      }
      return v
    }))
  }

  const deleteVariant = (id: string) => {
    isDirty.current = true
    // If this variant has a backend UUID, schedule it for deletion on Save
    if (isUUID(id)) {
      pendingDeletes.current = [...pendingDeletes.current, id]
    }
    setVariants(variants.filter(v => v.id !== id))
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    // Lock realtime reloads for the entire save operation
    isSaving.current = true

    try {
      // Backend is the ONLY source of truth - no localStorage
      const productId = typeof product.id === 'number' ? String(product.id) : product.id

      console.log('💾 Saving variants to backend:', variants.length, 'variants')

      // Separate new variants (without backend id) from existing ones
      // Use proper UUID validation instead of unsafe length check
      const existingVariants = variants.filter(v => v.id && isUUID(v.id)) // Backend UUIDs
      const newVariants = variants.filter(v => !v.id || !isUUID(v.id)) // Local IDs

      console.log(`  - ${existingVariants.length} existing variants to update`)
      console.log(`  - ${newVariants.length} new variants to create`)

      // 1. Create new variants using addSingleVariant
      for (const variant of newVariants) {
        if (!variant.size) {
          console.warn('⚠️ Skipping variant without size:', variant)
          continue
        }

        try {
          console.log(`  Creating variant: ${variant.size} / ${variant.color || 'default'}`)
          await productAPI.addSingleVariant(productId, {
            size: variant.size,
            color: variant.color || undefined,
            material: variant.material || undefined,
            sku: variant.sku,
            stock: variant.stock,
          })
        } catch (createError: any) {
          console.error(`  Failed to create variant ${variant.size}:`, createError.message)
          // Continue with other variants
        }
      }

      // 2. Update existing variants using bulk update
      if (existingVariants.length > 0) {
        try {
          console.log('  Bulk updating existing variants...')
          await productAPI.bulkUpdateVariants(productId, existingVariants.map(v => ({
            id: v.id,
            size: v.size,
            color: v.color || null,
            material: v.material || null,
            sku: v.sku,
            stock: v.stock,
            is_active: true,
          })))
          console.log('  ✅ Bulk update successful')
        } catch (bulkError: any) {
          console.error('  Failed bulk update:', bulkError.message)
          throw bulkError
        }
      }

      console.log('✅ All variants saved successfully')

      // Delete variants that admin removed from the table
      if (pendingDeletes.current.length > 0) {
        console.log(`  Deleting ${pendingDeletes.current.length} removed variant(s) from DB...`)
        for (const variantId of pendingDeletes.current) {
          try {
            await productAPI.deleteVariant(productId, variantId)
            console.log(`  ✅ Deleted variant ${variantId}`)
          } catch (delErr: any) {
            console.warn(`  ⚠️ Could not delete variant ${variantId}:`, delErr.message)
          }
        }
        pendingDeletes.current = []
      }

      // All done — unlock realtime and clear dirty flag, then reload clean data
      isDirty.current = false
      isSaving.current = false
      await loadVariants()

      onSave(variants)
      onClose()
    } catch (err: any) {
      console.error('❌ Failed to save variants to backend:', err)
      setError(`Failed to save to server: ${err.message || 'Unknown error'}`)
      // Don't close modal on error - let user retry
    } finally {
      // Always unlock saving state so realtime can resume
      isSaving.current = false
      setLoading(false)
    }
  }

  const addCustomSize = () => {
    if (customSize && !sizes.includes(customSize)) {
      setSizes([...sizes, customSize])
      setCustomSize('')
    }
  }

  const addCustomColor = () => {
    if (customColor && !colors.includes(customColor)) {
      setColors([...colors, customColor])
      setCustomColor('')
    }
  }

  const addCustomMaterial = () => {
    if (customMaterial && !materials.includes(customMaterial)) {
      setMaterials([...materials, customMaterial])
      setCustomMaterial('')
    }
  }

  const calculateVariantPrice = (basePrice: number, modifier: number | undefined): number => {
    const validModifier = Number(modifier) || 0
    return basePrice + (basePrice * validModifier / 100)
  }

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-1">Product Variants</h2>
              <p className="text-neutral-600">{product.name}</p>
              <p className="text-sm text-neutral-500 mt-1">
                Base Price: ₹{product.price} • Total Stock: {totalStock} units • {variants.length} variants
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">!</div>
                <div className="flex-1">
                  <p className="font-bold text-red-900 mb-1">Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="flex-shrink-0 p-1 hover:bg-red-100 rounded"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={addVariant}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" />
              Add Single Variant
            </button>
            <button
              onClick={() => setAutoGenerateMode(!autoGenerateMode)}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-neutral-50"
            >
              <Package className="h-4 w-4" />
              Auto-Generate Variants
            </button>
          </div>

          {/* Auto-Generate Mode */}
          {autoGenerateMode && (
            <div className="mb-6 p-6 border rounded-lg bg-blue-50">
              <h3 className="font-bold mb-4">Auto-Generate All Combinations</h3>
              
              {/* Size Selection */}
              <div className="mb-4">
                <label className="block font-medium mb-2">Select Sizes</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSizes(prev => 
                        prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                      )}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedSizes.includes(size)
                          ? 'bg-black text-white'
                          : 'bg-white border hover:border-black'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    placeholder="Add custom size"
                    className="px-3 py-1 border rounded text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomSize()}
                  />
                  <button onClick={addCustomSize} className="px-3 py-1 bg-neutral-100 rounded text-sm">
                    Add
                  </button>
                </div>
              </div>

              {/* Color Selection */}
              <div className="mb-4">
                <label className="block font-medium mb-2">Select Colors</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColors(prev => 
                        prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
                      )}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedColors.includes(color)
                          ? 'bg-black text-white'
                          : 'bg-white border hover:border-black'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    placeholder="Add custom color"
                    className="px-3 py-1 border rounded text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomColor()}
                  />
                  <button onClick={addCustomColor} className="px-3 py-1 bg-neutral-100 rounded text-sm">
                    Add
                  </button>
                </div>
              </div>

              {/* Material Selection */}
              <div className="mb-4">
                <label className="block font-medium mb-2">Select Materials</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {materials.map(material => (
                    <button
                      key={material}
                      onClick={() => setSelectedMaterials(prev => 
                        prev.includes(material) ? prev.filter(m => m !== material) : [...prev, material]
                      )}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedMaterials.includes(material)
                          ? 'bg-black text-white'
                          : 'bg-white border hover:border-black'
                      }`}
                    >
                      {material}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    placeholder="Add custom material"
                    className="px-3 py-1 border rounded text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomMaterial()}
                  />
                  <button onClick={addCustomMaterial} className="px-3 py-1 bg-neutral-100 rounded text-sm">
                    Add
                  </button>
                </div>
              </div>

              {/* Default Stock Input */}
              <div className="mb-4 p-4 bg-white rounded border-2 border-blue-300">
                <label className="block font-bold mb-2 text-blue-900">Default Stock Quantity</label>
                <p className="text-sm text-neutral-600 mb-3">
                  Set the initial stock quantity for all generated variants
                </p>
                <input
                  type="number"
                  value={defaultStock}
                  onChange={(e) => setDefaultStock(Number(e.target.value))}
                  min="0"
                  className="w-32 px-4 py-2 border-2 border-blue-400 rounded text-lg font-bold focus:border-blue-600 focus:outline-none"
                  placeholder="50"
                />
                <span className="ml-3 text-neutral-600">units per variant</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={autoGenerateVariants}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Generate {selectedSizes.length || 1} × {selectedColors.length || 1} × {selectedMaterials.length || 1} = {(selectedSizes.length || 1) * (selectedColors.length || 1) * (selectedMaterials.length || 1)} Variants
                </button>
                <button
                  onClick={() => setAutoGenerateMode(false)}
                  className="px-4 py-2 border rounded hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Variants List */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin text-blue-600" />
              <p className="text-neutral-600">Loading variants...</p>
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No variants created yet</p>
              <p className="text-sm mt-1">Add variants manually or use auto-generate</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="px-3 py-2 text-left text-sm font-medium">SKU</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Size</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Color</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Material</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Stock</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Price Modifier (%)</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Final Price</th>
                      <th className="px-3 py-2 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map(variant => (
                      <tr key={variant.id} className="border-b hover:bg-neutral-50">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={variant.sku}
                            onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={variant.size || ''}
                            onChange={(e) => updateVariant(variant.id, 'size', e.target.value || undefined)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="">-</option>
                            {sizes.map(size => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={variant.color || ''}
                            onChange={(e) => updateVariant(variant.id, 'color', e.target.value || undefined)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="">-</option>
                            {colors.map(color => (
                              <option key={color} value={color}>{color}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={variant.material || ''}
                            onChange={(e) => updateVariant(variant.id, 'material', e.target.value || undefined)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="">-</option>
                            {materials.map(material => (
                              <option key={material} value={material}>{material}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={variant.stock}
                            onChange={(e) => updateVariant(variant.id, 'stock', Number(e.target.value))}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={variant.priceModifier}
                            onChange={(e) => updateVariant(variant.id, 'priceModifier', Number(e.target.value))}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            step="1"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          ₹{calculateVariantPrice(product.price, variant.priceModifier).toFixed(0)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => deleteVariant(variant.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-neutral-50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-600">
              {variants.length} variant{variants.length !== 1 ? 's' : ''} • Total Stock: {totalStock} units
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border rounded hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Variants
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
