-- ============================================
-- MIGRATION 006: STOCK SYNCHRONIZATION (SIMPLIFIED)
-- ============================================
-- Run this if the full version has issues

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. STOCK HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  variant TEXT,
  change_type VARCHAR(50) NOT NULL,
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  reference_id UUID,
  admin_id UUID,
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_history_product ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON stock_history(created_at DESC);

-- ============================================
-- 2. STOCK ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id TEXT NOT NULL,
  variant TEXT,
  alert_level VARCHAR(20) NOT NULL,
  current_stock INTEGER NOT NULL,
  threshold_critical INTEGER DEFAULT 0,
  threshold_low INTEGER DEFAULT 5,
  threshold_warning INTEGER DEFAULT 10,
  last_alert_sent TIMESTAMP,
  alert_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant)
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);

-- ============================================
-- 3. UPDATE PRODUCTS TABLE
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_products_total_stock ON products(total_stock);

-- ============================================
-- 4. FUNCTION: CHECK STOCK AVAILABILITY
-- ============================================
CREATE OR REPLACE FUNCTION check_stock_availability(p_items JSONB)
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
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant := v_item->>'variant';
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    IF v_variant IS NULL OR v_variant = '' THEN
      SELECT COALESCE(total_stock, 50) INTO v_current_stock FROM products WHERE id = v_product_id;
    ELSE
      SELECT COALESCE((stock->>v_variant)::INTEGER, 50) INTO v_current_stock FROM products WHERE id = v_product_id;
    END IF;
    
    v_available := COALESCE(v_current_stock, 50) >= v_quantity;
    
    IF NOT v_available THEN
      v_all_available := FALSE;
    END IF;
    
    v_result := jsonb_build_object(
      'productId', v_product_id,
      'variant', v_variant,
      'requested', v_quantity,
      'available', COALESCE(v_current_stock, 50),
      'inStock', v_available
    );
    v_results := v_results || v_result;
  END LOOP;
  
  RETURN jsonb_build_object('success', TRUE, 'allAvailable', v_all_available, 'items', v_results);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. FUNCTION: DEDUCT STOCK ON ORDER
-- ============================================
CREATE OR REPLACE FUNCTION deduct_stock_on_order(p_order_id UUID, p_items JSONB)
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
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_variant := v_item->>'variant';
    v_quantity := (v_item->>'quantity')::INTEGER;
    
    IF v_variant IS NULL OR v_variant = '' THEN
      SELECT COALESCE(total_stock, 50) INTO v_current_stock FROM products WHERE id = v_product_id;
      
      IF v_current_stock < v_quantity THEN
        v_result := jsonb_build_object('productId', v_product_id, 'variant', v_variant, 'success', FALSE, 'error', 'Insufficient stock');
        v_results := v_results || v_result;
        CONTINUE;
      END IF;
      
      v_new_stock := v_current_stock - v_quantity;
      UPDATE products SET total_stock = v_new_stock, stock_updated_at = CURRENT_TIMESTAMP WHERE id = v_product_id;
    ELSE
      SELECT COALESCE((stock->>v_variant)::INTEGER, 50) INTO v_current_stock FROM products WHERE id = v_product_id;
      
      IF v_current_stock < v_quantity THEN
        v_result := jsonb_build_object('productId', v_product_id, 'variant', v_variant, 'success', FALSE, 'error', 'Insufficient stock');
        v_results := v_results || v_result;
        CONTINUE;
      END IF;
      
      v_new_stock := v_current_stock - v_quantity;
      UPDATE products 
      SET stock = jsonb_set(COALESCE(stock, '{}'::JSONB), ARRAY[v_variant], to_jsonb(v_new_stock)),
          stock_updated_at = CURRENT_TIMESTAMP
      WHERE id = v_product_id;
    END IF;
    
    INSERT INTO stock_history (product_id, variant, change_type, quantity_change, quantity_before, quantity_after, reason, reference_id)
    VALUES (v_product_id, v_variant, 'order_placed', -v_quantity, v_current_stock, v_new_stock, 'Stock deducted for order', p_order_id);
    
    v_result := jsonb_build_object('productId', v_product_id, 'variant', v_variant, 'success', TRUE, 'deducted', v_quantity, 'newStock', v_new_stock);
    v_results := v_results || v_result;
  END LOOP;
  
  RETURN jsonb_build_object('success', TRUE, 'results', v_results);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
SELECT 'Migration 006 (simplified) complete!' as status;
