-- Migration 001: Initial schema
-- Creates all tables, indexes, views, and seed data for the RBAC system

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum: audit_action ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'auth.login',
    'auth.logout',
    'auth.failed_attempt',
    'user.created',
    'user.updated',
    'user.banned',
    'permission.granted',
    'permission.revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Table: users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                         VARCHAR(255) NOT NULL UNIQUE,
  password_hash                 VARCHAR(255),
  first_name                    VARCHAR(100) NOT NULL DEFAULT '',
  last_name                     VARCHAR(100) NOT NULL DEFAULT '',
  role                          VARCHAR(50)  NOT NULL DEFAULT 'customer'
                                CHECK (role IN ('admin', 'manager', 'agent', 'customer')),
  status                        VARCHAR(20)  NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'suspended', 'banned')),
  manager_id                    UUID         REFERENCES users(id) ON DELETE SET NULL,
  google_id                     VARCHAR(255) UNIQUE,
  facebook_id                   VARCHAR(255) UNIQUE,
  avatar_url                    TEXT,
  failed_login_attempts         INTEGER      NOT NULL DEFAULT 0,
  locked_until                  TIMESTAMPTZ,
  refresh_token_hash            VARCHAR(255),
  refresh_token_expires_at      TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email       ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role        ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status      ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_manager_id  ON users (manager_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id   ON users (google_id)   WHERE google_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users (facebook_id) WHERE facebook_id IS NOT NULL;

-- ── Table: permissions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  atom        VARCHAR(100) NOT NULL UNIQUE,
  label       VARCHAR(255) NOT NULL,
  description TEXT,
  module      VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions (module);

-- ── Table: role_permissions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role          VARCHAR(50) NOT NULL,
  permission_id UUID        NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role);

-- ── Table: user_permissions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID        NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted       BOOLEAN     NOT NULL,
  granted_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions (user_id);

-- ── Table: audit_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  target_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  action     audit_action NOT NULL,
  metadata   JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor     ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target    ON audit_logs (target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON audit_logs (created_at DESC);

-- ── Table: session_blacklist ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_blacklist (
  jti        VARCHAR(255) PRIMARY KEY,
  expires_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_blacklist_expires ON session_blacklist (expires_at);

-- ── View: resolved_user_permissions ───────────────────────────────────────────
CREATE OR REPLACE VIEW resolved_user_permissions AS
SELECT
  u.id AS user_id,
  p.id AS permission_id,
  p.atom,
  p.module,
  COALESCE(up.granted, true) AS granted
FROM users u
JOIN role_permissions rp ON rp.role = u.role
JOIN permissions p       ON p.id   = rp.permission_id
LEFT JOIN user_permissions up
  ON  up.user_id       = u.id
  AND up.permission_id  = p.id;

-- ── Seed permissions ──────────────────────────────────────────────────────────
INSERT INTO permissions (atom, label, module) VALUES
  ('dashboard.view',       'View Dashboard',      'dashboard'),
  ('users.view',           'View Users',          'users'),
  ('users.manage',         'Manage Users',        'users'),
  ('permissions.manage',   'Manage Permissions',  'permissions'),
  ('audit.view',           'View Audit Logs',     'audit'),
  ('leads.view',           'View Leads',          'leads'),
  ('tasks.view',           'View Tasks',          'tasks'),
  ('customer_portal.view', 'Customer Portal',     'customer_portal'),
  ('settings.manage',      'Manage Settings',     'settings')
ON CONFLICT (atom) DO NOTHING;

-- ── Seed admin user (password: Admin@1234) ────────────────────────────────────
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
  'admin@example.com',
  crypt('Admin@1234', gen_salt('bf', 12)),
  'Super',
  'Admin',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- ── Seed role permissions ─────────────────────────────────────────────────────
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions
WHERE atom NOT IN ('audit.view', 'permissions.manage', 'settings.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'agent', id FROM permissions
WHERE atom IN ('dashboard.view', 'leads.view', 'tasks.view', 'customer_portal.view')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'customer', id FROM permissions
WHERE atom = 'customer_portal.view'
ON CONFLICT DO NOTHING;

COMMIT;
