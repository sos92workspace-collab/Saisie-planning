-- SCRIPT COMPLET POUR LA FONCTIONNALITÉ D'ÉCHANGE DE GARDE ET SES VERSIONS
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.

-- ATTENTION: Cette ligne supprime la table existante pour retirer la colonne problématique `set_id`.
DROP TABLE IF EXISTS exchange_rules;

-- 1. Table pour stocker les modes globaux par colonne (ex. Global ou Individuel)
CREATE TABLE IF NOT EXISTS exchange_modes (
    col_id INTEGER PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('GLOBAL', 'INDIVIDUAL'))
);

-- 2. Table pour stocker les règles actives spécifiques (ex. Samedi Nuit vers Dimanche Matin)
CREATE TABLE exchange_rules (
    id SERIAL PRIMARY KEY,
    source_col_id INTEGER NOT NULL,
    source_period TEXT NOT NULL,
    target_col_id INTEGER NOT NULL,
    target_period TEXT NOT NULL
);

-- 3. Table pour stocker les VERSIONS (les snapshots) du paramétrage complet (modes + règles)
CREATE TABLE IF NOT EXISTS exchange_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    rules_data JSONB NOT NULL DEFAULT '{"modes": {}, "rules": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Fonction pour garantir qu'une seule version est "Active" à la fois
CREATE OR REPLACE FUNCTION set_single_active_exchange_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE exchange_rule_versions
        SET is_active = false
        WHERE id != NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger appliqué sur la table des versions
DROP TRIGGER IF EXISTS ensure_single_active_exchange_version ON exchange_rule_versions;
CREATE TRIGGER ensure_single_active_exchange_version
BEFORE INSERT OR UPDATE OF is_active ON exchange_rule_versions
FOR EACH ROW
EXECUTE FUNCTION set_single_active_exchange_version();

-- 6. Désactiver RLS (ou créer des politiques permissives) pendant la phase de réglage 
-- (sinon les requêtes de l'application seront bloquées et retourneront des erreurs transparentes)
ALTER TABLE exchange_modes DISABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rule_versions DISABLE ROW LEVEL SECURITY;
