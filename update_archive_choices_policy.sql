ALTER TABLE archived_choices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Archive Choices" ON archived_choices;
CREATE POLICY "Admin All Archive Choices" ON archived_choices FOR ALL USING (true);
