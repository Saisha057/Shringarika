-- ============================================
-- FIX: Drop and recreate generate_order_number() function
-- Run this in Supabase SQL Editor to fix the error
-- ============================================

-- Drop existing function if it exists (to handle return type changes)
-- Note: CASCADE will also drop any triggers that depend on this function
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;

-- Recreate the function with correct return type
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_order_number TEXT;
    date_part TEXT;
    seq_part TEXT;
BEGIN
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO seq_part
    FROM orders
    WHERE order_number LIKE 'ORD-' || date_part || '-%';
    
    new_order_number := 'ORD-' || date_part || '-' || LPAD(seq_part::TEXT, 4, '0');
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Verify the function was created successfully
SELECT generate_order_number() as test_order_number;

