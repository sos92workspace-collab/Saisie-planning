-- 1. Add column to rounds to allow taking shifts
ALTER TABLE rounds
ADD COLUMN allow_takes BOOLEAN NOT NULL DEFAULT false;

-- 2. Create the table for "take" requests
CREATE TABLE take_requests (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES rounds(id) ON DELETE CASCADE,
    requester_trigram TEXT NOT NULL,
    target_row INTEGER NOT NULL,
    target_col INTEGER NOT NULL,
    target_month INTEGER NOT NULL,
    target_year INTEGER NOT NULL,
    target_col_label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
