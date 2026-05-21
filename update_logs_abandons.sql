-- Script SQL à exécuter dans Supabase (SQL Editor)

-- 1. Création de la table des logs (pour stocker la date de réinitialisation du compteur)
CREATE TABLE IF NOT EXISTS logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_trigram text,
  action text,
  details jsonb
);

-- 2. Conserver l'information d'abandon même après la suppression d'une garde
ALTER TABLE abandon_requests DROP CONSTRAINT IF EXISTS abandon_requests_choice_id_fkey;
ALTER TABLE abandon_requests ADD CONSTRAINT abandon_requests_choice_id_fkey FOREIGN KEY (choice_id) REFERENCES choices(id) ON DELETE SET NULL;
ALTER TABLE abandon_requests ADD COLUMN IF NOT EXISTS shift_snapshot jsonb;
ALTER TABLE abandon_requests ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
