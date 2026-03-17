-- Migration: Add Razorpay payment columns to orders table
-- Created: 2026-01-21
-- Purpose: Support Razorpay online payment integration

-- Add Razorpay columns to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(255);

-- Add indexes for better performance on payment lookups
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON orders(razorpay_payment_id);

-- Add comments
COMMENT ON COLUMN orders.razorpay_order_id IS 'Razorpay order ID (e.g., order_ABC123)';
COMMENT ON COLUMN orders.razorpay_payment_id IS 'Razorpay payment ID (e.g., pay_XYZ789)';
COMMENT ON COLUMN orders.razorpay_signature IS 'HMAC SHA256 signature for payment verification';
