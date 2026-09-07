-- Convert owner-table and junction-table primary/foreign keys from bigint
-- (Postgres identity/sequence, requires a live connection to assign) to text
-- (client-generated UUID) — enables creating new rows fully offline.
--
-- Existing values are preserved as their string form (e.g. 12345 -> '12345');
-- only the *default-generation strategy* for new rows changes, not any
-- existing data. Not touched: dance_type_id/formation_id/progression_id
-- (stay bigint — they reference the read-only, admin-managed lookup tables
-- dance_types/formations/progressions, which have no offline-creation need).

-- ============================================================
-- 1. Drop constraints that reference the columns being retyped
-- ============================================================

-- Foreign keys
ALTER TABLE dances_choreographers DROP CONSTRAINT dances_choreographers_choreographer_id_fkey;
ALTER TABLE dances_choreographers DROP CONSTRAINT dances_choreographers_dance_id_fkey;
ALTER TABLE programs_dances DROP CONSTRAINT programs_dances_dance_id_fkey;
ALTER TABLE programs_dances DROP CONSTRAINT programs_dances_program_id_fkey;
ALTER TABLE dances_key_moves DROP CONSTRAINT dances_key_moves_dance_id_fkey;
ALTER TABLE dances_key_moves DROP CONSTRAINT dances_key_moves_key_move_id_fkey;
ALTER TABLE dances_vibes DROP CONSTRAINT dances_vibes_dance_id_fkey;
ALTER TABLE dances_vibes DROP CONSTRAINT dances_vibes_vibe_id_fkey;
ALTER TABLE dance_videos DROP CONSTRAINT dance_videos_dance_id_fkey;

