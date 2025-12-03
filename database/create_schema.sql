-- magic_journal schema
-- Run with: psql -f create_schema.sql

BEGIN;

-- ===== Enums =====
-- Friend request status (pending -> accepted/declined/cancelled)
CREATE TYPE friend_request_status AS ENUM ('pending','accepted','declined','cancelled');

-- ===== Core tables =====
CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  oauth_id     TEXT UNIQUE,
  email        TEXT UNIQUE,
  name         TEXT,
  bio          TEXT,
  level        INTEGER NOT NULL DEFAULT 1,
  streak       INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  theme_preference TEXT NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('system','light','dark'))
);

CREATE TABLE IF NOT EXISTS habits (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS badges (
  id           BIGSERIAL PRIMARY KEY,
  badge        TEXT NOT NULL UNIQUE,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS group_challenges (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT
);

-- ===== Dependent tables =====
CREATE TABLE IF NOT EXISTS goals (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id     BIGINT NOT NULL REFERENCES habits(id) ON DELETE RESTRICT,
  goal_text    TEXT NOT NULL,
  xp           INTEGER NOT NULL DEFAULT 0,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  uses_healthkit BOOLEAN NOT NULL DEFAULT FALSE,
  health_metric  TEXT CHECK (health_metric IN ('steps','exercise_minutes','sleep_minutes')),
  target_value   INTEGER CHECK (target_value IS NULL OR target_value >= 0),
  target_unit    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Helpful FKs indexes (Postgres doesn’t auto-index FKs)
CREATE INDEX IF NOT EXISTS idx_goals_user_id  ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_habit_id ON goals(habit_id);

-- User ↔ Badge (M:N)
CREATE TABLE IF NOT EXISTS user_badges (
  user_id   BIGINT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  badge_id  BIGINT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- User ↔ Group_Challenge (M:N)
CREATE TABLE IF NOT EXISTS user_group_challenges (
  user_id  BIGINT NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES group_challenges(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

-- Friend requests (directed edge: sender -> receiver)
CREATE TABLE IF NOT EXISTS friend_requests (
  id          BIGSERIAL PRIMARY KEY,
  sender_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      friend_request_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_id ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status      ON friend_requests(status);

-- Friends (undirected edge: store once with user_id1 < user_id2)
CREATE TABLE IF NOT EXISTS friends (
  user_id1 BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id2 BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  since    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id1, user_id2),
  CHECK (user_id1 < user_id2)
);
CREATE INDEX IF NOT EXISTS idx_friends_user2 ON friends(user_id2);

-- Daily journal entries tied to a user's goals/habits
CREATE TABLE IF NOT EXISTS journal_entries (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id     BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL,
  reflection  TEXT,
  completion_level TEXT NOT NULL DEFAULT 'missed' CHECK (completion_level IN ('missed','partial','complete')),
  xp_delta    INTEGER NOT NULL DEFAULT 0,
  numeric_value DOUBLE PRECISION,
  numeric_unit  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_goal_id ON journal_entries(goal_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON journal_entries(entry_date);

-- Daily health metrics synced from HealthKit
CREATE TABLE IF NOT EXISTS user_health_metrics (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date      DATE NOT NULL,
  steps            INTEGER NOT NULL DEFAULT 0 CHECK (steps >= 0),
  exercise_minutes INTEGER NOT NULL DEFAULT 0 CHECK (exercise_minutes >= 0),
  sleep_minutes    INTEGER NOT NULL DEFAULT 0 CHECK (sleep_minutes >= 0),
  source           TEXT NOT NULL DEFAULT 'apple_health',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric_date)
);
CREATE INDEX IF NOT EXISTS idx_user_health_metrics_user_date ON user_health_metrics(user_id, metric_date);

-- Keep user level aligned to total XP (sum of goal XP)
CREATE OR REPLACE FUNCTION refresh_user_level(target_user_id BIGINT) RETURNS VOID AS $$
DECLARE
  total_xp INTEGER;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(xp), 0) INTO total_xp
  FROM goals
  WHERE user_id = target_user_id;

  UPDATE users
  SET level = GREATEST(1, (total_xp / 100) + 1)
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_user_level() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_user_level(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_user_level(NEW.user_id);

  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    PERFORM refresh_user_level(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goals_sync_user_level_insert ON goals;
DROP TRIGGER IF EXISTS trg_goals_sync_user_level_update ON goals;
DROP TRIGGER IF EXISTS trg_goals_sync_user_level_delete ON goals;

CREATE TRIGGER trg_goals_sync_user_level_insert
AFTER INSERT ON goals
FOR EACH ROW EXECUTE FUNCTION sync_user_level();

CREATE TRIGGER trg_goals_sync_user_level_update
AFTER UPDATE ON goals
FOR EACH ROW EXECUTE FUNCTION sync_user_level();

CREATE TRIGGER trg_goals_sync_user_level_delete
AFTER DELETE ON goals
FOR EACH ROW EXECUTE FUNCTION sync_user_level();

COMMIT;
