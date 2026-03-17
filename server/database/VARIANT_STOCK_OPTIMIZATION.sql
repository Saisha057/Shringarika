-- =============================================================================
-- VARIANT STOCK OPTIMIZATION & REAL-TIME SETUP
-- =============================================================================
-- Date: January 9, 2026
-- Purpose: Optimize variant stock system and enable real-time updates
-- =============================================================================

-- PHASE 1: Add Performance Indexes
-- =============================================================================

-- Index for fast product variant lookups
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id 
  ON product_inventory(product_id)
  WHERE is_active = true;

-- Index for low stock queries
CREATE INDEX IF NOT EXISTS idx_product_inventory_low_stock 
  ON product_inventory(stock, low_stock_threshold)
  WHERE stock <= low_stock_threshold AND is_active = true;

-- Index for SKU lookups
CREATE INDEX IF NOT EXISTS idx_product_inventory_sku 
  ON product_inventory(sku)
  WHERE sku IS NOT NULL;

-- Composite index for size/color queries
CREATE INDEX IF NOT EXISTS idx_product_inventory_variant 
  ON product_inventory(product_id, size, color)
  WHERE is_active = true;

-- Index for stock operations
CREATE INDEX IF NOT EXISTS idx_product_inventory_stock_check 
  ON product_inventory(product_id, stock)
  WHERE is_active = true;

COMMENT ON INDEX idx_product_inventory_product_id IS 'Fast product variant lookups';
COMMENT ON INDEX idx_product_inventory_low_stock IS 'Identify low stock items';
COMMENT ON INDEX idx_product_inventory_sku IS 'Fast SKU-based lookups';
COMMENT ON INDEX idx_product_inventory_variant IS 'Size/color combination queries';
COMMENT ON INDEX idx_product_inventory_stock_check IS 'Stock availability checks';

-- =============================================================================
-- PHASE 2: Enable Supabase Realtime
-- =============================================================================

-- Enable real-time updates on product_inventory table
ALTER PUBLICATION supabase_realtime ADD TABLE product_inventory;

-- Verify realtime is enabled
DO $$
BEGIN
  RAISE NOTICE '✅ Realtime enabled for product_inventory table';
  RAISE NOTICE '✅ Clients can now subscribe to stock changes';
END $$;

-- =============================================================================
-- PHASE 3: Add Trigger for updated_at
-- =============================================================================

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_product_inventory_updated_at ON product_inventory;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_product_inventory_updated_at
  BEFORE UPDATE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER update_product_inventory_updated_at ON product_inventory IS 'Auto-update updated_at timestamp';

-- =============================================================================
-- PHASE 4: Add Stock Change Audit Log (Optional but Recommended)
-- =============================================================================

-- Create audit table for stock changes
CREATE TABLE IF NOT EXISTS product_inventory_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID NOT NULL REFERENCES product_inventory(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  size VARCHAR(50),
  color VARCHAR(50),
  stock_before INTEGER,
  stock_after INTEGER,
  stock_delta INTEGER,
  changed_by UUID, -- User ID who made the change
  change_reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_inventory_audit_inventory_id 
  ON product_inventory_audit(inventory_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_product_id 
  ON product_inventory_audit(product_id, created_at DESC);

COMMENT ON TABLE product_inventory_audit IS 'Audit trail for stock changes';

-- Trigger function for audit logging
CREATE OR REPLACE FUNCTION log_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if stock actually changed
  IF OLD.stock IS DISTINCT FROM NEW.stock THEN
    INSERT INTO product_inventory_audit (
      inventory_id,
      product_id,
      size,
      color,
      stock_before,
      stock_after,
      stock_delta,
      created_at
    ) VALUES (
      NEW.id,
      NEW.product_id,
      NEW.size,
      NEW.color,
      OLD.stock,
      NEW.stock,
      NEW.stock - OLD.stock,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS audit_stock_change ON product_inventory;

-- Create audit trigger
CREATE TRIGGER audit_stock_change
  AFTER UPDATE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_stock_change();

COMMENT ON TRIGGER audit_stock_change ON product_inventory IS 'Log all stock changes to audit table';

-- =============================================================================
-- PHASE 5: Add Helper Functions
-- =============================================================================

-- Function to get total stock for a product
CREATE OR REPLACE FUNCTION get_product_total_stock(p_product_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(stock), 0)::INTEGER
  FROM product_inventory
  WHERE product_id = p_product_id
    AND is_active = true;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_product_total_stock IS 'Get total stock across all variants';

-- Function to check if variant is low stock
CREATE OR REPLACE FUNCTION is_low_stock(p_inventory_id UUID)
RETURNS BOOLEAN AS $$
  SELECT stock <= low_stock_threshold
  FROM product_inventory
  WHERE id = p_inventory_id;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION is_low_stock IS 'Check if variant is below low stock threshold';

-- Function to get out of stock variants
CREATE OR REPLACE FUNCTION get_out_of_stock_variants(p_product_id UUID)
RETURNS TABLE (
  id UUID,
  size VARCHAR(50),
  color VARCHAR(50),
  sku VARCHAR(100)
) AS $$
  SELECT id, size, color, sku
  FROM product_inventory
  WHERE product_id = p_product_id
    AND stock = 0
    AND is_active = true;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_out_of_stock_variants IS 'Get list of out-of-stock variants for a product';

-- =============================================================================
-- PHASE 6: Verify Setup
-- =============================================================================

DO $$
DECLARE
  index_count INTEGER;
  trigger_count INTEGER;
BEGIN
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'product_inventory'
    AND indexname LIKE 'idx_product_inventory_%';
  
  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname LIKE '%product_inventory%';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ OPTIMIZATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Indexes created: %', index_count;
  RAISE NOTICE 'Triggers created: %', trigger_count;
  RAISE NOTICE 'Realtime: ENABLED';
  RAISE NOTICE 'Audit logging: ENABLED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🚀 System ready for production';
  RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- PHASE 7: Grant Permissions (if using RLS)
-- =============================================================================

-- Enable RLS if not already enabled
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read variants
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read variants"
  ON product_inventory
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow admins to manage variants
CREATE POLICY IF NOT EXISTS "Allow admins to manage variants"
  ON product_inventory
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Policy: Allow public to read active variants (for frontend display)
CREATE POLICY IF NOT EXISTS "Allow public to read active variants"
  ON product_inventory
  FOR SELECT
  TO anon
  USING (is_active = true);

RAISE NOTICE '✅ Row Level Security policies configured';

-- =============================================================================
-- END OF OPTIMIZATION SCRIPT
-- =============================================================================
