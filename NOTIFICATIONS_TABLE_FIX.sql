-- Create notifications table if it does not exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure unread default is false
ALTER TABLE notifications ALTER COLUMN is_read SET DEFAULT FALSE;

-- Ensure admin/service inserts are not blocked by RLS
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Verify notifications schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;
