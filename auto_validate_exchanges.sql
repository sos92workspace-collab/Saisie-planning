-- Ajoute la configuration pour l'auto-validation dans la table rounds
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS auto_validate_exchanges BOOLEAN DEFAULT false;

-- Fonction sécurisée (RPC) pour exécuter un échange automatiquement et sans conflit
CREATE OR REPLACE FUNCTION process_auto_exchange(
    p_round_id INT,
    p_requester_trigram TEXT,
    p_requester_choice_id INT,
    p_target_row INT,
    p_target_col INT,
    p_target_month INT,
    p_target_year INT,
    p_target_col_label TEXT
) RETURNS JSON AS $$
DECLARE
    v_conflict_count INT;
    v_auto_validate BOOLEAN;
BEGIN
    -- 1. Lire la configuration depuis le round
    SELECT auto_validate_exchanges INTO v_auto_validate FROM rounds WHERE id = p_round_id;

    -- 2. Verrou exclusif temporaire sur la session transactionnelle de choix pour bloquer 
    -- toute exécution simultanée de cette même fonction
    PERFORM pg_advisory_xact_lock(
        hashtext('exchange_lock_' || p_round_id || '_' || p_target_row || '_' || p_target_col || '_' || p_target_month || '_' || p_target_year)
    );

    -- 3. Vérifier que la case cible est TOUJOURS vide (Aucun choix ASSIGNED dessus)
    SELECT COUNT(*) INTO v_conflict_count
    FROM choices 
    WHERE round_id = p_round_id 
      AND row = p_target_row 
      AND col = p_target_col 
      AND month = p_target_month 
      AND year = p_target_year 
      AND status = 'ASSIGNED';

    IF v_conflict_count > 0 THEN
        RETURN json_build_object('success', false, 'error', 'Action bloquée: Cette case vient tout juste d''être prise par un autre médecin.');
    END IF;

    -- 4. Exécuter selon le réglage de l'admin
    IF v_auto_validate = TRUE THEN
        -- a. Déplacer la garde de l'utilisateur (mise à jour directe)
        UPDATE choices 
        SET row = p_target_row, 
            col = p_target_col, 
            month = p_target_month, 
            year = p_target_year
        WHERE id = p_requester_choice_id AND status = 'ASSIGNED';

        -- b. Tracer la validation automatique dans les logs d'échange
        INSERT INTO exchange_requests (
            round_id, requester_trigram, requester_choice_id, target_row, target_col, target_month, target_year, target_col_label, status, updated_at
        ) VALUES (
            p_round_id, p_requester_trigram, p_requester_choice_id, p_target_row, p_target_col, p_target_month, p_target_year, p_target_col_label, 'APPROVED', NOW()
        );

        RETURN json_build_object('success', true, 'status', 'APPROVED');
    ELSE
        -- c. Si désactivé, comportement classique (mettre en attente)
        INSERT INTO exchange_requests (
            round_id, requester_trigram, requester_choice_id, target_row, target_col, target_month, target_year, target_col_label, status
        ) VALUES (
            p_round_id, p_requester_trigram, p_requester_choice_id, p_target_row, p_target_col, p_target_month, p_target_year, p_target_col_label, 'PENDING'
        );

        RETURN json_build_object('success', true, 'status', 'PENDING');
    END IF;
END;
$$ LANGUAGE plpgsql;
