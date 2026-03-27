import type { Category } from "./categories"

/**
 * PRODUCT TYPE DEFINITION
 * This interface defines the structure of every product in the system
 * Used by admin forms, product pages, cart, and all product-related features
 * 
 * UPDATED: Now compatible with Supabase UUID-based schema
 */
export interface Product {
  id: string | number // Support both UUID (string) and legacy number IDs
  name: string
  price?: number // Legacy field
  base_price?: number // Supabase schema field
  discount_price?: number | null // Supabase schema field
  label?: "NEW" | "SALE" | "LIMITED" | null
  color?: string
  colors?: string[]
  category: Category | string // Support both Category type and plain string
  subType?: string
  description?: string | null
  material?: string
  washCare?: string[]
  rating?: number
  reviews?: number
  review_count?: number // Supabase schema field
  images?: string[] // Array of image URLs
  primary_image?: string // Supabase schema field
  sizes?: string[]
  inStock?: boolean
  is_active?: boolean // Supabase schema field
  is_featured?: boolean // Supabase schema field
  slug?: string // Supabase schema field
  brand?: string // Supabase schema field
  attributes?: any // JSONB field from Supabase
  specifications?: Record<string, unknown>
  tags?: string[] // Supabase schema field
  created_at?: string
  updated_at?: string
}

// Empty product array - Products will be managed by admin only through Supabase
export const products: Product[] = [];
