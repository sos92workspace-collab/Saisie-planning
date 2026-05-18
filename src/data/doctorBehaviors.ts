export interface BehaviorRecord {
  Mois: string;
  Trigramme: string;
  Nb_choix_total: number;
  Part_C: string;
  Part_V: string;
  Part_TC: string;
  Type_dominant: string;
  Part_matin: string;
  Part_PM: string;
  Part_soir: string;
  Part_nuit: string;
  Plage_dominante: string;
  Part_semaine: string;
  Part_weekend_ferie: string;
  Top_colonnes: string;
  Score_predictibilite: string;
}

export const doctorBehaviorsData: BehaviorRecord[] = [
  { Mois: "Avril 2026", Trigramme: "ALX", Nb_choix_total: 8, Part_C: "0,0%", Part_V: "100,0%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "0,0%", Part_PM: "0,0%", Part_soir: "100,0%", Part_nuit: "0,0%", Plage_dominante: "soir", Part_semaine: "75,0%", Part_weekend_ferie: "25,0%", Top_colonnes: "46:0.6250; 37:0.3750", Score_predictibilite: "59,5%" },
  { Mois: "Fevrier 2026", Trigramme: "ALX", Nb_choix_total: 6, Part_C: "0,0%", Part_V: "100,0%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "0,0%", Part_PM: "0,0%", Part_soir: "100,0%", Part_nuit: "0,0%", Plage_dominante: "soir", Part_semaine: "66,7%", Part_weekend_ferie: "33,3%", Top_colonnes: "46:1.0000",  Score_predictibilite: "90,0%" },
  { Mois: "Janvier 2026", Trigramme: "ALX", Nb_choix_total: 11, Part_C: "0,0%", Part_V: "100,0%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "0,0%", Part_PM: "0,0%", Part_soir: "100,0%", Part_nuit: "0,0%", Plage_dominante: "soir", Part_semaine: "63,6%", Part_weekend_ferie: "36,4%", Top_colonnes: "46:0.6364; 41:0.2727; 37:0.0909", Score_predictibilite: "62,6%" },
  { Mois: "Mars 2026", Trigramme: "ALX", Nb_choix_total: 8, Part_C: "0,0%", Part_V: "100,0%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "0,0%", Part_PM: "0,0%", Part_soir: "100,0%", Part_nuit: "0,0%", Plage_dominante: "soir", Part_semaine: "75,0%", Part_weekend_ferie: "25,0%", Top_colonnes: "37:0.5000; 46:0.3750; 38:0.1250", Score_predictibilite: "60,4%" },

  { Mois: "Avril 2026", Trigramme: "BAR", Nb_choix_total: 27, Part_C: "48,2%", Part_V: "51,9%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "63,0%", Part_PM: "37,0%", Part_soir: "37,0%", Part_nuit: "0,0%", Plage_dominante: "PM", Part_semaine: "81,5%", Part_weekend_ferie: "18,5%",  Top_colonnes: "6:0.2593; 32:0.2593; 45:0.1852; 33:0.1111; 44:0.0741", Score_predictibilite: "36,3%" },
  { Mois: "Fevrier 2026", Trigramme: "BAR", Nb_choix_total: 25, Part_C: "40,0%", Part_V: "60,0%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "61,3%", Part_PM: "24,0%", Part_soir: "36,0%", Part_nuit: "0,0%", Plage_dominante: "nuit", Part_semaine: "80,0%", Part_weekend_ferie: "20,0%", Top_colonnes: "45:0.3200; 32:0.3200; 6:0.2000; 44:0.0800; 17:0.0400", Score_predictibilite: "42,3%" },
  
  { Mois: "Avril 2026", Trigramme: "TES", Nb_choix_total: 8, Part_C: "50,0%", Part_V: "50,0%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "50,0%", Part_PM: "0,0%", Part_soir: "50,0%", Part_nuit: "0,0%", Plage_dominante: "matin", Part_semaine: "80,0%", Part_weekend_ferie: "20,0%", Top_colonnes: "1:0.5; 5:0.3; 45:0.2", Score_predictibilite: "80,0%" },
  { Mois: "Mars 2026", Trigramme: "TES", Nb_choix_total: 10, Part_C: "40,0%", Part_V: "60,0%", Part_TC: "0,0%", Type_dominant: "V", Part_matin: "60,0%", Part_PM: "0,0%", Part_soir: "40,0%", Part_nuit: "0,0%", Plage_dominante: "matin", Part_semaine: "90,0%", Part_weekend_ferie: "10,0%", Top_colonnes: "1:0.6; 5:0.2; 44:0.2", Score_predictibilite: "85,0%" },
];

export function getDoctorBehaviorContext(trigram: string): string {
    return "Aucune donnée de prédictibilité trouvée pour ce médecin dans Supabase.";
}
