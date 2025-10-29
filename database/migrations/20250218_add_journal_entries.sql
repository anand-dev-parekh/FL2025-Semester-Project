BEGIN;

CREATE TABLE IF NOT EXISTS journal_entries (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id     BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL,
  reflection  TEXT,
  xp_delta    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_goal_id ON journal_entries(goal_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON journal_entries(entry_date);

COMMIT;
