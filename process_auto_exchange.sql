-- Copiez-collez ce script dans l'éditeur SQL de votre base de données Supabase.

-- 1. Ajouter la colonne auto_validate_exchanges si elle n'existe pas
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS auto_validate_exchanges BOOLEAN DEFAULT false;

-- 2. Créer ou remplacer la fonction process_auto_exchange
CREATE OR REPLACE FUNCTION process_auto_exchange(
    p_round_id INTEGER,
    p_requester_trigram TEXT,
    p_requester_choice_id UUID,
    p_target_row INTEGER,
    p_target_col INTEGER,
    p_target_month INTEGER,
    p_target_year INTEGER,
    p_target_col_label TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exchange_id UUID;
    v_target_month_db INTEGER;
BEGIN
    v_target_month_db := p_target_month + 1;

    -- Vérifier si la cible est déjà occupée (statut ASSIGNED)
    IF EXISTS (
        SELECT 1 FROM choices 
        WHERE "row" = p_target_row 
          AND col = p_target_col 
          AND "month" = v_target_month_db 
          AND "year" = p_target_year 
          AND status = 'ASSIGNED'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'La case cible est déjà attribuée.');
    END IF;

    -- Créer la demande d'échange directement en statut APPROUVE
    INSERT INTO exchange_requests (
        round_id, 
        requester_trigram, 
        requester_choice_id, 
        target_row, 
        target_col, 
        target_month, 
        target_year, 
        target_col_label, 
        status, 
        created_at, 
        updated_at
    ) VALUES (
        p_round_id, 
        p_requester_trigram, 
        p_requester_choice_id, 
        p_target_row, 
        p_target_col, 
        p_target_month, 
        p_target_year, 
        p_target_col_label, 
        'APPROVED', 
        NOW(), 
        NOW()
    ) RETURNING id INTO v_exchange_id;

    -- Déplacer le choix
    UPDATE choices 
    SET 
        "row" = p_target_row, 
        col = p_target_col, 
        "month" = v_target_month_db, 
        "year" = p_target_year
    WHERE id = p_requester_choice_id;

    -- Rejeter automatiquement les autres demandes en attente pour la même case
    UPDATE exchange_requests
    SET 
        status = 'REJECTED', 
        reason = 'Refusé car attribué via échange automatique à ' || p_requester_trigram,
        updated_at = NOW()
    WHERE status = 'PENDING'
      AND target_row = p_target_row
      AND target_col = p_target_col
      AND target_month = p_target_month
      AND target_year = p_target_year
      AND id != v_exchange_id;

    UPDATE take_requests
    SET 
        status = 'REJECTED', 
        reason = 'Refusé car attribué via échange automatique à ' || p_requester_trigram,
        updated_at = NOW()
    WHERE status = 'PENDING'
      AND target_row = p_target_row
      AND target_col = p_target_col
      AND target_month = p_target_month
      AND target_year = p_target_year;

    RETURN jsonb_build_object('success', true, 'status', 'APPROVED');
END;
$$;
