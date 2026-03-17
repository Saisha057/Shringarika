-- =====================================================
-- MIGRATION 012: Add image_url to order_items table
-- =====================================================
-- Purpose: Store product image snapshot at time of order
-- This prevents broken images if product is deleted/updated later
-- =====================================================

-- Add image_url column to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment to explain purpose
COMMENT ON COLUMN order_items.image_url IS 'Product image URL snapshot at time of order (prevents broken images if product deleted)';

-- Update existing orders to fetch image from products table (if possible)
UPDATE order_items oi
SET image_url = (
  SELECT p.images->0
  FROM products p
  WHERE p.id = oi.product_id
)
WHERE oi.image_url IS NULL 
AND oi.product_id IS NOT NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
