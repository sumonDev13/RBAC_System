-- Migration 002: Add email verification + OAuth audit actions
-- Run after 001_initial_schema.sql

BEGIN;

-- ── Add email verification columns ────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified                BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_token      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

-- ── Add missing audit_action enum values ──────────────────────────────────────
-- These must each be separate statements (PostgreSQL limitation)
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'auth.google_login';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'auth.facebook_login';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'auth.email_verified';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user.created_via_google';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user.created_via_facebook';

COMMIT;
