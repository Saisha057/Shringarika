-- ============================================
-- MIGRATION 006: STOCK SYNCHRONIZATION SYSTEM
-- ============================================
-- Created: 2025-11-29
-- Purpose: Real-time stock tracking, history, alerts, and synchronization
-- 
-- Features:
-- 1. Stock history tracking (every change logged)
-- 2. Real-time stock alerts (critical/low/warning)
-- 3. Variant-level stock management
-- 4. Automatic stock deduction on orders
-- 5. Out-of-stock prevention
-- 6. Admin stock updates with sync

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. STOCK HISTORY TABLE
-- ============================================
-- Track every stock change with reason and details

CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  variant TEXT,
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
    'order_placed',      -- Stock decreased due to order
    'order_cancelled',   -- Stock increased due to order cancellation
    'manual_add',        -- Admin manually added stock
    'manual_subtract',   -- Admin manually subtracted stock
    'return_accepted',   -- Stock increased due to accepted return
    'adjustment',        -- Stock adjustment/correction
    'initial_stock'      -- Initial stock setup
  )),
  quantity_change INTEGER NOT NULL,  -- Positive = increase, Negative = decrease
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  reference_id UUID,  -- Order ID, Return ID, or other reference
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',  -- Additional context
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  CONSTRAINT stock_history_product_variant_idx UNIQUE (id)
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_variant ON stock_history(product_id, variant);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_history_type ON stock_history(change_type);
CREATE INDEX IF NOT EXISTS idx_stock_history_reference ON stock_history(reference_id);

-- ============================================
-- 2. STOCK ALERTS TABLE
-- ============================================
-- Track stock alert configurations and current status

CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  variant TEXT,
  alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('critical', 'low', 'warning', 'ok')),
  current_stock INTEGER NOT NULL,
  threshold_critical INTEGER DEFAULT 0,
  threshold_low INTEGER DEFAULT 5,
  threshold_warning INTEGER DEFAULT 10,
  last_alert_sent TIMESTAMP,
  alert_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint per product/variant
  UNIQUE(product_id, variant)
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_level ON stock_alerts(alert_level);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_enabled ON stock_alerts(alert_enabled) WHERE alert_enabled = TRUE;

-- ============================================
-- 3. UPDATE PRODUCTS TABLE
-- ============================================
-- Add stock tracking fields if not exists

DO $$ 
BEGIN
  -- Add total_stock column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'total_stock') THEN
    ALTER TABLE products ADD COLUMN total_stock INTEGER DEFAULT 0;
  END IF;
  
  -- Add stock_enabled column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'stock_enabled') THEN
    ALTER TABLE products ADD COLUMN stock_enabled BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Add low_stock_threshold column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'low_stock_threshold') THEN
    ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;
  END IF;
  
  -- Add stock_updated_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'stock_updated_at') THEN
    ALTER TABLE products ADD COLUMN stock_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_total_stock ON products(total_stock);
CREATE INDEX IF NOT EXISTS idx_products_stock_enabled ON products(stock_enabled) WHERE stock_enabled = TRUE;

-- ============================================
-- 4. TRIGGER: LOG STOCK CHANGES
-- ============================================
-- Automatically log stock changes in products table

