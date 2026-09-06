SET ROLE postgres;

-- Enable RLS
ALTER TABLE dances ENABLE ROW LEVEL SECURITY;
ALTER TABLE choreographers ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs_dances ENABLE ROW LEVEL SECURITY;
ALTER TABLE dances_choreographers ENABLE ROW LEVEL SECURITY;

DROP POLICY "Allow full public access on choreographers" ON choreographers;
DROP POLICY "Allow full public access on dances" ON dances;
DROP POLICY "Allow full public access on dances_choreographers" ON dances_choreographers;
DROP POLICY "Allow full public access on programs" ON programs;
DROP POLICY "Allow full public access on dancesPrograms" ON programs_dances;

-- Main tables: simple user_id check
CREATE POLICY "user_access" ON dances USING (user_id = auth.uid());
CREATE POLICY "user_access" ON choreographers USING (user_id = auth.uid());
CREATE POLICY "user_access" ON programs USING (user_id = auth.uid());

-- Join tables: check through parent
CREATE POLICY "user_access" ON programs_dances
  USING (EXISTS (
    SELECT 1 FROM dances WHERE dances.id = dance_id AND dances.user_id = auth.uid()
  ));

CREATE POLICY "user_access" ON dances_choreographers
  USING (EXISTS (
    SELECT 1 FROM dances WHERE dances.id = dance_id AND dances.user_id = auth.uid()
  ));