create table if not exists archived_global_closures (
  id serial PRIMARY KEY,
  original_id int,
  month int,
  year int,
  row int,
  col int,
  reason text,
  archived_at timestamp with time zone default timezone('utc'::text, now())
);
ALTER TABLE archived_global_closures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Archive Closures" ON archived_global_closures;
CREATE POLICY "Public Read Archive Closures" ON archived_global_closures FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Archive Closures" ON archived_global_closures;
CREATE POLICY "Admin All Archive Closures" ON archived_global_closures FOR ALL USING (true);