CREATE OR REPLACE FUNCTION log_product_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if stock actually changed
  IF (OLD.total_stock IS DISTINCT FROM NEW.total_stock) OR (OLD.stock IS DISTINCT FROM NEW.stock) THEN
    NEW.stock_updated_at = CURRENT_TIMESTAMP;
    
    -- Log to stock_history
    INSERT INTO stock_history (
      product_id,
      variant,
      change_type,
      quantity_change,
      quantity_before,
      quantity_after,
      reason,
      metadata
    ) VALUES (
      NEW.id,
      NULL,  -- Main product stock
      'adjustment',
      COALESCE(NEW.total_stock, 0) - COALESCE(OLD.total_stock, 0),
      COALESCE(OLD.total_stock, 0),
      COALESCE(NEW.total_stock, 0),
      'Product stock updated',
      jsonb_build_object(
        'old_stock', OLD.total_stock,
        'new_stock', NEW.total_stock,
        'stock_data', NEW.stock
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_product_stock_change ON products;
CREATE TRIGGER trigger_log_product_stock_change
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_product_stock_change();

-- ============================================
-- 5. FUNCTION: UPDATE STOCK ALERTS
-- ============================================
-- Calculate and update alert level based on current stock

CREATE OR REPLACE FUNCTION update_stock_alert(
  p_product_id TEXT,
  p_variant TEXT DEFAULT NULL
)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_current_stock INTEGER;
  v_threshold_critical INTEGER;
  v_threshold_low INTEGER;
  v_threshold_warning INTEGER;
  v_alert_level VARCHAR(20);
BEGIN
  -- Get current stock from products table
  IF p_variant IS NULL THEN
    SELECT total_stock INTO v_current_stock
    FROM products
    WHERE id = p_product_id;
  ELSE
    -- For variants, extract from stock JSONB
    SELECT COALESCE((stock->>p_variant)::INTEGER, 0) INTO v_current_stock
    FROM products
    WHERE id = p_product_id;
  END IF;
  
  -- Get thresholds (use default if not set)
  SELECT 
    COALESCE(threshold_critical, 0),
    COALESCE(threshold_low, 5),
    COALESCE(threshold_warning, 10)
  INTO v_threshold_critical, v_threshold_low, v_threshold_warning
  FROM stock_alerts
  WHERE product_id = p_product_id AND (variant = p_variant OR (variant IS NULL AND p_variant IS NULL))
  LIMIT 1;
  
  -- Use defaults if no alert config exists
  v_threshold_critical := COALESCE(v_threshold_critical, 0);
  v_threshold_low := COALESCE(v_threshold_low, 5);
  v_threshold_warning := COALESCE(v_threshold_warning, 10);
  
  -- Determine alert level
  IF v_current_stock <= v_threshold_critical THEN
    v_alert_level := 'critical';
  ELSIF v_current_stock <= v_threshold_low THEN
    v_alert_level := 'low';
  ELSIF v_current_stock <= v_threshold_warning THEN
    v_alert_level := 'warning';
  ELSE
    v_alert_level := 'ok';
  END IF;
  
  -- Upsert stock_alerts table
  INSERT INTO stock_alerts (
    product_id,
    variant,
    alert_level,
    current_stock,
    threshold_critical,
    threshold_low,
    threshold_warning
  ) VALUES (
    p_product_id,
    p_variant,
    v_alert_level,
    v_current_stock,
    v_threshold_critical,
    v_threshold_low,
    v_threshold_warning
  )
  ON CONFLICT (product_id, variant)
  DO UPDATE SET
    alert_level = v_alert_level,
    current_stock = v_current_stock,
    updated_at = CURRENT_TIMESTAMP;
  
  RETURN v_alert_level;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. FUNCTION: DEDUCT STOCK ON ORDER
-- ============================================
-- Decrease stock when order is placed

CREATE OR REPLACE FUNCTION deduct_stock_on_order(
  p_order_id UUID,
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_variant TEXT;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_results JSONB := '[]'::JSONB;
  v_result JSONB;
BEGIN
  -- Loop through each item in the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant := v_item->>'variant';
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Get current stock
    IF v_variant IS NULL OR v_variant = '' THEN
      -- Main product stock
      SELECT total_stock INTO v_current_stock
      FROM products
      WHERE id = v_product_id;
      
      IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
        v_result := jsonb_build_object(
          'productId', v_product_id,
          'variant', v_variant,
          'success', FALSE,
          'error', 'Insufficient stock',
          'available', COALESCE(v_current_stock, 0),
          'requested', v_quantity
        );
        v_results := v_results || v_result;
        CONTINUE;
      END IF;
      
      -- Deduct stock
      v_new_stock := v_current_stock - v_quantity;
      UPDATE products
      SET total_stock = v_new_stock,
          stock_updated_at = CURRENT_TIMESTAMP
      WHERE id = v_product_id;
      
    ELSE
      -- Variant stock - prioritize product_inventory table
      SELECT COALESCE(stock, 0) INTO v_current_stock
      FROM product_inventory
      WHERE product_id = v_product_id AND size = v_variant
      LIMIT 1;
      
      -- Fall back to JSONB if not found (backward compatibility)
      IF v_current_stock = 0 THEN
        SELECT COALESCE((stock->>v_variant)::INTEGER, 0) INTO v_current_stock
        FROM products
        WHERE id = v_product_id;
      END IF;
      
      IF v_current_stock < v_quantity THEN
        v_result := jsonb_build_object(
          'productId', v_product_id,
          'variant', v_variant,
          'success', FALSE,
          'error', 'Insufficient stock',
          'available', v_current_stock,
          'requested', v_quantity
        );
        v_results := v_results || v_result;
        CONTINUE;
      END IF;
      
      -- Deduct variant stock from product_inventory table
      v_new_stock := v_current_stock - v_quantity;
      UPDATE product_inventory
      SET stock = v_new_stock,
          updated_at = CURRENT_TIMESTAMP
      WHERE product_id = v_product_id AND size = v_variant;
      
      -- Also update JSONB for backward compatibility
      UPDATE products
      SET stock = jsonb_set(
            COALESCE(stock, '{}'::JSONB),
            ARRAY[v_variant],
            to_jsonb(v_new_stock)
          ),
          stock_updated_at = CURRENT_TIMESTAMP
      WHERE id = v_product_id;
    END IF;
    
    -- Log stock change
    INSERT INTO stock_history (
      product_id,
      variant,
      change_type,
      quantity_change,
      quantity_before,
      quantity_after,
      reason,
      reference_id,
      metadata
    ) VALUES (
      v_product_id,
      v_variant,
      'order_placed',
      -v_quantity,
      v_current_stock,
      v_new_stock,
      'Stock deducted for order',
      p_order_id,
      jsonb_build_object(
        'order_id', p_order_id,
        'quantity_ordered', v_quantity
      )
    );
    
    -- Update stock alert
    PERFORM update_stock_alert(v_product_id, v_variant);
    
    -- Add success result
    v_result := jsonb_build_object(
      'productId', v_product_id,
      'variant', v_variant,
      'success', TRUE,
      'deducted', v_quantity,
      'newStock', v_new_stock
    );
    v_results := v_results || v_result;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. FUNCTION: RESTORE STOCK ON ORDER CANCELLATION
-- ============================================
-- Increase stock when order is cancelled

CREATE OR REPLACE FUNCTION restore_stock_on_cancellation(
  p_order_id UUID,
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_variant TEXT;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_results JSONB := '[]'::JSONB;
  v_result JSONB;
BEGIN
  -- Loop through each item in the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant := v_item->>'variant';
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Restore stock
    IF v_variant IS NULL OR v_variant = '' THEN
      -- Main product stock
      SELECT total_stock INTO v_current_stock
      FROM products
      WHERE id = v_product_id;
      
      v_new_stock := COALESCE(v_current_stock, 0) + v_quantity;
      UPDATE products
      SET total_stock = v_new_stock,
          stock_updated_at = CURRENT_TIMESTAMP
      WHERE id = v_product_id;
      
    ELSE
      -- Variant stock - prioritize product_inventory table
      SELECT COALESCE(stock, 0) INTO v_current_stock
      FROM product_inventory
      WHERE product_id = v_product_id AND size = v_variant
      LIMIT 1;
      
      -- Fall back to JSONB if not found (backward compatibility)
      IF v_current_stock = 0 THEN
        SELECT COALESCE((stock->>v_variant)::INTEGER, 0) INTO v_current_stock
        FROM products
        WHERE id = v_product_id;
      END IF;
      
      v_new_stock := v_current_stock + v_quantity;
      
      -- Restore variant stock in product_inventory table
      UPDATE product_inventory
      SET stock = v_new_stock,
          updated_at = CURRENT_TIMESTAMP
      WHERE product_id = v_product_id AND size = v_variant;
      
      -- Also update JSONB for backward compatibility
      UPDATE products
      SET stock = jsonb_set(
            COALESCE(stock, '{}'::JSONB),
            ARRAY[v_variant],
            to_jsonb(v_new_stock)
          ),
          stock_updated_at = CURRENT_TIMESTAMP
      WHERE id = v_product_id;
    END IF;
    
    -- Log stock change
    INSERT INTO stock_history (
      product_id,
      variant,
      change_type,
      quantity_change,
      quantity_before,
      quantity_after,
      reason,
      reference_id,
      metadata
    ) VALUES (
      v_product_id,
      v_variant,
      'order_cancelled',
      v_quantity,
      v_current_stock,
      v_new_stock,
      'Stock restored due to order cancellation',
      p_order_id,
      jsonb_build_object(
        'order_id', p_order_id,
        'quantity_restored', v_quantity
      )
    );
    
    -- Update stock alert
    PERFORM update_stock_alert(v_product_id, v_variant);
    
    -- Add success result
    v_result := jsonb_build_object(
      'productId', v_product_id,
      'variant', v_variant,
      'success', TRUE,
      'restored', v_quantity,
      'newStock', v_new_stock
    );
    v_results := v_results || v_result;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. FUNCTION: CHECK STOCK AVAILABILITY
-- ============================================
-- Validate if items are in stock before order

CREATE OR REPLACE FUNCTION check_stock_availability(
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_variant TEXT;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_available BOOLEAN;
  v_results JSONB := '[]'::JSONB;
  v_result JSONB;
  v_all_available BOOLEAN := TRUE;
BEGIN
  -- Loop through each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant := v_item->>'variant';
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    -- Get current stock - prioritize product_inventory table first (variant-based stock)
    IF v_variant IS NULL OR v_variant = '' THEN
      -- No variant specified: use main product stock
      SELECT COALESCE(total_stock, 0) INTO v_current_stock
      FROM products
      WHERE id = v_product_id;
    ELSE
      -- Variant specified: look in product_inventory table first
      SELECT COALESCE(stock, 0) INTO v_current_stock
      FROM product_inventory
      WHERE product_id = v_product_id AND size = v_variant
      LIMIT 1;
      
      -- If not found in product_inventory, fall back to JSONB (for backward compatibility)
      IF v_current_stock = 0 THEN
        SELECT COALESCE((stock->>v_variant)::INTEGER, 0) INTO v_current_stock
        FROM products
        WHERE id = v_product_id;
      END IF;
    END IF;
    
    v_available := COALESCE(v_current_stock, 0) >= v_quantity;
    
    IF NOT v_available THEN
      v_all_available := FALSE;
    END IF;
    
    v_result := jsonb_build_object(
      'productId', v_product_id,
      'variant', v_variant,
      'requested', v_quantity,
      'available', COALESCE(v_current_stock, 0),
      'inStock', v_available
    );
    v_results := v_results || v_result;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'allAvailable', v_all_available,
    'items', v_results
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. VIEWS FOR EASY QUERYING
-- ============================================

-- View: Low stock products
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
  p.id,
  p.name,
  p.total_stock,
  p.low_stock_threshold,
  sa.alert_level,
  sa.variant,
  sa.current_stock as variant_stock,
  p.stock_updated_at
FROM products p
LEFT JOIN stock_alerts sa ON p.id = sa.product_id
WHERE p.stock_enabled = TRUE
  AND (
    p.total_stock <= p.low_stock_threshold
    OR sa.alert_level IN ('critical', 'low', 'warning')
  )
ORDER BY 
  CASE sa.alert_level
    WHEN 'critical' THEN 1
    WHEN 'low' THEN 2
    WHEN 'warning' THEN 3
    ELSE 4
  END,
  p.total_stock ASC;

-- View: Out of stock products
CREATE OR REPLACE VIEW out_of_stock_products AS
SELECT 
  p.id,
  p.name,
  p.total_stock,
  sa.variant,
  sa.current_stock as variant_stock,
  p.stock_updated_at
FROM products p
LEFT JOIN stock_alerts sa ON p.id = sa.product_id
WHERE p.stock_enabled = TRUE
  AND (
    p.total_stock = 0
    OR (sa.variant IS NOT NULL AND sa.current_stock = 0)
  );

-- View: Recent stock changes
CREATE OR REPLACE VIEW recent_stock_changes AS
SELECT 
  sh.id,
  sh.product_id,
  p.name as product_name,
  sh.variant,
  sh.change_type,
  sh.quantity_change,
  sh.quantity_before,
  sh.quantity_after,
  sh.reason,
  sh.reference_id,
  sh.created_at
FROM stock_history sh
LEFT JOIN products p ON sh.product_id = p.id
ORDER BY sh.created_at DESC
LIMIT 100;

-- ============================================
-- 10. INITIALIZE STOCK ALERTS FOR EXISTING PRODUCTS
-- ============================================

-- Create alerts for all existing products
INSERT INTO stock_alerts (product_id, variant, alert_level, current_stock, threshold_critical, threshold_low, threshold_warning)
SELECT 
  id,
  NULL,
  CASE
    WHEN total_stock <= 0 THEN 'critical'
    WHEN total_stock <= 5 THEN 'low'
    WHEN total_stock <= 10 THEN 'warning'
    ELSE 'ok'
  END,
  COALESCE(total_stock, 0),
  0,
  5,
  10
FROM products
WHERE stock_enabled = TRUE
ON CONFLICT (product_id, variant) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE stock_history IS 'Complete history of all stock changes';
COMMENT ON TABLE stock_alerts IS 'Real-time stock alert configurations and status';
COMMENT ON FUNCTION deduct_stock_on_order IS 'Automatically deduct stock when order is placed';
COMMENT ON FUNCTION restore_stock_on_cancellation IS 'Automatically restore stock when order is cancelled';
COMMENT ON FUNCTION check_stock_availability IS 'Validate stock availability before order';
COMMENT ON FUNCTION update_stock_alert IS 'Calculate and update stock alert level';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 006 complete: Stock synchronization system ready';
  RAISE NOTICE '📦 Features: Stock history, alerts, auto-deduction, validation';
  RAISE NOTICE '🔄 Triggers: Automatic stock logging on product updates';
  RAISE NOTICE '📊 Views: low_stock_products, out_of_stock_products, recent_stock_changes';
END $$;
