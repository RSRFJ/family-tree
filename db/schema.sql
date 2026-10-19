CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS family (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surname text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS person (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  legacy_id text UNIQUE,
  display_name text NOT NULL,
  gender text NOT NULL DEFAULT 'unknown',
  generation int,
  birth_year int,
  death_year int,
  birth_place text,
  burial_place text,
  notes text,
  is_living boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_before_death CHECK (death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year)
);
CREATE INDEX IF NOT EXISTS person_family_gen ON person (family_id, generation) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS person_name_trgm ON person USING gin (display_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS parent_child (
  parent_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'father',
  PRIMARY KEY (parent_id, child_id, role),
  CONSTRAINT no_self_parent CHECK (parent_id <> child_id)
);
CREATE INDEX IF NOT EXISTS parent_child_child ON parent_child (child_id);

CREATE OR REPLACE FUNCTION prevent_cycle() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT parent_id FROM parent_child WHERE child_id = NEW.parent_id
      UNION
      SELECT pc.parent_id FROM parent_child pc JOIN ancestors a ON pc.child_id = a.parent_id
    )
    SELECT 1 FROM ancestors WHERE parent_id = NEW.child_id
  ) THEN
    RAISE EXCEPTION 'relationship would create a cycle';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parent_child_no_cycle ON parent_child;
CREATE TRIGGER parent_child_no_cycle
BEFORE INSERT OR UPDATE ON parent_child
FOR EACH ROW EXECUTE FUNCTION prevent_cycle();

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_entity ON audit_log (entity, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS preview_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- 兼容已建库的增量变更
ALTER TABLE person ADD COLUMN IF NOT EXISTS burial_place text;

-- 站点简介（可编辑）
ALTER TABLE family ADD COLUMN IF NOT EXISTS description text;

-- 访问码（可多个）
CREATE TABLE IF NOT EXISTS access_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  label        text,
  is_active    boolean NOT NULL DEFAULT true,
  use_count    int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- 站点印章/Logo 文字
ALTER TABLE family ADD COLUMN IF NOT EXISTS logo_text text;
-- 管理员账号启用状态
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 公告（登录预览后可见）
ALTER TABLE family ADD COLUMN IF NOT EXISTS notice text;

-- 角色收敛为 admin / user
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'admin' WHERE role = 'owner';
UPDATE users SET role = 'user'  WHERE role IN ('editor','viewer');
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user'));
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'admin';
