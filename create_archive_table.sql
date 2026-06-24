
create table if not exists archived_choices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id uuid,
  user_trigram text NOT NULL,
  round_id int NOT NULL,
  row int NOT NULL,
  col int NOT NULL,
  month int NOT NULL,
  year int NOT NULL,
  priority text,
  status text,
  group_index int,
  sub_rank int,
  category text,
  user_role text,
  submitted_at timestamp with time zone,
  admin_comment text,
  col_label text,
  col_type text,
  col_time_range text,
  archived_at timestamp with time zone default timezone('utc'::text, now())
);
ALTER TABLE archived_choices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Archive" ON archived_choices;
CREATE POLICY "Public Read Archive" ON archived_choices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Archive" ON archived_choices;
CREATE POLICY "Admin All Archive" ON archived_choices FOR ALL USING (true);
