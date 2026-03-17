-- Migration: Add material and price_modifier columns to product_inventory table
-- Purpose: Support variant-specific materials and price adjustments
-- Date: 2025
-- Author: System

-- Add material column (e.g., "Cotton", "Silk", "Polyester")
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_inventory' AND column_name = 'material'
    ) THEN
        ALTER TABLE product_inventory 
        ADD COLUMN material VARCHAR(100);
        
        RAISE NOTICE '✅ Added material column to product_inventory';
    ELSE
        RAISE NOTICE '⏭️ material column already exists in product_inventory';
    END IF;
END $$;

-- Add price_modifier column (percentage or fixed amount adjustment)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_inventory' AND column_name = 'price_modifier'
    ) THEN
        ALTER TABLE product_inventory 
        ADD COLUMN price_modifier DECIMAL(10, 2) DEFAULT 0;
        
        RAISE NOTICE '✅ Added price_modifier column to product_inventory';
    ELSE
        RAISE NOTICE '⏭️ price_modifier column already exists in product_inventory';
    END IF;
END $$;

-- Add index for material searches
CREATE INDEX IF NOT EXISTS idx_product_inventory_material 
ON product_inventory(material) 
WHERE material IS NOT NULL;

-- Add comment
COMMENT ON COLUMN product_inventory.material IS 'Variant-specific material type (e.g., Cotton, Silk, Polyester)';
COMMENT ON COLUMN product_inventory.price_modifier IS 'Price adjustment for this variant (can be positive or negative)';

-- Verification
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'product_inventory' 
AND column_name IN ('material', 'price_modifier')
ORDER BY ordinal_position;

RAISE NOTICE '🎉 Migration completed: material and price_modifier columns added to product_inventory';
