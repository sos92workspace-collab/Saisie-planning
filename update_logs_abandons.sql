-- Script SQL à exécuter dans Supabase (SQL Editor)

-- 1. Création de la table des logs (pour stocker la date de réinitialisation du compteur)
CREATE TABLE IF NOT EXISTS logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_trigram text,
  action text,
  details jsonb
);

-- 2. Ajout de la colonne updated_at à la table abandon_requests (pour filtrer les abandons approuvés après la date de réinitialisation)
ALTER TABLE abandon_requests ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
