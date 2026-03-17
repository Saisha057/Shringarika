-- ============================================================================
-- Migration 014: User Payment Methods Verification System
-- ============================================================================
-- Purpose: Create secure verification flow for UPI IDs and Bank Accounts
-- Author: System
-- Date: 2026-01-13
-- ============================================================================

-- Drop existing table if needed (CAUTION: This will delete data)
-- DROP TABLE IF EXISTS user_payment_methods CASCADE;
-- DROP TABLE IF EXISTS payment_verification_attempts CASCADE;

-- ============================================================================
-- 1. CREATE user_payment_methods TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Payment Method Type
  type VARCHAR(10) NOT NULL CHECK (type IN ('UPI', 'BANK')),
  
  -- Payment Identifiers
  identifier VARCHAR(255) NOT NULL, -- UPI ID or Account Number
  ifsc VARCHAR(11), -- Only for bank accounts (e.g., SBIN0001234)
  
  -- Verified Information (from API)
  account_holder_name VARCHAR(255), -- Name fetched from verification API
  bank_name VARCHAR(255), -- Only for bank accounts
  
  -- Verification Status
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  verification_provider VARCHAR(50), -- e.g., 'razorpay', 'cashfree', 'decentro'
  
  -- Security & Metadata
  verification_response JSONB, -- Store full API response for audit
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  admin_review_required BOOLEAN DEFAULT false,
  admin_review_note TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_payment_method UNIQUE (user_id, type, identifier),
  CONSTRAINT valid_ifsc_format CHECK (
    (type = 'BANK' AND ifsc IS NOT NULL AND LENGTH(ifsc) = 11) OR
    (type = 'UPI')
  ),
  CONSTRAINT valid_upi_format CHECK (
    (type = 'UPI' AND identifier ~ '^[a-zA-Z0-9._-]+@[a-zA-Z]+$') OR
    (type = 'BANK')
  )
);

