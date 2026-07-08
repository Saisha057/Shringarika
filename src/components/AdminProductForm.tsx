"use client"

import type React from "react"
import { useState } from "react"
import type { Product } from "../data/products"
import { useAdmin } from "../context/AdminContext"
import { CATEGORIES, SUB_TYPES } from "../data/categories"
import { X, Loader2 } from "lucide-react"
import { uploadAPI } from "../services/api"

/**
 * ADMIN PRODUCT FORM
 * 
 * PURPOSE:
 * - Create new products
 * - Edit existing products
 * 
 * DATA FLOW ON SUBMIT:
 * 1. Form validates and collects data
 * 2. Calls addProduct() or updateProduct() from AdminContext
 * 3. Context updates products state (React state)
 * 4. All components subscribed to useAdmin() re-render
 * 5. Product page shows new product immediately
 * 6. Form closes via onClose() callback
 * 
 * CATEGORY SYSTEM:
 * - Uses shared CATEGORIES from data/categories.ts
 * - Same array used by product page for filtering
 * - Ensures perfect match between admin and storefront
 */

interface AdminProductFormProps {
  product: Product | null
  onClose: () => void
}

export function AdminProductForm({ product, onClose }: AdminProductFormProps) {
  const { addProduct, updateProduct } = useAdmin()

  // Form state - holds all product fields
  // FIX: category and subType are SEPARATE independent fields
  const [formData, setFormData] = useState({
    name: product?.name || "",
    price: product?.price || 0,
    category: product?.category || ("SAREES" as const),
    subType: product?.subType || "", // NEW: Independent subType field
    description: product?.description || "",
    material: product?.material || "",
    label: product?.label || (null as "NEW" | "SALE" | "LIMITED" | null),
    color: product?.color || "",
    colors: product?.colors || [],
    sizes: product?.sizes || ["XS", "S", "M", "L", "XL"],
    images: product?.images || [],
    washCare: product?.washCare || [],
    rating: product?.rating || 4.5,
    reviews: product?.reviews || 0,
  })

  const [newColor, setNewColor] = useState("")
  const [newSize, setNewSize] = useState("")
  const [newWashInstruction, setNewWashInstruction] = useState("")
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  /**
   * FORM SUBMISSION HANDLER
   * 
   * CRITICAL FLOW:
   * 1. Prevent default form submission
   * 2. Check if editing (product exists) or creating (no product)
   * 3. Call context function (addProduct or updateProduct)
   * 4. Context updates products state
   * 5. ALL components using useAdmin() re-render instantly
   * 6. Product page shows new/updated product immediately
   * 7. Close form modal via onClose callback
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isUploadingImage) {
      alert('Please wait for image upload to complete before saving.')
      return
    }

    try {
      // Validation: Ensure color is set (use first color from colors array if empty)
      const finalFormData = {
        ...formData,
        price: Number(formData.price) || 0, // Ensure price is always a number
        color: formData.color || (formData.colors.length > 0 ? formData.colors[0] : "N/A"),
      }

      if (product) {
        // EDITING EXISTING PRODUCT
        console.log("✏️ Updating product:", finalFormData.name, "| Category:", finalFormData.category, "| SubType:", finalFormData.subType)
        updateProduct(product.id, finalFormData)
        console.log("✅ Product update completed")
        alert(`Product "${finalFormData.name}" updated successfully! Returning to dashboard...`)
        
        // Close immediately after update
        setTimeout(() => {
          console.log("🔄 Closing form after update...")
          onClose()
        }, 100)
      } else {
        // CREATING NEW PRODUCT
        // NOTE: Do NOT set id here – the database generates a UUID on insert.
        // Setting id: Date.now() creates a numeric ID that breaks the UUID system.
        // NOTE: Do NOT set id: Date.now() \u2013 that creates a numeric ID that breaks the UUID system.
        // Pass id as empty string; the backend generates a real UUID on insert and returns it.
        const newProduct: Product = {
          ...finalFormData,
          id: '' as string, // placeholder \u2013 overwritten by DB-generated UUID inside addProduct()
          price: Number(finalFormData.price) || 0, // Ensure price is a number
          inStock: true,
          // CRITICAL FIX: Ensure images array is never empty
          images: finalFormData.images.length > 0 ? finalFormData.images : ["/placeholder-product.jpg"],
          // Ensure all array fields have proper defaults
          colors: finalFormData.colors.length > 0 ? finalFormData.colors : [finalFormData.color || "Default"],
          sizes: finalFormData.sizes.length > 0 ? finalFormData.sizes : ["S", "M", "L"],
          washCare: finalFormData.washCare.length > 0 ? finalFormData.washCare : ["Hand wash recommended"],
        }
        console.log("🎉 Creating product:", finalFormData.name, "| Category:", finalFormData.category, "| SubType:", finalFormData.subType, "| Images:", newProduct.images?.length ?? 0, "| Color:", finalFormData.color)
        addProduct(newProduct)
        console.log("✅ Product creation completed")
        alert(`Product "${finalFormData.name}" added successfully! Returning to dashboard...`)
        
        // Close immediately after create
        setTimeout(() => {
          console.log("🔄 Closing form after create...")
          onClose()
        }, 100)
      }
    } catch (error) {
      console.error("❌ Error saving product:", error)
      alert("Error saving product. Please try again.")
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddColor = () => {
    if (newColor && !formData.colors.includes(newColor)) {
      setFormData((prev) => ({
        ...prev,
        colors: [...prev.colors, newColor],
      }))
      setNewColor("")
    }
  }

  const handleRemoveColor = (color: string) => {
    setFormData((prev) => ({
      ...prev,
      colors: prev.colors.filter((c) => c !== color),
    }))
  }

  const handleAddSize = () => {
    if (newSize && !formData.sizes.includes(newSize)) {
      setFormData((prev) => ({
        ...prev,
        sizes: [...prev.sizes, newSize],
      }))
      setNewSize("")
    }
  }

  const handleRemoveSize = (size: string) => {
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((s) => s !== size),
    }))
  }

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploadingImage(true)
    for (const file of Array.from(files)) {
      try {
        // Upload to Cloudinary via backend – get back a permanent URL
        const response = await uploadAPI.uploadImage(file, 'products')
        const imageUrl: string = response.data?.url || response.data?.data?.url
        if (imageUrl) {
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, imageUrl],
          }))
          console.log('\u2705 Image uploaded to Cloudinary:', imageUrl)
        } else {
          throw new Error('No URL returned from upload')
        }
      } catch (error) {
        console.error('\u274c Image upload failed:', error)
        // Fallback: show preview using object URL (NOT saved to DB)
        const objectUrl = URL.createObjectURL(file)
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, objectUrl],
        }))
        alert('Image upload to server failed. The image preview is temporary and will not persist. Please check your Cloudinary configuration.')
      }
    }
    setIsUploadingImage(false)
    e.target.value = ""
  }

  const handleRemoveImage = (image: string) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((img) => img !== image),
    }))
  }

  const handleAddWashInstruction = () => {
    if (newWashInstruction && !formData.washCare.includes(newWashInstruction)) {
      setFormData((prev) => ({
        ...prev,
        washCare: [...prev.washCare, newWashInstruction],
      }))
      setNewWashInstruction("")
    }
  }

  const handleRemoveWashInstruction = (instruction: string) => {
    setFormData((prev) => ({
      ...prev,
      washCare: prev.washCare.filter((w) => w !== instruction),
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white rounded-lg max-h-[95vh] overflow-y-auto w-full max-w-2xl">
        <div className="sticky top-0 bg-white border-b border-neutral-300 p-3 md:p-4 flex items-center justify-between">
          <h2 className="text-base md:text-lg tracking-wider">{product ? "EDIT PRODUCT" : "ADD NEW PRODUCT"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 md:p-6 space-y-4">
          {/* Basic Info */}
          <div>
            <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., PREMIUM SWEATSHIRT"
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Price (₹) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">₹</span>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Primary Color</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                placeholder="e.g., BLACK (auto-filled from colors if empty)"
                className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
              />
              <p className="text-xs text-neutral-500 mt-1">Will use first color from Available Colors if left empty</p>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Sub Type</label>
              <select
                name="subType"
                value={formData.subType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
              >
                <option value="">-- Select Sub Type --</option>
                {SUB_TYPES.map((subType) => (
                  <option key={subType} value={subType}>{subType}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Available Colors</label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {formData.colors.map((color) => (
                  <div key={color} className="bg-neutral-200 px-2 py-1 rounded text-xs flex items-center gap-1">
                    {color}
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="Add color (e.g., RED)"
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddColor()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddColor}
                  className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 rounded text-xs"
                >
                  ADD
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Label (Optional)</label>
              <select
                name="label"
                value={formData.label || ""}
                onChange={(e) => {
                  const value = e.target.value as "" | "NEW" | "SALE" | "LIMITED"
                  setFormData((prev) => ({
                    ...prev,
                    label: value === "" ? null : value,
                  }))
                }}
                className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
              >
                <option value="">None</option>
                <option value="NEW">NEW</option>
                <option value="SALE">SALE</option>
                <option value="LIMITED">LIMITED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Available Sizes</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {formData.sizes.map((size) => (
                <div key={size} className="bg-neutral-200 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {size}
                  <button
                    type="button"
                    onClick={() => handleRemoveSize(size)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value.toUpperCase())}
                placeholder="Add size (e.g., XL)"
                className="flex-1 px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddSize()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddSize}
                className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 rounded text-xs"
              >
                ADD
              </button>
            </div>
          </div>

          {/* Images Section */}
          <div>
            <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">
              Product Images
              <span className="text-neutral-500 font-normal ml-2">(First image shows on product card)</span>
            </label>
            <div className="mb-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 pb-2 min-w-max">
                {formData.images.map((image, index) => (
                  <div
                    key={index}
                    className="relative shrink-0 bg-neutral-100 border border-neutral-300 rounded overflow-hidden group"
                    style={{ width: "80px", height: "80px" }}
                  >
                    <img
                      src={image}
                      alt={`Product ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3ENo Image%3C/text%3E%3C/svg%3E'
                      }}
                    />
                    {index === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs py-1 text-center">
                        PRIMARY
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <label className={`flex-1 cursor-pointer ${isUploadingImage ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="w-full px-3 py-2 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors text-xs md:text-base text-neutral-600 flex items-center justify-center gap-2">
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Browse Images</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddImage}
                  disabled={isUploadingImage}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-neutral-500 mt-1">Upload one or multiple images — images are saved to cloud storage (not database)</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Product description"
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
              required
            />
          </div>

          {/* Material */}
          <div>
            <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Material & Construction</label>
            <textarea
              name="material"
              value={formData.material}
              onChange={handleChange}
              placeholder="e.g., 100% Premium Cotton Terry, 450 GSM weight"
              rows={2}
              className="w-full px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-semibold mb-2 tracking-wide">Care Instructions</label>
            <div className="space-y-2 mb-2">
              {formData.washCare.map((instruction) => (
                <div
                  key={instruction}
                  className="bg-neutral-50 border border-neutral-200 px-2 py-1 rounded text-xs flex items-center justify-between"
                >
                  <span>{instruction}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveWashInstruction(instruction)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newWashInstruction}
                onChange={(e) => setNewWashInstruction(e.target.value)}
                placeholder="Add instruction (e.g., Machine wash cold)"
                className="flex-1 px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddWashInstruction()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddWashInstruction}
                className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 rounded text-xs"
              >
                ADD
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col md:flex-row gap-2 md:gap-3 pt-4 md:pt-6 border-t border-neutral-300">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 md:px-4 py-2 border border-neutral-300 rounded hover:bg-neutral-100 transition-colors text-xs md:text-sm tracking-wider"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 px-3 md:px-4 py-2 bg-black text-white rounded hover:bg-neutral-900 transition-colors text-xs md:text-sm tracking-wider"
            >
              {product ? "UPDATE" : "CREATE"} PRODUCT
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
