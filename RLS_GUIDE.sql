-- GUIDE DE SÉCURISATION RLS (ROW LEVEL SECURITY)
-- =========================================================
-- PROBLÈME ACTUEL :
-- Votre application utilise une authentification "maison" (table users avec trigramme/mot de passe).
-- Supabase RLS (Row Level Security) se base sur l'utilisateur connecté via Supabase Auth (auth.uid()).
-- Actuellement, pour la base de données, tous vos utilisateurs sont "anonymes" (role 'anon').
-- Vous ne pouvez donc pas créer de règles du type "L'utilisateur X ne peut modifier que ses données".

-- SOLUTION RECOMMANDÉE :
-- 1. Migrer vers Supabase Auth : Créez vos utilisateurs dans l'onglet "Authentication" de Supabase.
--    (Email: trigramme@sos92.com, Mot de passe: leur mot de passe actuel).
-- 2. Lier les données : Ajoutez une colonne `user_id` (UUID) dans vos tables `choices` et `users` qui correspond à l'ID Supabase.
-- 3. Mettre à jour le code (App.tsx) pour utiliser `supabase.auth.signInWithPassword`.

-- UNE FOIS CELA FAIT, VOICI LES POLITIQUES RLS À APPLIQUER :
-- (Copiez-collez ce script dans l'éditeur SQL de Supabase)

-- 1. Activer RLS sur toutes les tables sensibles
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE header_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE unavailabilities ENABLE ROW LEVEL SECURITY;

-- 2. Configuration (Lecture Publique, Écriture Admin seulement)
-- On autorise tout le monde à LIRE la configuration pour que l'app fonctionne
CREATE POLICY "Public Read Rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Public Read Columns" ON column_configs FOR SELECT USING (true);
CREATE POLICY "Public Read Headers" ON header_configs FOR SELECT USING (true);
CREATE POLICY "Public Read Shifts" ON shift_definitions FOR SELECT USING (true);
CREATE POLICY "Public Read Settings" ON shift_global_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Closures" ON global_closures FOR SELECT USING (true);

-- Pour l'écriture (Admin), il faut identifier l'admin.
-- Exemple : Si l'admin a l'email 'admin@sos92.com'
-- CREATE POLICY "Admin Write Rounds" ON rounds FOR ALL USING (auth.jwt() ->> 'email' = 'admin@sos92.com');

-- 3. Choix (Choices)
-- Lecture : Tout le monde voit le planning (nécessaire pour voir les gardes prises)
CREATE POLICY "Read All Choices" ON choices FOR SELECT USING (true);

-- Écriture : Un utilisateur ne modifie que SES choix
-- (Suppose que vous avez ajouté une colonne user_id UUID dans choices)
-- CREATE POLICY "Manage Own Choices" ON choices FOR ALL USING (auth.uid() = user_id);

-- 4. Utilisateurs (Users)
-- Lecture : Un utilisateur ne voit que son profil
-- (Suppose que la table users a une colonne id UUID liée à auth.users)
-- CREATE POLICY "Read Own Profile" ON users FOR SELECT USING (auth.uid() = id);

-- SOLUTION ALTERNATIVE (SANS MIGRATION AUTH) - MOINS SÉCURISÉE
-- Si vous ne voulez pas migrer vers Supabase Auth tout de suite, vous pouvez :
-- 1. Créer une fonction "login" sécurisée (voir schema.sql mis à jour)
-- 2. Révoquer l'accès public à la table `users` pour cacher les mots de passe.
-- Mais cela ne protège pas la table `choices` contre les suppressions malveillantes via l'API.
