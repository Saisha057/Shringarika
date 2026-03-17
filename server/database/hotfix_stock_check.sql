-- ============================================
-- HOTFIX: Update stock check to use product_inventory table
-- ============================================
-- This hotfix updates the three stock management functions to:
-- 1. Check variant stock in product_inventory table first
-- 2. Fall back to JSONB for backward compatibility
-- 3. Apply changes to both tables for consistency

-- 1. UPDATE: check_stock_availability function
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
      WHERE product_id = v_product_id::UUID AND size = v_variant
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

-- 2. UPDATE: deduct_stock_on_order function (variant handling)
-- The function is updated to check product_inventory first for variants
-- Run this entire function replacement
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
      WHERE product_id = v_product_id::UUID AND size = v_variant
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
      WHERE product_id = v_product_id::UUID AND size = v_variant;
      
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

-- 3. UPDATE: restore_stock_on_cancellation function
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
      WHERE product_id = v_product_id::UUID AND size = v_variant
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
      WHERE product_id = v_product_id::UUID AND size = v_variant;
      
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
-- SUCCESS! Functions updated.
-- ============================================
-- The three stock management functions have been updated to:
-- 1. Check product_inventory table first for variant stock
-- 2. Fall back to products.stock JSONB for backward compatibility
-- 3. Update both locations when stock changes
--
-- Your stock check API should now work correctly with auto-generated variants.
-- Test by adding a product to cart and selecting a size.