-- ============================================================================
-- 2. CREATE payment_verification_attempts TABLE (Rate Limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_verification_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Attempt Details
  type VARCHAR(10) NOT NULL CHECK (type IN ('UPI', 'BANK')),
  identifier VARCHAR(255) NOT NULL,
  ifsc VARCHAR(11),
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  api_response JSONB,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id 
  ON user_payment_methods(user_id);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_type 
  ON user_payment_methods(type);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_verified 
  ON user_payment_methods(is_verified);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_default 
  ON user_payment_methods(is_default) 
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_payment_verification_attempts_user_time 
  ON payment_verification_attempts(user_id, attempted_at DESC);

-- Note: Removed idx_payment_verification_attempts_recent index
-- Reason: NOW() function in WHERE clause is VOLATILE and cannot be used in index predicates

-- ============================================================================
-- 4. CREATE FUNCTION: Rate Limiting Check
-- ============================================================================

CREATE OR REPLACE FUNCTION check_verification_rate_limit(
  p_user_id UUID,
  p_max_attempts INTEGER DEFAULT 5,
  p_time_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
  allowed BOOLEAN,
  attempts_used INTEGER,
  attempts_remaining INTEGER,
  reset_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_attempts_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_start := NOW() - (p_time_window_minutes || ' minutes')::INTERVAL;
  
  SELECT COUNT(*)
  INTO v_attempts_count
  FROM payment_verification_attempts
  WHERE user_id = p_user_id
    AND attempted_at > v_window_start;
  
  RETURN QUERY SELECT
    v_attempts_count < p_max_attempts AS allowed,
    v_attempts_count AS attempts_used,
    GREATEST(0, p_max_attempts - v_attempts_count) AS attempts_remaining,
    (SELECT MIN(attempted_at) + (p_time_window_minutes || ' minutes')::INTERVAL
     FROM payment_verification_attempts
     WHERE user_id = p_user_id
       AND attempted_at > v_window_start) AS reset_at;
END;
$$;

-- ============================================================================
-- 5. CREATE FUNCTION: Log Verification Attempt
-- ============================================================================

CREATE OR REPLACE FUNCTION log_verification_attempt(
  p_user_id UUID,
  p_type VARCHAR(10),
  p_identifier VARCHAR(255),
  p_ifsc VARCHAR(11),
  p_success BOOLEAN,
  p_error_message TEXT,
  p_api_response JSONB,
  p_ip_address INET,
  p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  INSERT INTO payment_verification_attempts (
    user_id,
    type,
    identifier,
    ifsc,
    success,
    error_message,
    api_response,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_type,
    p_identifier,
    p_ifsc,
    p_success,
    p_error_message,
    p_api_response,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$;

-- ============================================================================
-- 6. CREATE FUNCTION: Check Name Matching
-- ============================================================================

CREATE OR REPLACE FUNCTION check_name_similarity(
  p_user_id UUID,
  p_verified_name VARCHAR(255)
)
RETURNS TABLE(
  user_name VARCHAR(255),
  verified_name VARCHAR(255),
  similarity_score NUMERIC,
  requires_review BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_name VARCHAR(255);
  v_similarity NUMERIC;
BEGIN
  -- Get user's name from profiles or users table
  SELECT COALESCE(p.first_name || ' ' || p.last_name, u.name)
  INTO v_user_name
  FROM users u
  LEFT JOIN profiles p ON u.id = p.user_id
  WHERE u.id = p_user_id;
  
  -- Calculate similarity using PostgreSQL's similarity function
  -- (requires pg_trgm extension)
  SELECT similarity(LOWER(v_user_name), LOWER(p_verified_name))
  INTO v_similarity;
  
  RETURN QUERY SELECT
    v_user_name AS user_name,
    p_verified_name AS verified_name,
    v_similarity AS similarity_score,
    (v_similarity < 0.4) AS requires_review; -- Threshold: 40% similarity
END;
$$;

-- ============================================================================
-- 7. CREATE TRIGGER: Update timestamp on modification
-- ============================================================================

CREATE OR REPLACE FUNCTION update_payment_method_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_method_timestamp
  BEFORE UPDATE ON user_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_method_timestamp();

-- ============================================================================
-- 8. CREATE TRIGGER: Ensure only one default payment method per type
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other defaults for this user and type
    UPDATE user_payment_methods
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND type = NEW.type
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default
  BEFORE INSERT OR UPDATE ON user_payment_methods
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_payment_method();

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment methods
CREATE POLICY "Users can view own payment methods"
  ON user_payment_methods FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Users can insert their own payment methods
CREATE POLICY "Users can insert own payment methods"
  ON user_payment_methods FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own payment methods
CREATE POLICY "Users can update own payment methods"
  ON user_payment_methods FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own payment methods
CREATE POLICY "Users can delete own payment methods"
  ON user_payment_methods FOR DELETE
  USING (user_id = auth.uid());

-- Admins can view all payment methods
CREATE POLICY "Admins can view all payment methods"
  ON user_payment_methods FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Users can view their own verification attempts
CREATE POLICY "Users can view own verification attempts"
  ON payment_verification_attempts FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- ============================================================================
-- 10. VERIFICATION & TESTING
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*)
  INTO table_count
  FROM information_schema.tables
  WHERE table_name IN ('user_payment_methods', 'payment_verification_attempts')
    AND table_schema = 'public';
  
  -- Count functions
  SELECT COUNT(*)
  INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'check_verification_rate_limit',
      'log_verification_attempt',
      'check_name_similarity'
    );
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 014 COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables Created: %', table_count;
  RAISE NOTICE 'Functions Created: %', function_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  IF table_count < 2 THEN
    RAISE EXCEPTION 'Migration failed: Not all tables created';
  END IF;
  
  IF function_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: Not all functions created';
  END IF;
END $$;

-- ============================================================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================================================

-- Test rate limiting
-- SELECT * FROM check_verification_rate_limit('user-uuid-here');

-- Test name matching
-- SELECT * FROM check_name_similarity('user-uuid-here', 'JOHN DOE');

-- View user's payment methods
-- SELECT * FROM user_payment_methods WHERE user_id = 'user-uuid-here';

-- View recent verification attempts
-- SELECT * FROM payment_verification_attempts 
-- WHERE user_id = 'user-uuid-here' 
-- ORDER BY attempted_at DESC LIMIT 10;
