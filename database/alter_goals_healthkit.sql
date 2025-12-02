-- Adds HealthKit-specific goal fields to existing databases.
-- Run with: psql -d magic_journal -f alter_goals_healthkit.sql

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS uses_healthkit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS health_metric TEXT,
  ADD COLUMN IF NOT EXISTS target_value INTEGER,
  ADD COLUMN IF NOT EXISTS target_unit TEXT;

ALTER TABLE goals
  ADD CONSTRAINT goals_health_metric_check
    CHECK (health_metric IN ('steps','exercise_minutes','sleep_minutes') OR health_metric IS NULL);

ALTER TABLE goals
  ADD CONSTRAINT goals_target_value_check
    CHECK (target_value IS NULL OR target_value >= 0);
