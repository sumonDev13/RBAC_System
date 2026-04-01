-- Migration: Add email verification columns and missing audit_action values
-- Run this against your PostgreSQL database

-- Add email verification columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

-- Add missing audit_action enum values
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'auth.google_login';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'user.created_via_google';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'auth.email_verified';
