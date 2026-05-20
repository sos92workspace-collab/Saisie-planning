CREATE TABLE IF NOT EXISTS abandon_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_trigram TEXT NOT NULL,
    choice_id UUID REFERENCES choices(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE
);
