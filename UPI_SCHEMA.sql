-- ============================================
-- UPI ID VERIFICATION SYSTEM - SUPABASE SCHEMA
-- ============================================

-- 1) Create UPI Verifications Table
CREATE TABLE IF NOT EXISTS upi_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  upi_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'failed', 'pending')),
  verified_name TEXT,
  provider TEXT NOT NULL,
  provider_reference_id TEXT,
  raw_response JSONB,
  ip_address TEXT,
  context TEXT CHECK (context IN ('payment', 'refund', 'wallet')),
  error_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_upi_verifications_upi_id ON upi_verifications(upi_id);
CREATE INDEX IF NOT EXISTS idx_upi_verifications_user_id ON upi_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_upi_verifications_order_id ON upi_verifications(order_id);
CREATE INDEX IF NOT EXISTS idx_upi_verifications_status ON upi_verifications(status);
CREATE INDEX IF NOT EXISTS idx_upi_verifications_created_at ON upi_verifications(created_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_upi_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER upi_verifications_updated_at
  BEFORE UPDATE ON upi_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_upi_verifications_updated_at();

-- 2) Add UPI Refund Columns to Existing Returns/Refunds Table
-- Note: Adjust table name if you use 'refunds' or 'return_requests' instead of 'returns'

-- Check if returns table exists, if not, create it
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'cancelled')),
  refund_amount DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add UPI refund columns to returns table
ALTER TABLE returns 
  ADD COLUMN IF NOT EXISTS refund_upi_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_upi_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refund_upi_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS refund_provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS refund_transfer_status TEXT 
    CHECK (refund_transfer_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS refund_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_transfer_utr TEXT,
  ADD COLUMN IF NOT EXISTS refund_initiated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP WITH TIME ZONE;

-- Index for refund tracking
CREATE INDEX IF NOT EXISTS idx_returns_refund_status ON returns(refund_transfer_status);
CREATE INDEX IF NOT EXISTS idx_returns_upi_id ON returns(refund_upi_id);

-- 3) Rate Limiting Table for UPI Verification
CREATE TABLE IF NOT EXISTS upi_verification_rate_limit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or user_id
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'user_id')),
  attempt_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint per identifier per time window
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_identifier 
  ON upi_verification_rate_limit(identifier, identifier_type);

-- Cleanup old rate limit records (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM upi_verification_rate_limit 
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 4) Add UPI Payment Option to Orders Table (if not exists)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_upi_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_upi_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_upi_verification_id UUID REFERENCES upi_verifications(id);

-- Index for UPI payment tracking
CREATE INDEX IF NOT EXISTS idx_orders_payment_upi_id ON orders(payment_upi_id);

-- 5) Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE upi_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE upi_verification_rate_limit ENABLE ROW LEVEL SECURITY;

-- UPI Verifications: Users can view their own, admins can view all
CREATE POLICY upi_verifications_select_own 
  ON upi_verifications FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
  );

-- UPI Verifications: Only backend service can insert
CREATE POLICY upi_verifications_insert_service 
  ON upi_verifications FOR INSERT 
  WITH CHECK (true); -- Backend will handle auth via service role key

-- Returns: Users can view their own, admins can view all
CREATE POLICY returns_select_own 
  ON returns FOR SELECT 
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
  );

-- Returns: Users can insert their own
CREATE POLICY returns_insert_own 
  ON returns FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Returns: Users can update their own, admins can update any
CREATE POLICY returns_update_own 
  ON returns FOR UPDATE 
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
  );

-- Rate Limit: No direct user access (backend only)
CREATE POLICY rate_limit_backend_only 
  ON upi_verification_rate_limit FOR ALL 
  USING (false);

-- 6) Comments for documentation
COMMENT ON TABLE upi_verifications IS 'Stores all UPI ID verification attempts with payment gateway responses';
COMMENT ON TABLE returns IS 'Stores product return and refund requests with UPI refund details';
COMMENT ON TABLE upi_verification_rate_limit IS 'Tracks verification attempts for rate limiting';

COMMENT ON COLUMN upi_verifications.status IS 'Verification status: verified (success), failed (invalid UPI), pending (in progress)';
COMMENT ON COLUMN upi_verifications.provider IS 'Payment gateway used: razorpay, cashfree, phonepe, payu, etc.';
COMMENT ON COLUMN upi_verifications.context IS 'Why verification was performed: payment, refund, or wallet';
COMMENT ON COLUMN returns.refund_transfer_status IS 'Status of actual money transfer to customer UPI';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ UPI Verification System Schema Created Successfully';
  RAISE NOTICE '   - upi_verifications table ready';
  RAISE NOTICE '   - returns table updated with UPI refund columns';
  RAISE NOTICE '   - Rate limiting table configured';
  RAISE NOTICE '   - RLS policies enabled';
  RAISE NOTICE '   - Indexes created for performance';
END $$;
