-- Migration: Add notifications system
-- Created: 2024-01-01
-- Description: Creates tables for real-time notifications, preferences, and templates

-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'order_created',
  'order_updated',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  'payment_received',
  'payment_failed',
  'product_approved',
  'product_rejected',
  'vendor_approved',
  'vendor_rejected',
  'payout_processed',
  'review_received',
  'system_alert',
  'security_alert',
  'welcome',
  'password_reset',
  'email_verification',
  'custom'
);

-- Create notification priority enum
CREATE TYPE notification_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Create notification channel enum
CREATE TYPE notification_channel AS ENUM (
  'in_app',
  'email',
  'sms',
  'push',
  'webhook'
);

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'normal',
  channels JSONB NOT NULL DEFAULT '["in_app"]',
  delivered_channels JSONB NOT NULL DEFAULT '[]',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  category VARCHAR(100),
  tags JSONB DEFAULT '[]',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  preferences JSONB NOT NULL DEFAULT '{}',
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  quiet_hours_timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  daily_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  digest_time VARCHAR(5) NOT NULL DEFAULT '09:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create notification templates table
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  subject VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for notifications table
CREATE INDEX notifications_user_id_idx ON notifications(user_id);
CREATE INDEX notifications_type_idx ON notifications(type);
CREATE INDEX notifications_is_read_idx ON notifications(is_read);
CREATE INDEX notifications_created_at_idx ON notifications(created_at);
CREATE INDEX notifications_scheduled_for_idx ON notifications(scheduled_for);
CREATE INDEX notifications_category_idx ON notifications(category);

-- Create indexes for notification preferences table
CREATE INDEX notification_preferences_user_id_idx ON notification_preferences(user_id);

-- Create indexes for notification templates table
CREATE INDEX notification_templates_type_channel_idx ON notification_templates(type, channel);
CREATE INDEX notification_templates_language_idx ON notification_templates(language);

-- Add foreign key constraints (assuming users table exists)
-- ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE notification_preferences ADD CONSTRAINT fk_notification_preferences_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON notifications 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at 
  BEFORE UPDATE ON notification_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at 
  BEFORE UPDATE ON notification_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification templates
INSERT INTO notification_templates (type, channel, title, body, variables) VALUES
-- Order notifications
('order_created', 'in_app', 'Order Confirmed', 'Your order #{{orderId}} has been confirmed and is being processed.', '["orderId"]'),
('order_created', 'email', 'Order Confirmation - #{{orderId}}', 'Thank you for your order! Your order #{{orderId}} has been confirmed and is being processed. You will receive updates as your order progresses.', '["orderId", "orderTotal", "currency"]'),

('order_shipped', 'in_app', 'Order Shipped', 'Your order #{{orderId}} has been shipped and is on its way.', '["orderId", "trackingNumber"]'),
('order_shipped', 'email', 'Your Order Has Shipped - #{{orderId}}', 'Great news! Your order #{{orderId}} has been shipped. Track your package using tracking number: {{trackingNumber}}', '["orderId", "trackingNumber", "trackingUrl"]'),

('order_delivered', 'in_app', 'Order Delivered', 'Your order #{{orderId}} has been delivered.', '["orderId"]'),
('order_delivered', 'email', 'Order Delivered - #{{orderId}}', 'Your order #{{orderId}} has been successfully delivered. We hope you enjoy your purchase!', '["orderId", "deliveredAt"]'),

-- Payment notifications
('payment_received', 'in_app', 'Payment Received', 'Your payment of {{amount}} {{currency}} has been received.', '["amount", "currency"]'),
('payment_received', 'email', 'Payment Confirmation', 'We have received your payment of {{amount}} {{currency}}. Thank you for your business!', '["amount", "currency", "paymentId"]'),

('payment_failed', 'in_app', 'Payment Failed', 'Your payment of {{amount}} {{currency}} has failed. Please try again.', '["amount", "currency"]'),
('payment_failed', 'email', 'Payment Failed - Action Required', 'Your payment of {{amount}} {{currency}} could not be processed. Please update your payment method and try again.', '["amount", "currency", "failureReason"]'),

-- Vendor notifications
('vendor_approved', 'in_app', 'Vendor Application Approved', 'Congratulations! Your vendor application has been approved.', '[]'),
('vendor_approved', 'email', 'Welcome to Our Marketplace!', 'Congratulations! Your vendor application has been approved. You can now start selling on our platform.', '["businessName", "dashboardUrl"]'),

('payout_processed', 'in_app', 'Payout Processed', 'Your payout of {{amount}} {{currency}} has been processed.', '["amount", "currency"]'),
('payout_processed', 'email', 'Payout Notification', 'Your payout of {{amount}} {{currency}} for the period {{period}} has been processed and will arrive in your account within 2-3 business days.', '["amount", "currency", "period", "payoutId"]'),

-- System notifications
('system_alert', 'in_app', 'System Alert', '{{message}}', '["message"]'),
('system_alert', 'email', 'System Alert', '{{message}}', '["message"]'),

('welcome', 'in_app', 'Welcome!', 'Welcome to our platform! We''re excited to have you on board.', '[]'),
('welcome', 'email', 'Welcome to Our Platform!', 'Welcome {{firstName}}! Thank you for joining our platform. We''re excited to have you on board and look forward to serving you.', '["firstName", "activationUrl"]');

-- Create a view for unread notification counts per user
CREATE VIEW user_notification_counts AS
SELECT 
  user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
  COUNT(*) FILTER (WHERE priority = 'urgent' AND is_read = false) as urgent_unread,
  COUNT(*) FILTER (WHERE priority = 'high' AND is_read = false) as high_priority_unread
FROM notifications
GROUP BY user_id;