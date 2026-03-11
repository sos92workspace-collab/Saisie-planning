-- SQL script to add head doctor and head substitute trigrams to shift_global_settings
ALTER TABLE shift_global_settings ADD COLUMN head_doctor_trigram TEXT;
ALTER TABLE shift_global_settings ADD COLUMN head_substitute_trigram TEXT;

-- Optional: Add foreign key constraints if you want to ensure they exist in the users table
-- ALTER TABLE shift_global_settings ADD CONSTRAINT fk_head_doctor FOREIGN KEY (head_doctor_trigram) REFERENCES users(trigram);
-- ALTER TABLE shift_global_settings ADD CONSTRAINT fk_head_substitute FOREIGN KEY (head_substitute_trigram) REFERENCES users(trigram);
