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
  level        INTEGER NOT NULL DEFAULT 1,
  streak       INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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

COMMIT;