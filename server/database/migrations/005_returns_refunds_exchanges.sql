-- ============================================
-- MIGRATION: Returns, Refunds & Exchanges System
-- Purpose: Track post-purchase operations with complete workflow
-- ============================================

-- Create returns table
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order and user references
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_uuid UUID,
  
  -- Return request details
  return_type VARCHAR(50) NOT NULL CHECK (return_type IN ('return', 'refund', 'exchange')),
  reason VARCHAR(50) NOT NULL,
  reason_details TEXT,
  
  -- Items being returned
  return_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{ productId, productName, variant: {size, color}, quantity, price, reason }]
  
  -- Photos/evidence
  photos JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ url, caption, uploadedAt }]
  
  -- Exchange details (if type is exchange)
  exchange_product_id TEXT,
  exchange_variant JSONB,
  exchange_details JSONB,
  
  -- Status workflow
  status VARCHAR(50) NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'under_review', 'approved', 'rejected', 
    'pickup_scheduled', 'picked_up', 'inspecting',
    'accepted', 'completed', 'cancelled'
  )),
  
  -- Refund information
  refund_amount DECIMAL(10, 2) DEFAULT 0.0,
  refund_method VARCHAR(50),
  refund_status VARCHAR(50) DEFAULT 'pending' CHECK (refund_status IN (
    'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'
  )),
  refund_reference TEXT,
  refunded_at TIMESTAMP,
  
  -- Quality check for returned items
  item_condition VARCHAR(50),
  resellable BOOLEAN DEFAULT FALSE,
  
  -- Tracking
  pickup_date DATE,
  pickup_address JSONB,
  tracking_number VARCHAR(100),
  
  -- Admin notes and communication
  admin_notes TEXT,
  rejection_reason TEXT,
  
  -- Status history
  status_history JSONB DEFAULT '[]'::jsonb,
  -- Format: [{ status, timestamp, note, updatedBy }]
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_user_reference CHECK (
    (user_id IS NOT NULL AND guest_uuid IS NULL) OR 
    (user_id IS NULL AND guest_uuid IS NOT NULL)
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_guest_uuid ON returns(guest_uuid);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_return_type ON returns(return_type);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_refund_status ON returns(refund_status);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_returns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_update_returns_timestamp ON returns;
CREATE TRIGGER trigger_update_returns_timestamp
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_returns_timestamp();

-- Function to track status changes
CREATE OR REPLACE FUNCTION update_return_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history := OLD.status_history || jsonb_build_object(
      'status', NEW.status,
      'timestamp', CURRENT_TIMESTAMP,
      'note', COALESCE(NEW.admin_notes, ''),
      'previous_status', OLD.status
    );
    
    -- Set completed_at when status becomes completed
    IF NEW.status = 'completed' THEN
      NEW.completed_at := CURRENT_TIMESTAMP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for status history
DROP TRIGGER IF EXISTS trigger_update_return_status_history ON returns;
CREATE TRIGGER trigger_update_return_status_history
  BEFORE UPDATE ON returns
  FOR EACH ROW
  EXECUTE FUNCTION update_return_status_history();

-- Add return_id reference to orders table (optional, for tracking)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_return BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMP;

-- Create index for orders with returns
CREATE INDEX IF NOT EXISTS idx_orders_has_return ON orders(has_return) WHERE has_return = TRUE;

-- Add comments for documentation
COMMENT ON TABLE returns IS 'Tracks all return, refund, and exchange requests with complete workflow';
COMMENT ON COLUMN returns.return_type IS 'Type of request: return, refund, or exchange';
COMMENT ON COLUMN returns.status IS 'Current status in the return workflow';
COMMENT ON COLUMN returns.return_items IS 'JSON array of items being returned with details';
COMMENT ON COLUMN returns.photos IS 'JSON array of photo URLs for evidence/documentation';
COMMENT ON COLUMN returns.refund_status IS 'Status of refund processing (separate from return status)';
COMMENT ON COLUMN returns.resellable IS 'Whether returned items can be restocked and resold';
COMMENT ON COLUMN returns.status_history IS 'Complete timeline of status changes';

-- Create view for active returns (not completed/cancelled)
CREATE OR REPLACE VIEW active_returns AS
SELECT * FROM returns
WHERE status NOT IN ('completed', 'cancelled', 'rejected')
ORDER BY created_at DESC;

-- Create view for returns requiring action
CREATE OR REPLACE VIEW returns_pending_action AS
SELECT * FROM returns
WHERE status IN ('requested', 'under_review', 'approved', 'pickup_scheduled', 'inspecting')
ORDER BY created_at ASC;

COMMENT ON VIEW active_returns IS 'All returns that are still in progress';
COMMENT ON VIEW returns_pending_action IS 'Returns requiring admin attention or action';
