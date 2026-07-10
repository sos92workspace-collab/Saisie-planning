CREATE TABLE IF NOT EXISTS applied_penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abandon_request_id UUID REFERENCES abandon_requests(id) ON DELETE CASCADE,
    user_trigram TEXT NOT NULL,
    shift_date TIMESTAMP WITH TIME ZONE NOT NULL,
    abandon_date TIMESTAMP WITH TIME ZONE NOT NULL,
    delay_hours NUMERIC NOT NULL,
    penalty_amount NUMERIC NOT NULL,
    penalty_category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE applied_penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for applied_penalties" ON applied_penalties FOR ALL USING (true);
