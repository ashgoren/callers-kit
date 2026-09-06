-- Deduplicate any existing rows before adding constraints, keeping the lowest id for each pair
DELETE FROM dances_choreographers
WHERE id NOT IN (
  SELECT MIN(id) FROM dances_choreographers GROUP BY dance_id, choreographer_id
);
ALTER TABLE dances_choreographers
  ADD CONSTRAINT dances_choreographers_dance_choreographer_unique UNIQUE (dance_id, choreographer_id);

DELETE FROM dances_key_moves
WHERE id NOT IN (
  SELECT MIN(id) FROM dances_key_moves GROUP BY dance_id, key_move_id
);
ALTER TABLE dances_key_moves
  ADD CONSTRAINT dances_key_moves_dance_key_move_unique UNIQUE (dance_id, key_move_id);

DELETE FROM dances_vibes
WHERE id NOT IN (
  SELECT MIN(id) FROM dances_vibes GROUP BY dance_id, vibe_id
);
ALTER TABLE dances_vibes
  ADD CONSTRAINT dances_vibes_dance_vibe_unique UNIQUE (dance_id, vibe_id);
