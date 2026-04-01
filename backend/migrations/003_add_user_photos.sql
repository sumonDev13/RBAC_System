-- Migration 003: Add user photos table
-- Run after 002_add_email_verification.sql

BEGIN;

-- ── Table: user_photos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_photos (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,              -- stored filename (uuid.ext)
  original_name VARCHAR(255) NOT NULL,              -- original upload name
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    INTEGER      NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_photos_user    ON user_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_created ON user_photos (created_at DESC);

-- ── Audit action for photo operations ─────────────────────────────────────────
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'photo.uploaded';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'photo.deleted';

COMMIT;
