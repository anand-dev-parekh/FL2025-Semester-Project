-- Add quantitative value columns to journal entries and align defaults.
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS numeric_value DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS numeric_unit TEXT,
  ALTER COLUMN completion_level SET DEFAULT 'missed';
