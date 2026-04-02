-- Migration 003: Add user photos table (Cloudinary)
-- Handles both fresh install and upgrade from old filename-based schema
-- Run after 002_add_email_verification.sql

BEGIN;

-- Drop old table if it exists with old columns (filename-based)
-- Safe for fresh installs too — DROP TABLE IF EXISTS won't fail
DROP TABLE IF EXISTS user_photos;

-- Create fresh with Cloudinary columns
CREATE TABLE user_photos (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name        VARCHAR(255) NOT NULL,
  mime_type            VARCHAR(100) NOT NULL,
  size_bytes           INTEGER      NOT NULL,
  cloudinary_url       TEXT         NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_photos_user    ON user_photos (user_id);
CREATE INDEX idx_user_photos_created ON user_photos (created_at DESC);

-- ── Audit action for photo operations ─────────────────────────────────────────
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'photo.uploaded';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'photo.deleted';

COMMIT;
