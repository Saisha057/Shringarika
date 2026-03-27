"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Product } from "../data/products"
import { products as initialProducts } from "../data/products"
import { productAPI } from '../services/api'

/**
 * ADMIN CONTEXT - SINGLE SOURCE OF TRUTH FOR PRODUCTS
 * 
 * DATA FLOW:
 * 1. Products stored in React state (reactive)
 * 2. Synced with localStorage (persistent)
 * 3. All components read from same context (consistent)
 * 4. Updates trigger re-renders everywhere (instant)
 * 
 * CRITICAL: This context is used by:
 * - Admin pages (add/edit/delete products)
 * - Product pages (display products)
 * - Cart (add to cart)
 * - All must be wrapped by AdminProvider
 */

export interface StockInfo {
  productId: string
  sizes: Record<string, number> // size -> quantity
  isVisible: boolean
  isNewArrival: boolean
  isFeatured: boolean
  lastUpdated: Date
}

export interface RestockNotification {
  id: string
  email: string
  productId: string
  size: string
  notified: boolean
  createdAt: Date
}

interface AdminContextType {
  products: Product[]
  stock: Record<string, StockInfo>
  restockNotifications: RestockNotification[]
  isAdminMode: boolean

  // Product management
  addProduct: (product: Product) => void
  updateProduct: (productId: string, updates: Partial<Product>) => void
  deleteProduct: (productId: string) => void

  // Stock management
  updateStock: (productId: string, size: string, quantity: number) => void
  toggleProductVisibility: (productId: string) => void
  getProductStock: (productId: string) => StockInfo | undefined

  // Restock notifications
  addRestockNotification: (email: string, productId: string, size: string) => void
  getRestockNotifications: (productId: string, size: string) => RestockNotification[]
  notifyRestocked: (productId: string, size: string) => void

  // Admin mode
  setAdminMode: (isAdmin: boolean) => void

  // New arrivals management
  markAsNewArrival: (productId: string, isNew: boolean) => void
  markAsFeatured: (productId: string, isFeatured: boolean) => void
  getNewArrivals: () => Product[]
  getFeaturedProducts: () => Product[]
}

export const AdminContext = createContext<AdminContextType | undefined>(undefined)

// ── localStorage helpers ─────────────────────────────────────────────────────
// Valid UUID format (36 chars like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (id: string | number): boolean => UUID_REGEX.test(String(id));

