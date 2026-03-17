/**
 * Database Migration - Admin & Operations Features
 * Creates tables for: Audit Logs, Roles, Permissions, Backups
 */

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- ROLE ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for role assignments
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role ON role_assignments(role);

-- ============================================
-- BACKUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename VARCHAR(255) NOT NULL UNIQUE,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  backup_type VARCHAR(50) DEFAULT 'full',
  status VARCHAR(50) DEFAULT 'pending',
  tables_included TEXT[],
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for backups
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_created_by ON backups(created_by);

-- ============================================
-- ADD ROLE COLUMN TO USERS TABLE (IF NOT EXISTS)
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Audit Logs RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY audit_logs_admin_select ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Only system can insert audit logs (no direct inserts from users)
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Role Assignments RLS
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can view all role assignments
CREATE POLICY role_assignments_select ON role_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Only admins can insert role assignments
CREATE POLICY role_assignments_insert ON role_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Backups RLS
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Admins can view all backups
CREATE POLICY backups_admin_select ON backups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Admins can create backups
CREATE POLICY backups_admin_insert ON backups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Admins can update backup status
CREATE POLICY backups_admin_update ON backups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete old backups
CREATE POLICY backups_admin_delete ON backups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to cleanup old audit logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs 
  WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit statistics
CREATE OR REPLACE FUNCTION get_audit_statistics(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_actions', COUNT(*),
    'unique_users', COUNT(DISTINCT user_id),
    'actions_by_type', (
      SELECT json_object_agg(action, count)
      FROM (
        SELECT action, COUNT(*) as count
        FROM audit_logs
        WHERE (start_date IS NULL OR created_at >= start_date)
          AND (end_date IS NULL OR created_at <= end_date)
        GROUP BY action
      ) actions
    ),
    'actions_by_entity', (
      SELECT json_object_agg(entity_type, count)
      FROM (
        SELECT entity_type, COUNT(*) as count
        FROM audit_logs
        WHERE (start_date IS NULL OR created_at >= start_date)
          AND (end_date IS NULL OR created_at <= end_date)
        GROUP BY entity_type
      ) entities
    )
  ) INTO result
  FROM audit_logs
  WHERE (start_date IS NULL OR created_at >= start_date)
    AND (end_date IS NULL OR created_at <= end_date);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get user role permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  user_role VARCHAR(50);
  permissions JSON;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = p_user_id;
  
  -- Return permissions based on role
  -- This is a simplified version - permissions are defined in the application
  SELECT json_build_object(
    'role', user_role,
    'has_admin_access', user_role IN ('admin', 'super_admin'),
    'can_manage_users', user_role IN ('admin', 'super_admin'),
    'can_manage_products', user_role IN ('admin', 'super_admin', 'manager'),
    'can_manage_orders', user_role IN ('admin', 'super_admin', 'manager', 'support'),
    'can_view_analytics', user_role IN ('admin', 'super_admin', 'manager')
  ) INTO permissions;
  
  RETURN permissions;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Add index on users role column
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created ON audit_logs(entity_type, entity_id, created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================

-- Uncomment to add sample admin user
/*
INSERT INTO users (email, name, role, password_hash)
VALUES 
  ('admin@shringarika.com', 'Admin User', 'admin', 'hashed_password_here'),
  ('manager@shringarika.com', 'Manager User', 'manager', 'hashed_password_here'),
  ('support@shringarika.com', 'Support User', 'support', 'hashed_password_here')
ON CONFLICT (email) DO NOTHING;
*/

-- ============================================
-- GRANTS (IF NEEDED)
-- ============================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON role_assignments TO authenticated;
GRANT SELECT ON backups TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE audit_logs IS 'Stores audit trail of all admin actions and system changes';
COMMENT ON TABLE role_assignments IS 'Tracks role assignment history for users';
COMMENT ON TABLE backups IS 'Stores information about database backups';

COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'Removes audit logs older than 90 days';
COMMENT ON FUNCTION get_audit_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Returns aggregated statistics about audit logs';
COMMENT ON FUNCTION get_user_permissions(UUID) IS 'Returns permissions for a given user based on their role';
