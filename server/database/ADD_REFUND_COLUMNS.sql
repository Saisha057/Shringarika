-- =====================================================
-- ADD REFUND & RETURN COLUMNS TO ORDERS TABLE
-- Fix for: "Could not find 'refund_payment_details' column"
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add refund-related columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS return_status VARCHAR(50) CHECK (return_status IN ('none', 'requested', 'approved', 'rejected', 'completed')),
ADD COLUMN IF NOT EXISTS return_request JSONB,
ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS return_reason TEXT,
ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) CHECK (refund_status IN ('none', 'pending', 'initiated', 'processing', 'success', 'failed')),
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) CHECK (refund_amount >= 0),
ADD COLUMN IF NOT EXISTS refund_notes TEXT,
ADD COLUMN IF NOT EXISTS refund_payment_details JSONB,
ADD COLUMN IF NOT EXISTS refund_initiated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP WITH TIME ZONE;

-- Set default values for existing orders
UPDATE orders 
SET 
  return_status = 'none',
  refund_status = 'none'
WHERE return_status IS NULL OR refund_status IS NULL;

-- Create index for faster queries on return/refund status
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON orders(return_status);
CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON orders(refund_status);

-- Add comment for documentation
COMMENT ON COLUMN orders.refund_payment_details IS 'JSONB containing: {mode, bankName, accountNumber, ifscCode, upiId, transactionId, transactionDate, processedBy, processedByEmail, processedAt}';

-- Verify schema update
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('return_status', 'refund_status', 'refund_payment_details', 'refund_amount')
ORDER BY column_name;