-- Unique constraints on junction tables (dance_id/*_id pairs)
ALTER TABLE dances_choreographers DROP CONSTRAINT dances_choreographers_dance_choreographer_unique;
ALTER TABLE dances_key_moves DROP CONSTRAINT dances_key_moves_dance_key_move_unique;
ALTER TABLE dances_vibes DROP CONSTRAINT dances_vibes_dance_vibe_unique;

-- Primary keys
ALTER TABLE dances DROP CONSTRAINT dances_pkey;
ALTER TABLE programs DROP CONSTRAINT programs_pkey;
ALTER TABLE choreographers DROP CONSTRAINT choreographers_pkey;
ALTER TABLE key_moves DROP CONSTRAINT key_moves_pkey;
ALTER TABLE vibes DROP CONSTRAINT vibes_pkey;
ALTER TABLE dance_videos DROP CONSTRAINT dance_videos_pkey;
ALTER TABLE dances_choreographers DROP CONSTRAINT dances_choreographers_pkey;
ALTER TABLE dances_key_moves DROP CONSTRAINT dances_key_moves_pkey;
ALTER TABLE dances_vibes DROP CONSTRAINT dances_vibes_pkey;
ALTER TABLE programs_dances DROP CONSTRAINT "dancesPrograms_pkey";

-- ============================================================
-- 2. Drop identity (auto-increment) on every id column — required before
--    the type change, since identity only supports integer types
-- ============================================================
ALTER TABLE dances ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE programs ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE choreographers ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE key_moves ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE vibes ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE dance_videos ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE dances_choreographers ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE dances_key_moves ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE dances_vibes ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE programs_dances ALTER COLUMN id DROP IDENTITY IF EXISTS;

-- ============================================================
-- 2b. Drop RLS policies that reference dances.id. All junction-table
--     policies join back to dances.id via an EXISTS check.
-- ============================================================
DROP POLICY "user_access" ON dances_choreographers;
DROP POLICY "user_access" ON dances_key_moves;
DROP POLICY "user_access" ON dances_vibes;
DROP POLICY "user_access" ON programs_dances;

-- ============================================================
-- 3. Change column types bigint -> text, preserving existing values
--    (USING id::text keeps e.g. 12345 as the string '12345')
-- ============================================================

-- Owner tables' own id
ALTER TABLE dances ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE programs ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE choreographers ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE key_moves ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE vibes ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE dance_videos ALTER COLUMN id TYPE text USING id::text;

-- Junction tables' own id
ALTER TABLE dances_choreographers ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE dances_key_moves ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE dances_vibes ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE programs_dances ALTER COLUMN id TYPE text USING id::text;

-- Foreign key columns
ALTER TABLE dances_choreographers ALTER COLUMN dance_id TYPE text USING dance_id::text;
ALTER TABLE dances_choreographers ALTER COLUMN choreographer_id TYPE text USING choreographer_id::text;
ALTER TABLE dances_key_moves ALTER COLUMN dance_id TYPE text USING dance_id::text;
ALTER TABLE dances_key_moves ALTER COLUMN key_move_id TYPE text USING key_move_id::text;
ALTER TABLE dances_vibes ALTER COLUMN dance_id TYPE text USING dance_id::text;
ALTER TABLE dances_vibes ALTER COLUMN vibe_id TYPE text USING vibe_id::text;
ALTER TABLE programs_dances ALTER COLUMN dance_id TYPE text USING dance_id::text;
ALTER TABLE programs_dances ALTER COLUMN program_id TYPE text USING program_id::text;
ALTER TABLE dance_videos ALTER COLUMN dance_id TYPE text USING dance_id::text;

-- ============================================================
-- 4. New rows going forward get a client-shareable random id by default
--    (the app will normally supply its own locally-generated id explicitly;
--    this is a safety net for any direct-SQL insert that omits one)
-- ============================================================
ALTER TABLE dances ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE programs ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE choreographers ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE key_moves ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE vibes ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE dance_videos ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE dances_choreographers ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE dances_key_moves ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE dances_vibes ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE programs_dances ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- ============================================================
-- 5. Recreate primary keys
-- ============================================================
ALTER TABLE dances ADD CONSTRAINT dances_pkey PRIMARY KEY (id);
ALTER TABLE programs ADD CONSTRAINT programs_pkey PRIMARY KEY (id);
ALTER TABLE choreographers ADD CONSTRAINT choreographers_pkey PRIMARY KEY (id);
ALTER TABLE key_moves ADD CONSTRAINT key_moves_pkey PRIMARY KEY (id);
ALTER TABLE vibes ADD CONSTRAINT vibes_pkey PRIMARY KEY (id);
ALTER TABLE dance_videos ADD CONSTRAINT dance_videos_pkey PRIMARY KEY (id);
ALTER TABLE dances_choreographers ADD CONSTRAINT dances_choreographers_pkey PRIMARY KEY (id);
ALTER TABLE dances_key_moves ADD CONSTRAINT dances_key_moves_pkey PRIMARY KEY (id);
ALTER TABLE dances_vibes ADD CONSTRAINT dances_vibes_pkey PRIMARY KEY (id);
ALTER TABLE programs_dances ADD CONSTRAINT "dancesPrograms_pkey" PRIMARY KEY (id);

-- ============================================================
-- 6. Recreate foreign keys (same ON UPDATE/DELETE behavior as before)
-- ============================================================
ALTER TABLE dances_choreographers ADD CONSTRAINT dances_choreographers_choreographer_id_fkey
  FOREIGN KEY (choreographer_id) REFERENCES choreographers(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dances_choreographers ADD CONSTRAINT dances_choreographers_dance_id_fkey
  FOREIGN KEY (dance_id) REFERENCES dances(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE programs_dances ADD CONSTRAINT programs_dances_dance_id_fkey
  FOREIGN KEY (dance_id) REFERENCES dances(id) ON DELETE CASCADE;
ALTER TABLE programs_dances ADD CONSTRAINT programs_dances_program_id_fkey
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;
ALTER TABLE dances_key_moves ADD CONSTRAINT dances_key_moves_dance_id_fkey
  FOREIGN KEY (dance_id) REFERENCES dances(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dances_key_moves ADD CONSTRAINT dances_key_moves_key_move_id_fkey
  FOREIGN KEY (key_move_id) REFERENCES key_moves(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dances_vibes ADD CONSTRAINT dances_vibes_dance_id_fkey
  FOREIGN KEY (dance_id) REFERENCES dances(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dances_vibes ADD CONSTRAINT dances_vibes_vibe_id_fkey
  FOREIGN KEY (vibe_id) REFERENCES vibes(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE dance_videos ADD CONSTRAINT dance_videos_dance_id_fkey
  FOREIGN KEY (dance_id) REFERENCES dances(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ============================================================
-- 7. Recreate unique constraints on junction tables. The dedupe DELETEs are
--    a defensive no-op in the normal case (the constraint was enforcing this
--    right up until step 1 dropped it) — only relevant if a concurrent
--    insert somehow raced the brief window it was missing.
-- ============================================================
DELETE FROM dances_choreographers WHERE id NOT IN (
  SELECT MIN(id) FROM dances_choreographers GROUP BY dance_id, choreographer_id
);
ALTER TABLE dances_choreographers
  ADD CONSTRAINT dances_choreographers_dance_choreographer_unique UNIQUE (dance_id, choreographer_id);

DELETE FROM dances_key_moves WHERE id NOT IN (
  SELECT MIN(id) FROM dances_key_moves GROUP BY dance_id, key_move_id
);
ALTER TABLE dances_key_moves
  ADD CONSTRAINT dances_key_moves_dance_key_move_unique UNIQUE (dance_id, key_move_id);

DELETE FROM dances_vibes WHERE id NOT IN (
  SELECT MIN(id) FROM dances_vibes GROUP BY dance_id, vibe_id
);
ALTER TABLE dances_vibes
  ADD CONSTRAINT dances_vibes_dance_vibe_unique UNIQUE (dance_id, vibe_id);

-- ============================================================
-- 8. Recreate the RLS policies dropped in step 2b (identical to their
--    original definitions — only dances.id's underlying type changed)
-- ============================================================
CREATE POLICY "user_access" ON dances_choreographers
  USING (EXISTS (
    SELECT 1 FROM dances
    WHERE dances.id = dance_id
    AND dances.user_id = (select auth.uid())
  ));

CREATE POLICY "user_access" ON dances_key_moves
  USING (EXISTS (
    SELECT 1 FROM dances
    WHERE dances.id = dance_id
    AND dances.user_id = (select auth.uid())
  ));

CREATE POLICY "user_access" ON dances_vibes
  USING (EXISTS (
    SELECT 1 FROM dances
    WHERE dances.id = dance_id
    AND dances.user_id = (select auth.uid())
  ));

CREATE POLICY "user_access" ON programs_dances
  USING (EXISTS (
    SELECT 1 FROM dances
    WHERE dances.id = dance_id
    AND dances.user_id = (select auth.uid())
  ));
