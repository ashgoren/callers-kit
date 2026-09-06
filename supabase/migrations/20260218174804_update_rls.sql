-- Update RLS policies to evaluate auth.uid() once per query (not per row)
-- and add explicit WITH CHECK on user-owned tables.

DROP POLICY "user_access" ON dances;
CREATE POLICY "user_access" ON dances
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY "user_access" ON programs;
CREATE POLICY "user_access" ON programs
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY "user_access" ON choreographers;
CREATE POLICY "user_access" ON choreographers
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY "user_access" ON programs_dances;
CREATE POLICY "user_access" ON programs_dances
  USING (EXISTS (
    SELECT 1 FROM dances
    WHERE dances.id = dance_id
    AND dances.user_id = (select auth.uid())
  ));

DROP POLICY "user_access" ON dances_choreographers;
CREATE POLICY "user_access" ON dances_choreographers
  USING (EXISTS (
    SELECT 1 FROM dances
    WHERE dances.id = dance_id
    AND dances.user_id = (select auth.uid())
  ));
