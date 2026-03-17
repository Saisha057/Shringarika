-- ============================================
-- MIGRATION: Enhanced Orders Table
-- Purpose: Store complete order details for admin dashboard and user orders
-- ============================================

-- Add new columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(50) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_uuid UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_details JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax DECIMAL(10, 2) DEFAULT 0.0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0.0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) DEFAULT 0.0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT '₹';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'Pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;

-- Update payment_status check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

-- Update order_status check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN ('Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded', 'Failed'));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_guest_uuid ON orders(guest_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON orders(created_at DESC);

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_order_number TEXT;
  order_count INTEGER;
BEGIN
  -- Get count of orders today
  SELECT COUNT(*) INTO order_count
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Generate order number: ORD-YYYYMMDD-XXXX
  new_order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((order_count + 1)::TEXT, 4, '0');
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Function to calculate estimated delivery date (7 days from order date)
CREATE OR REPLACE FUNCTION calculate_estimated_delivery()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estimated_delivery_date IS NULL THEN
    NEW.estimated_delivery_date := (NEW.created_at + INTERVAL '7 days')::DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_estimated_delivery ON orders;
CREATE TRIGGER trigger_calculate_estimated_delivery
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_estimated_delivery();

-- Function to update status history
CREATE OR REPLACE FUNCTION update_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    NEW.status_history := OLD.status_history || jsonb_build_object(
      'status', NEW.order_status,
      'timestamp', CURRENT_TIMESTAMP,
      'note', COALESCE(NEW.delivery_notes, '')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_status_history ON orders;
CREATE TRIGGER trigger_update_order_status_history
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_history();

-- Backfill existing orders with order numbers
DO $$
DECLARE
  order_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR order_record IN 
    SELECT id, created_at 
    FROM orders 
    WHERE order_number IS NULL 
    ORDER BY created_at
  LOOP
    UPDATE orders 
    SET order_number = 'ORD-' || TO_CHAR(order_record.created_at, 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0')
    WHERE id = order_record.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Backfill order_status from status column if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='status') THEN
    UPDATE orders SET order_status = status WHERE order_status IS NULL;
  END IF;
END $$;

-- Set subtotal from items_price if not set
UPDATE orders SET subtotal = items_price WHERE subtotal IS NULL;
UPDATE orders SET delivery_charge = shipping_price WHERE delivery_charge IS NULL;
UPDATE orders SET tax = tax_price WHERE tax IS NULL;

-- Set payment_status based on is_paid
UPDATE orders SET payment_status = 'paid' WHERE is_paid = true AND payment_status = 'pending';

-- Extract customer details from shipping_address if not set
UPDATE orders 
SET 
  customer_name = shipping_address->>'fullName',
  customer_email = shipping_address->>'email',
  customer_phone = shipping_address->>'phone'
WHERE customer_name IS NULL;

COMMENT ON TABLE orders IS 'Complete order information including customer details, payment, status tracking, and delivery information';
COMMENT ON COLUMN orders.order_number IS 'Unique order identifier in format ORD-YYYYMMDD-XXXX';
COMMENT ON COLUMN orders.guest_uuid IS 'UUID for guest checkout orders (when user_id is NULL)';
COMMENT ON COLUMN orders.status_history IS 'JSON array tracking all status changes with timestamps';
COMMENT ON COLUMN orders.payment_status IS 'Current payment status: pending, paid, failed, refunded';
COMMENT ON COLUMN orders.order_status IS 'Current order fulfillment status';
COMMENT ON COLUMN orders.estimated_delivery_date IS 'Calculated delivery estimate (default: 7 days from order)';
