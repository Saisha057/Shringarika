-- Notifications & Communication Database Migration
-- Creates tables for chat, notifications, device tokens, and preferences

-- ======================
-- CHAT TABLES
-- ======================

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  support_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'closed')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_support_id ON chats(support_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_started_at ON chats(started_at DESC);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- ======================
-- PUSH NOTIFICATION TABLES
-- ======================

-- Device tokens table (for push notifications)
CREATE TABLE IF NOT EXISTS device_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('web', 'ios', 'android')),
  browser VARCHAR(100),
  os VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_token ON device_tokens(token);
CREATE INDEX idx_device_tokens_is_active ON device_tokens(is_active);

-- ======================
-- NOTIFICATION PREFERENCES
-- ======================

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{
    "email": {
      "orderConfirmation": true,
      "orderShipped": true,
      "orderDelivered": true,
      "promotional": true,
      "newsletter": true,
      "accountUpdates": true,
      "securityAlerts": true
    },
    "sms": {
      "orderConfirmation": true,
      "orderShipped": true,
      "orderDelivered": true,
      "promotional": false,
      "otp": true,
      "paymentConfirmation": true
    },
    "push": {
      "orderConfirmation": true,
      "orderShipped": true,
      "orderDelivered": true,
      "promotional": true,
      "chatMessages": true,
      "lowStock": false
    },
    "whatsapp": {
      "orderConfirmation": true,
      "orderShipped": true,
      "orderDelivered": true,
      "promotional": false,
      "customerSupport": true,
      "cartReminder": true
    },
    "frequency": "realtime",
    "doNotDisturb": {
      "enabled": false,
      "startTime": "22:00",
      "endTime": "08:00"
    }
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- ======================
-- NOTIFICATION LOGS
-- ======================

-- Notification logs table (for tracking sent notifications)
CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'whatsapp')),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX idx_notification_logs_type ON notification_logs(type);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at DESC);

-- ======================
-- ROW LEVEL SECURITY
-- ======================

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Chats policies
CREATE POLICY "Users can view their own chats"
  ON chats FOR SELECT
  USING (user_id = auth.uid() OR support_id = auth.uid());

CREATE POLICY "Users can create their own chats"
  ON chats FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Support agents can update chats"
  ON chats FOR UPDATE
  USING (support_id = auth.uid() OR user_id = auth.uid());

-- Chat messages policies
CREATE POLICY "Users can view messages from their chats"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_messages.chat_id
      AND (chats.user_id = auth.uid() OR chats.support_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their chats"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_messages.chat_id
      AND (chats.user_id = auth.uid() OR chats.support_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages"
  ON chat_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Device tokens policies
CREATE POLICY "Users can view their own device tokens"
  ON device_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own device tokens"
  ON device_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own device tokens"
  ON device_tokens FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own device tokens"
  ON device_tokens FOR DELETE
  USING (user_id = auth.uid());

-- Notification preferences policies
CREATE POLICY "Users can view their own preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- Notification logs policies
CREATE POLICY "Users can view their own notification logs"
  ON notification_logs FOR SELECT
  USING (user_id = auth.uid());

-- ======================
-- TRIGGERS
-- ======================

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- CLEANUP FUNCTIONS
-- ======================

-- Cleanup old closed chats (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_chats()
RETURNS void AS $$
BEGIN
  DELETE FROM chats
  WHERE status = 'closed'
  AND ended_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup inactive device tokens (older than 180 days)
CREATE OR REPLACE FUNCTION cleanup_inactive_tokens()
RETURNS void AS $$
BEGIN
  UPDATE device_tokens
  SET is_active = false
  WHERE last_used_at < NOW() - INTERVAL '180 days'
  AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old notification logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM notification_logs
  WHERE sent_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE chats IS 'Real-time customer support chat sessions';
COMMENT ON TABLE chat_messages IS 'Messages in chat sessions';
COMMENT ON TABLE device_tokens IS 'FCM device tokens for push notifications';
COMMENT ON TABLE notification_preferences IS 'User notification channel preferences';
COMMENT ON TABLE notification_logs IS 'History of sent notifications';

COMMENT ON COLUMN chats.status IS 'Chat status: waiting (new), active (agent assigned), closed (ended)';
COMMENT ON COLUMN chat_messages.type IS 'Message type: text, image, file, or system';
COMMENT ON COLUMN device_tokens.device_type IS 'Device type: web, ios, or android';
COMMENT ON COLUMN notification_logs.channel IS 'Notification channel: email, sms, push, or whatsapp';
COMMENT ON COLUMN notification_logs.status IS 'Delivery status: sent, failed, or pending';
