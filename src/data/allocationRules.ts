export const GLOBAL_ALLOCATION_RULES = `
1. DÉFINITIONS ET VOCABULAIRE
GC (Garde Cible) : Garde principale obligatoire (souvent prioritaire dans la demande du médecin). Appartient généralement à la catégorie "normal".
B (Bonne Garde) : Garde convoitée / bonus (souvent rémunératrice ou confortable). Appartient à la catégorie "good_bonus".
N (Garde Normale / Mauvaise Garde) : Garde moins convoitée (pénibilité, horaires difficiles). Appartient à la catégorie "bad_bonus".
WE C/TC (Week-end Consultation/Téléconsultation) : Gardes de week-end (Samedis cols 20 et 27 à 34 ; Dimanches/Fériés cols 12 à 20 et 27 à 34). Note : Les colonnes 36 et 43 ne le sont pas.
Visite du soir : Gardes cibles situées sur les colonnes 38 à 45 (à l'exclusion de la 43).

2. RÈGLES GLOBALES (Applicables à tous les algorithmes)
Avant toute attribution, le système doit filtrer les vœux des médecins avec ces 4 vérifications strictes :
Élimination des gardes prises : Un créneau déjà attribué à un autre médecin disparait des disponibilités.
Gestion stricte des alternatives (Indexation) : Si un médecin a formulé plusieurs vœux avec le même niveau de priorité absolue (ex: vœu 1.1, 1.2, 1.3), dès que l'un d'eux est satisfait, les autres vœux de priorité 1 sont supprimés ("Alternative supprimée").
Ré-indexation dynamique : Après chaque enregistrement, les vœux restants en attente doivent re-glisser et être re-numérotés consécutivement (1, 2, 3...) pour boucher les trous des priorités satisfaites.
Pas de chevauchement temporel : Deux gardes dont les horaires se chevauchent ne peuvent être attribuées ensemble.

3. ÉQUATIONS D'ATTRIBUTION PAR TOUR

3.1. TOUR DE NUIT (TOUR_NUIT)
Cibles : Colonnes Premium (44, 45) d'abord, puis Colonne Standard (46).
Branche 1 : Si la Gardes de Nuit PREMIUM (Cols 44 ou 45)
Formule 1 (Complet) : 1 GC (44/45) + 2 B + 1 N
Formule 2 (Complet) : 1 GC (44/45) + 1 B + 2 N
Formule 3 (Complet) : 1 GC (44/45) + 3 N

Branche 2 : Si la Gardes de Nuit STANDARDS (Col 46) (Si échec Branche 1)
Formule 1 (Complet) : 1 GC (46) + 1 B
Formule 2 (Complet) : 1 GC (46) + 1 N

3.2. SAMEDI SOIR (SAMEDI_SOIR)
Cibles : Colonnes 37, 38, 39, 40, 41, 42.
Formule 1 (Complet) : 1 GC + 1 B + 1 N
Formule 2 (Complet) : 1 GC + 2 N

3.3. TOUR DE VISITES (TOUR_VISITES)
Cibles : Les Gardes Cibles (GC) sélectionnées doivent obligatoirement être de type Visite.
Formule 1 (Complet) : 2 GC + 1 B

Règles Spécifiques :
Saturation WE C/TC : Un médecin ne peut recevoir au maximum que 1 WE C/TC durant tout ce tour.
Conditions Colonnes 36 et 43 (Ratio Visite Soir) : Si la Bonne Garde (B) tirée appartient à la col 36 ou 43, l'algorithme ne valide la formule que si parmi les 2 GC attribuées, au moins une est une visite de Soir (col 38 à 45 sauf 43).

3.4. TOUR SUPPLÉMENTAIRE (TOUR_SUPP)
Cibles : Les GC trouvées doivent être de type "Visite". Ce tour comble les vides de manière très flexible.
Branche A : Le médecin réclame au moins 2 GC
Formule 1 (Complet) : 2 GC + 2 B
Contrainte spécifique "Soir Consult" : Le nombre de Bonnes Gardes (B) attribuées sur les cols 37 ou 46 ne peut pas être supérieur au nombre de Visites du Soir (GC) attribuées dans cette même passe.

Branche B : Le médecin n'a aucune GC (Sans visite)
Formule 1 (Complet) : 0 GC + 1 B
Contrainte spécifique "Alternance WE" : L'algorithme ne valide l'octroi d'une Bonne Garde de type WE C/TC que si le précédent tour "Sans visite" du médecin ne lui en avait pas attribuée une. (Règle de 1 tour sur 2 max).

3.5. TOUR REMPLAÇANT (TOUR_REMPLACANT)
Cibles : N'importe quelle Garde Cible (GC), visites ou consultations. (Pensé pour les affectations à l'unité).
Formule 1 (Complet) : 1 GC + 2 B

Règles Spécifiques :
Limitation Consultations : S'il y a 2 Bonnes Gardes (B) de trouvées (Formule 1), il ne peut y avoir qu'au maximum 1 seule Consultation parmi ces 2 Bonnes gardes (Soit 1 Consult + 1 Visite, Soit 2 Visites).
Ratio 36/43 : Si la GC ou l'une des B appartient à la col 36 ou 43, on vérifie que cela n'enfreint pas la règle de couverture du médecin pour les visites du soir.

3.6. TOUR BONUS CHARTE (TOUR_BONUS_CHARTE)
Cibles : Exclusivement des Bonnes Gardes (B).
Formule Unique : 1 B (Maximum par exécution)
Règles Spécifiques :
Définit des plafonds d'attribution selon le nombre total de gardes Week-end que le médecin détient déjà (ex: Si le médecin fait 1 jour de WE => max 1 B autorisée ; S'il a 3 jours WE => max 2 B, etc.). Au dépassement du calcul du quota, la garde n'est pas attribuée.
`;