// Strip base64 / blob data from a product before caching (those live in the DB)
function stripLargeFields(product: Product): Product {
  return {
    ...product,
    images: (product.images ?? []).map((img: string) =>
      typeof img === 'string' && (img.startsWith('data:') || img.startsWith('blob:'))
        ? ''
        : img
    ),
    specifications: product.specifications
      ? {
          ...(product.specifications as Record<string, unknown>),
          images: ((product.specifications as Record<string, unknown>)?.images as string[] ?? []).map(
            (img: string) =>
              typeof img === 'string' && (img.startsWith('data:') || img.startsWith('blob:'))
                ? ''
                : img
          ),
        }
      : product.specifications,
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.warn(`⚠️ localStorage quota exceeded for key "${key}". Clearing cache.`)
      try { localStorage.removeItem(key) } catch {}
    } else {
      console.error('localStorage error:', e)
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export function AdminProvider({ children }: { children: ReactNode }) {
  /**
   * PRODUCTS STATE - THE SINGLE SOURCE OF TRUTH
   * All pages read from this same state
   * When this updates, all subscribers re-render
   */
  const [products, setProducts] = useState<Product[]>([])
  const [stock, setStock] = useState<Record<string, StockInfo>>({})
  const [restockNotifications, setRestockNotifications] = useState<RestockNotification[]>([])
  // Keep admin mode session-local; do not auto-restore on app launch.
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  /**
   * LOAD DATA FROM BACKEND ON MOUNT
   * Runs once when app starts
   * Fetches products from Supabase database
   */
  useEffect(() => {
    const loadProducts = async () => {
      console.log("🔄 Loading products from backend...")
      
      // Clear any oversized cached data proactively to free localStorage quota
      try {
        const existingCache = localStorage.getItem("adminProducts")
        if (existingCache && existingCache.length > 500_000) {
          console.warn("⚠️ adminProducts cache too large, clearing to free quota")
          localStorage.removeItem("adminProducts")
        }
      } catch {}

      // ALWAYS load from localStorage first for instant display
      const savedProducts = localStorage.getItem("adminProducts")
      if (savedProducts) {
        try {
          const parsed = JSON.parse(savedProducts)
          // CRITICAL: Filter out legacy numeric-ID products – they only exist in localStorage
          // and do NOT exist in the database, causing 404/500 errors on delete/update
          const validCached = parsed.filter((p: Product) => isUUID(p.id))
          if (validCached.length !== parsed.length) {
            console.warn(`⚠️ Purged ${parsed.length - validCached.length} legacy numeric-ID products from localStorage cache`)
          }
          if (validCached.length > 0) {
            console.log("\u2705 Loaded", validCached.length, "valid UUID products from localStorage (instant display)")
            setProducts(validCached)
          }
        } catch (err) {
          console.error("Error parsing cached products:", err)
          setProducts([])
        }
      } else {
        console.log("⚠️ No cached products found in localStorage")
        setProducts([])
      }
      
      // Then try to sync with backend in background
      try {
        const response = await productAPI.getAll()
        console.log("📦 API Response:", response)
        
        // Extract products array from response
        const productsData = response.data || []
        console.log("📡 Backend returned", productsData.length, "products")
        
        // ALWAYS sync with backend - backend is the single source of truth
        // Only keep products with valid UUID IDs (DB-created)
        const validProducts = productsData.filter((p: Product) => isUUID(p.id))
        console.log("\u2705 Syncing with", validProducts.length, "valid UUID products from backend")
        setProducts(validProducts)
        // Update localStorage cache — strip large image data to avoid quota errors
        safeSetItem("adminProducts", JSON.stringify(validProducts.map(stripLargeFields)))
        console.log("💾 localStorage synced with database")
      } catch (error) {
        console.error("❌ Backend connection failed (using localStorage only):", error)
        // Keep localStorage products (already loaded above)
      }

      // Load stock from localStorage (can be moved to backend later)
      const savedStock = localStorage.getItem("adminStock")
      if (savedStock) {
        try {
          setStock(JSON.parse(savedStock))
        } catch (error) {
          console.error("Error loading stock:", error)
        }
      }

      // Load notifications from localStorage
      const savedNotifications = localStorage.getItem("adminNotifications")
      if (savedNotifications) {
        try {
          setRestockNotifications(JSON.parse(savedNotifications))
        } catch (error) {
          console.error("Error loading notifications:", error)
        }
      }

      setIsInitialized(true)
    }

    loadProducts()
  }, [])

  /**
   * AUTO-SAVE TO LOCALSTORAGE WHEN PRODUCTS CHANGE
   * This ensures data persists across page refreshes
   * Runs every time products array changes
   */
  useEffect(() => {
    if (isInitialized && products.length > 0) {
      console.log("💾 Saving", products.length, "products to localStorage")
      safeSetItem("adminProducts", JSON.stringify(products.map(stripLargeFields)))
    }
  }, [products, isInitialized])

  // Save stock to localStorage
  useEffect(() => {
    if (isInitialized) {
      safeSetItem("adminStock", JSON.stringify(stock))
    }
  }, [stock, isInitialized])

  // Save notifications to localStorage
  useEffect(() => {
    if (isInitialized) {
      safeSetItem("adminNotifications", JSON.stringify(restockNotifications))
    }
  }, [restockNotifications, isInitialized])

  /**
   * ADD NEW PRODUCT
   * 
   * CRITICAL FLOW:
   * 1. Admin fills form and submits
   * 2. This function is called with product data
   * 3. Product saved to Supabase via API
   * 4. Product added to local state (instant UI update)
   * 5. React re-renders ALL components using useAdmin()
   * 6. Product page automatically shows new product
   */
  const addProduct = async (product: Product) => {
    try {
      console.log("➕ Adding product:", product.name, "| Category:", product.category)
      
      let newProduct = product
      
      // MUST save to backend first
      try {
        const response = await productAPI.create(product)
        newProduct = response.data
        console.log("✅ Product created in database:", newProduct)
      } catch (apiError) {
        console.error("❌ Backend creation failed:", apiError)
        throw apiError // Don't continue if backend fails
      }
      
      // ONLY update local state if backend create succeeded
      setProducts((prev) => {
        const updated = [...prev, newProduct]
        console.log("📊 Total products after add:", updated.length)
        safeSetItem("adminProducts", JSON.stringify(updated.map(stripLargeFields)))
        console.log("💾 Saved to localStorage")
        return updated
      })

      // Initialize stock for new product
      const newStock: StockInfo = {
        productId: String(newProduct.id),
        sizes: (product.sizes ?? []).reduce((acc, size) => ({ ...acc, [size]: 50 }), {}),
        isVisible: true,
        isNewArrival: false,
        isFeatured: false,
        lastUpdated: new Date(),
      }
      setStock((prev) => {
        const updatedStock = { ...prev, [newProduct.id]: newStock }
        safeSetItem("adminStock", JSON.stringify(updatedStock))
        return updatedStock
      })

      console.log("✅ Product added successfully!")
    } catch (error: any) {
      console.error("❌ Error adding product:", error)
      alert(error.response?.data?.message || "Failed to add product. Please try again.")
    }
  }

  /**
   * UPDATE EXISTING PRODUCT
   */
  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      console.log("📝 Updating product:", productId, "with updates:", updates)
      
      // Ensure productId is always string (UUID)
      const idString = String(productId);
      
      let updatedProductData = updates;
      
      // MUST update backend first
      try {
        const response = await productAPI.update(idString, updates);
        updatedProductData = response.data;
        console.log("✅ Product updated in database:", updatedProductData);
      } catch (apiError) {
        console.error("❌ Backend update failed:", apiError);
        throw apiError; // Don't continue if backend fails
      }
      
      // ONLY update local state if backend update succeeded
      setProducts((prev) => {
        const updated = prev.map((product) =>
          product.id === idString ? { ...product, ...updatedProductData } : product
        );
        console.log("✅ Product updated successfully! Total products:", updated.length);
        // CRITICAL: Always save to localStorage
        safeSetItem("adminProducts", JSON.stringify(updated.map(stripLargeFields)));
        console.log("💾 Saved to localStorage");
        return updated;
      });
    } catch (error: any) {
      console.error("❌ Error updating product:", error);
      alert(error.response?.data?.message || "Failed to update product. Please try again.");
    }
  }

  const deleteProduct = async (productId: number | string) => {
    try {
      console.log("🗑️ Deleting product:", productId)
      
      // CRITICAL: Check authentication BEFORE attempting delete
      const token = localStorage.getItem('authToken')
      if (!token) {
        const errorMessage = '🔒 Authentication required! Please login to delete products.'
        console.error(errorMessage)
        alert('You must be logged in to delete products. Please login first.')
        throw new Error('Authentication required')
      }
      
      console.log('✅ Auth token present, proceeding with delete...')
      
      // Try to call backend API to delete product
      try {
        await productAPI.delete(String(productId))
        console.log("✅ Product deleted from database")
      } catch (apiError: any) {
        console.error("❌ Backend delete failed:", apiError)
        
        const status = apiError.response?.status
        const message = apiError.response?.data?.message || ''
        
        // 400 = invalid UUID / numeric legacy ID \u2013 product doesn't exist in DB, only in localStorage
        // Still remove from local state so it stops polluting the UI
        if (status === 400 && message.includes('Invalid product ID')) {
          console.warn('\u26a0\ufe0f Legacy numeric-ID product not in database \u2013 removing from local state only')
          setProducts((prev) => {
            const updated = prev.filter((p) => String(p.id) !== String(productId))
            safeSetItem("adminProducts", JSON.stringify(updated.map(stripLargeFields)))
            return updated
          })
          setStock((prev) => {
            const newStock = { ...prev }
            delete newStock[String(productId)]
            safeSetItem("adminStock", JSON.stringify(newStock))
            return newStock
          })
          console.log("✅ Legacy product removed from local state")
          return // Success \u2013 nothing to do on backend
        }
        
        // Enhanced error messaging for other errors
        if (apiError.message?.includes('Authentication required')) {
          alert('Authentication required. Please login first.')
        } else if (status === 401) {
          alert('Your session has expired. Please login again.')
        } else {
          alert(apiError.response?.data?.message || 'Failed to delete product. Please try again.')
        }
        
        throw apiError // Don't continue if backend delete fails
      }
      
      // ONLY update local state if backend delete succeeded
      setProducts((prev) => {
        // Use string comparison so UUID string matches regardless of incoming type
        const updated = prev.filter((product) => String(product.id) !== String(productId))
        console.log("✅ Product deleted locally. Remaining products:", updated.length)
        safeSetItem("adminProducts", JSON.stringify(updated.map(stripLargeFields)))
        console.log("💾 Saved to localStorage")
        return updated
      })
      
      setStock((prev) => {
        const newStock = { ...prev }
        delete newStock[String(productId)]
        safeSetItem("adminStock", JSON.stringify(newStock))
        return newStock
      })
      
      console.log("✅ Product deleted successfully!")
    } catch (error: any) {
      console.error("❌ Error deleting product:", error)
      // Don't show duplicate alert - already handled above
      throw error // Propagate error
    }
  }

  const updateStock = (productId: string, size: string, quantity: number) => {
    setStock((prev) => ({
      ...prev,
      [String(productId)]: {
        ...prev[String(productId)],
        sizes: {
          ...prev[String(productId)]?.sizes,
          [size]: Math.max(0, quantity),
        },
        lastUpdated: new Date(),
      },
    }))

    // Check if we should notify users about restocking
    if (quantity > 0) {
      notifyRestocked(productId, size)
    }
  }

  const toggleProductVisibility = (productId: string) => {
    setStock((prev) => ({
      ...prev,
      [String(productId)]: {
        ...prev[String(productId)],
        isVisible: !prev[String(productId)]?.isVisible,
      },
    }))
  }

  const getProductStock = (productId: string) => {
    return stock[String(productId)]
  }

  const addRestockNotification = (email: string, productId: string, size: string) => {
    const newNotification: RestockNotification = {
      id: `notif_${Date.now()}`,
      email,
      productId,
      size,
      notified: false,
      createdAt: new Date(),
    }
    setRestockNotifications((prev) => [...prev, newNotification])
  }

  const getRestockNotifications = (productId: string, size: string) => {
    return restockNotifications.filter(
      (notif) => notif.productId === productId && notif.size === size && !notif.notified,
    )
  }

  const notifyRestocked = (productId: string, size: string) => {
    // Mark notifications as notified and simulate email sending
    setRestockNotifications((prev) =>
      prev.map((notif) =>
        notif.productId === productId && notif.size === size && !notif.notified ? { ...notif, notified: true } : notif,
      ),
    )

    // In a real app, this would send emails to subscribed users
    const notifications = getRestockNotifications(productId, size)
    notifications.forEach((notif) => {
      console.log(`[Email Sent] Product ${productId} size ${size} is back in stock for ${notif.email}`)
    })
  }

  const setAdminMode = (isAdmin: boolean) => {
    console.log('🔧 Setting admin mode:', isAdmin)
    setIsAdminMode(isAdmin)
    // Remove stale persisted values from older builds.
    localStorage.removeItem('isAdminMode')
  }

  const markAsNewArrival = (productId: string, isNew: boolean) => {
    setStock((prev) => ({
      ...prev,
      [String(productId)]: {
        ...prev[String(productId)],
        isNewArrival: isNew,
      },
    }))
  }

  const markAsFeatured = (productId: string, isFeatured: boolean) => {
    setStock((prev) => ({
      ...prev,
      [String(productId)]: {
        ...prev[String(productId)],
        isFeatured: isFeatured,
      },
    }))
  }

  const getNewArrivals = () => {
    return products.filter((product) => stock[String(product.id)]?.isNewArrival === true)
  }

  const getFeaturedProducts = () => {
    return products.filter((product) => stock[String(product.id)]?.isFeatured === true)
  }

  return (
    <AdminContext.Provider
      value={{
        products,
        stock,
        restockNotifications,
        isAdminMode,
        addProduct,
        updateProduct,
        deleteProduct,
        updateStock,
        toggleProductVisibility,
        getProductStock,
        addRestockNotification,
        getRestockNotifications,
        notifyRestocked,
        setAdminMode,
        markAsNewArrival,
        markAsFeatured,
        getNewArrivals,
        getFeaturedProducts,
      }}
    >
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider")
  }
  return context
}
