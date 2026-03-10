-- Add lockout columns to usuarios
ALTER TABLE usuarios ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN is_locked BOOLEAN DEFAULT false;
ALTER TABLE usuarios ADD COLUMN locked_at TIMESTAMPTZ;

-- Audit log table for security events
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
