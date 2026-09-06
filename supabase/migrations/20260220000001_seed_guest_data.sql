-- Seed demo data for a shared guest account.
-- To create additional guest accounts, create a new migration, replacing guest email.

DO $$
DECLARE
  guest_email TEXT := 'guest@example.com';
  guest_uid UUID;

  cid_bob    BIGINT;
  cid_gene   BIGINT;
  cid_chris  BIGINT;

  did_baby_rose        BIGINT;
  did_butter           BIGINT;
  did_youre_among      BIGINT;
  did_heartbeat        BIGINT;
  did_rolling          BIGINT;

  pid_fgc    BIGINT;
  pid_bash   BIGINT;

BEGIN
  -- Get the guest user ID. The account must already exist.
  SELECT id INTO guest_uid FROM auth.users WHERE email = guest_email;
  IF guest_uid IS NULL THEN
    RETURN; -- Guest account not present (e.g. shadow DB during db pull); skip seeding.
  END IF;

  -- Choreographers
  INSERT INTO choreographers (name, user_id) VALUES ('Bob Isaacs',  guest_uid) RETURNING id INTO cid_bob;
  INSERT INTO choreographers (name, user_id) VALUES ('Gene Hubert', guest_uid) RETURNING id INTO cid_gene;
  INSERT INTO choreographers (name, user_id) VALUES ('Chris Page',  guest_uid) RETURNING id INTO cid_chris;

  -- Dances
  INSERT INTO dances (title, difficulty, swing_16, url, user_id)
    VALUES ('Baby Rose', 1, true, 'https://contradb.com/dances/8', guest_uid)
    RETURNING id INTO did_baby_rose;

  INSERT INTO dances (title, difficulty, swing_16, url, user_id)
    VALUES ('Butter', 1, true, 'https://contradb.com/dances/94', guest_uid)
    RETURNING id INTO did_butter;

  INSERT INTO dances (title, difficulty, swing_16, url, user_id)
    VALUES ('You''re Among Friends', 1, false, 'https://contradb.com/dances/2898', guest_uid)
    RETURNING id INTO did_youre_among;

  INSERT INTO dances (title, difficulty, swing_16, url, notes, user_id)
    VALUES ('Heartbeat Contra', 2, true, 'https://contradb.com/dances/159', 'Rich categorizes as easy', guest_uid)
    RETURNING id INTO did_heartbeat;

  INSERT INTO dances (title, difficulty, swing_16, url, user_id)
    VALUES ('Rollin'' & Tumblin''', 2, true, 'https://contradb.com/dances/366', guest_uid)
    RETURNING id INTO did_rolling;

  -- Dance ↔ Choreographer links
  INSERT INTO dances_choreographers (dance_id, choreographer_id) VALUES (did_baby_rose,   cid_bob);
  INSERT INTO dances_choreographers (dance_id, choreographer_id) VALUES (did_butter,       cid_gene);
  INSERT INTO dances_choreographers (dance_id, choreographer_id) VALUES (did_youre_among,  cid_bob);
  INSERT INTO dances_choreographers (dance_id, choreographer_id) VALUES (did_heartbeat,    cid_chris);
  -- Not adding choreographer for Rollin' & Tumblin'

  -- Programs
  INSERT INTO programs (date, location, user_id)
    VALUES ('2024-07-01', 'FGC', guest_uid)
    RETURNING id INTO pid_fgc;

  INSERT INTO programs (date, location, user_id)
    VALUES ('2024-12-31', 'Bash on Vashon', guest_uid)
    RETURNING id INTO pid_bash;

  -- FGC: Baby Rose → Heartbeat Contra → Butter
  INSERT INTO programs_dances (program_id, dance_id, "order") VALUES (pid_fgc, did_baby_rose,  1);
  INSERT INTO programs_dances (program_id, dance_id, "order") VALUES (pid_fgc, did_heartbeat,  2);
  INSERT INTO programs_dances (program_id, dance_id, "order") VALUES (pid_fgc, did_butter,     3);

  -- Bash on Vashon: You're Among Friends → Rollin' & Tumblin' → Heartbeat Contra
  INSERT INTO programs_dances (program_id, dance_id, "order") VALUES (pid_bash, did_youre_among, 1);
  INSERT INTO programs_dances (program_id, dance_id, "order") VALUES (pid_bash, did_rolling,     2);
  INSERT INTO programs_dances (program_id, dance_id, "order") VALUES (pid_bash, did_heartbeat,   3);

END $$;