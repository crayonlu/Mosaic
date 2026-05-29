-- Add CHECK constraint to enforce valid role values
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
