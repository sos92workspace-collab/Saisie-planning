CREATE TABLE IF NOT EXISTS abandon_penalties (
    id SERIAL PRIMARY KEY,
    delay_category VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'MORE_THAN_48H', 'BETWEEN_6H_AND_48H', 'LESS_THAN_6H'
    penalty_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default values if they don't exist
INSERT INTO abandon_penalties (delay_category, penalty_amount) VALUES
('MORE_THAN_48H', 0),
('BETWEEN_6H_AND_48H', 50),
('LESS_THAN_6H', 100)
ON CONFLICT (delay_category) DO NOTHING;
