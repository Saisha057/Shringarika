-- =====================================================
-- FIX STOCK DEDUCTION FUNCTIONS
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS update_product_stock_on_order(UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS deduct_stock_on_order(UUID, JSONB);

-- Create the individual stock update function with correct types
CREATE OR REPLACE FUNCTION update_product_stock_on_order(
  p_product_id UUID,
  p_quantity INTEGER,
  p_variant_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF p_variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET 
      stock = stock - p_quantity,
      updated_at = NOW()
    WHERE id = p_variant_id;
  ELSE
    UPDATE products
    SET 
      stock = stock - p_quantity,
      updated_at = NOW()
    WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the batch stock deduction function with correct types  
CREATE OR REPLACE FUNCTION deduct_stock_on_order(
  p_order_id UUID,
  p_items JSONB
)
RETURNS JSONB AS $$
DECLARE
  item JSONB;
  product_id_val UUID;
  variant_id_val UUID;
  quantity_val INTEGER;
  result JSONB := '{"success": true, "results": []}'::JSONB;
  item_result JSONB;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Extract values and cast to proper types
    product_id_val := (item->>'productId')::UUID;
    quantity_val := (item->>'quantity')::INTEGER;
    variant_id_val := CASE 
      WHEN item->>'variantId' IS NOT NULL AND item->>'variantId' != 'null' 
      THEN (item->>'variantId')::UUID 
      ELSE NULL 
    END;
    
    -- Perform stock deduction
    BEGIN
      PERFORM update_product_stock_on_order(
        product_id_val,
        quantity_val,
        variant_id_val
      );
      
      item_result := jsonb_build_object(
        'productId', product_id_val,
        'variantId', variant_id_val,
        'success', true
      );
    EXCEPTION WHEN OTHERS THEN
      item_result := jsonb_build_object(
        'productId', product_id_val,
        'variantId', variant_id_val,
        'success', false,
        'error', SQLERRM
      );
    END;
    
    result := jsonb_set(
      result,
      '{results}',
      (result->'results') || item_result
    );
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
