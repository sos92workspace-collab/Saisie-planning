ALTER TABLE shift_global_settings ADD COLUMN IF NOT EXISTS target_substitute_normal_active boolean default false;
ALTER TABLE shift_global_settings ADD COLUMN IF NOT EXISTS target_substitute_good_active boolean default false;
ALTER TABLE shift_global_settings ADD COLUMN IF NOT EXISTS target_substitute_bad_active boolean default false;
ALTER TABLE shift_global_settings ADD COLUMN IF NOT EXISTS target_doctor_normal_active boolean default false;
ALTER TABLE shift_global_settings ADD COLUMN IF NOT EXISTS target_doctor_good_active boolean default false;
ALTER TABLE shift_global_settings ADD COLUMN IF NOT EXISTS target_doctor_bad_active boolean default false;
