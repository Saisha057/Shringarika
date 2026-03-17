-- ============================================================
-- Migration 016: Create contact_submissions table
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(255) NOT NULL,
  email       varchar(255) NOT NULL,
  phone       varchar(50),
  subject     varchar(500) NOT NULL,
  message     text         NOT NULL,
  status      varchar(50)  NOT NULL DEFAULT 'new', -- new | read | replied
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status
  ON contact_submissions(status);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
  ON contact_submissions(created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_contact_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_submissions_updated_at ON contact_submissions;
CREATE TRIGGER trg_contact_submissions_updated_at
  BEFORE UPDATE ON contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_submissions_updated_at();

-- Row-Level Security: Service role can do everything; anon/public cannot read
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow the backend (service_role) to INSERT
CREATE POLICY "service_role_insert_contact" ON contact_submissions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow the backend (service_role) to SELECT / UPDATE
CREATE POLICY "service_role_select_contact" ON contact_submissions
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role_update_contact" ON contact_submissions
  FOR UPDATE
  TO service_role
  USING (true);
