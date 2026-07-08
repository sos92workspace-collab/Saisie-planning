ALTER TABLE archived_month_settings ADD COLUMN IF NOT EXISTS auto_validate_movements BOOLEAN DEFAULT FALSE;
