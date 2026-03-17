-- =====================================================
-- APPLY UUID TYPE FIX TO DATABASE
-- Run this in Supabase SQL Editor NOW
-- =====================================================

-- Fix 1: check_stock_availability function
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

-- Fix 2: deduct_stock_on_order function
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

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'UUID FIX APPLIED SUCCESSFULLY' as status;
