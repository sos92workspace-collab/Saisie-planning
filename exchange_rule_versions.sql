-- Script SQL pour configurer les règles d'équivalence (échange de garde) avec système de versions

-- 1. Table pour stocker les versions de paramètres d'échange
CREATE TABLE IF NOT EXISTS exchange_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    rules_data JSONB NOT NULL DEFAULT '{"modes": {}, "rules": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Fonction pour garantir qu'une seule version est active à la fois
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

-- 3. Trigger appliqué sur la table
DROP TRIGGER IF EXISTS ensure_single_active_exchange_version ON exchange_rule_versions;
CREATE TRIGGER ensure_single_active_exchange_version
BEFORE INSERT OR UPDATE OF is_active ON exchange_rule_versions
FOR EACH ROW
EXECUTE FUNCTION set_single_active_exchange_version();

-- 4. Initialisation d'une version par défaut (optionnel, utile pour le premier démarrage)
INSERT INTO exchange_rule_versions (name, is_active, rules_data)
SELECT 'Version Standard (Initiale)', true, '{"modes": {}, "rules": []}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM exchange_rule_versions);
