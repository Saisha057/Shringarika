-- Returns workflow schema hardening
ALTER TABLE returns ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspection_notes TEXT;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE returns ADD COLUMN IF NOT EXISTS return_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS pickup_address JSONB DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS pickup_scheduled_date DATE DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS pickup_time_slot TEXT DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS tracking_number TEXT DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS carrier_name TEXT DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS product_condition TEXT DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspection_photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_initiated_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_transaction_id TEXT DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS customer_confirmation BOOLEAN DEFAULT FALSE;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS priority_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ DEFAULT NULL;

-- Ensure all admin workflow statuses are allowed
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE returns ADD CONSTRAINT returns_status_check
  CHECK (status IN (
    'pending', 'requested', 'submitted',
    'approved', 'rejected',
    'picked_up', 'received', 'inspected',
    'refunded', 'completed', 'cancelled'
  ));

-- Ensure order table can reflect return state on user order page
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_refund_id TEXT DEFAULT NULL;
