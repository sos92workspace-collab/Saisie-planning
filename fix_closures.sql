-- Nettoyage complet des fermetures globales pour Mai (5) et Juin (6) 2026
DELETE FROM global_closures WHERE year = 2026 AND month IN (5, 6);

-- Insertion des fermetures pour MAI 2026 (month = 5)
INSERT INTO global_closures (col_id, row, month, year) VALUES
-- Colonne 10 (Fermée tout le mois)
(10, NULL, 5, 2026),
-- Colonne 11 (Fermée tout le mois)
(11, NULL, 5, 2026),
-- Colonne 16 (PFG) - Fermée en semaine, ouverte les WE et JF (1, 8, 9, 14)
(16, NULL, 5, 2026),
(16, 1, 5, 2026),
(16, 2, 5, 2026),
(16, 3, 5, 2026),
(16, 8, 5, 2026),
(16, 9, 5, 2026),
(16, 10, 5, 2026),
(16, 14, 5, 2026),
(16, 15, 5, 2026),
(16, 16, 5, 2026),
(16, 17, 5, 2026),
(16, 22, 5, 2026),
(16, 23, 5, 2026),
(16, 24, 5, 2026),
(16, 29, 5, 2026),
(16, 30, 5, 2026),
(16, 31, 5, 2026),
-- Colonne 21 (1N) - Fermée tout le mois
(21, NULL, 5, 2026),
-- Colonne 26 (6S) - Fermée tout le mois
(26, NULL, 5, 2026),
-- Colonne 31 (PFG) - Fermée en semaine, ouverte les WE et JF (1, 8, 9, 14)
(31, NULL, 5, 2026),
(31, 1, 5, 2026),
(31, 2, 5, 2026),
(31, 3, 5, 2026),
(31, 8, 5, 2026),
(31, 9, 5, 2026),
(31, 10, 5, 2026),
(31, 14, 5, 2026),
(31, 15, 5, 2026),
(31, 16, 5, 2026),
(31, 17, 5, 2026),
(31, 22, 5, 2026),
(31, 23, 5, 2026),
(31, 24, 5, 2026),
(31, 29, 5, 2026),
(31, 30, 5, 2026),
(31, 31, 5, 2026),
-- Colonne 35 (17-23h) - Fermée tout le mois
(35, NULL, 5, 2026),
-- Colonne 37 (1N) - Fermée tout le mois
(37, NULL, 5, 2026),
-- Colonne 47 (47) - Fermée tout le mois
(47, NULL, 5, 2026);


-- Insertion des fermetures pour JUIN 2026 (month = 6)
INSERT INTO global_closures (col_id, row, month, year) VALUES
-- Colonne 10 (Fermée tout le mois)
(10, NULL, 6, 2026),
-- Colonne 11 (Fermée tout le mois)
(11, NULL, 6, 2026),
-- Colonne 16 (PFG) - Fermée en semaine, ouverte les WE
(16, NULL, 6, 2026),
(16, 6, 6, 2026),
(16, 7, 6, 2026),
(16, 13, 6, 2026),
(16, 14, 6, 2026),
(16, 20, 6, 2026),
(16, 21, 6, 2026),
(16, 27, 6, 2026),
(16, 28, 6, 2026),
-- Colonne 21 (1N) - Fermée tout le mois
(21, NULL, 6, 2026),
-- Colonne 26 (6S) - Fermée tout le mois
(26, NULL, 6, 2026),
-- Colonne 31 (PFG) - Fermée en semaine, ouverte les WE
(31, NULL, 6, 2026),
(31, 6, 6, 2026),
(31, 7, 6, 2026),
(31, 13, 6, 2026),
(31, 14, 6, 2026),
(31, 20, 6, 2026),
(31, 21, 6, 2026),
(31, 27, 6, 2026),
(31, 28, 6, 2026),
-- Colonne 35 (17-23h) - Fermée tout le mois
(35, NULL, 6, 2026),
-- Colonne 37 (1N) - Fermée tout le mois
(37, NULL, 6, 2026),
-- Colonne 47 (47) - Fermée tout le mois
(47, NULL, 6, 2026);
