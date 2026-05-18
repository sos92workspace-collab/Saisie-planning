import React, { useState } from 'react';
import { User, Shield, Check, ListChecks, CalendarRange, Clock, Activity, MapPin, SunMoon } from 'lucide-react';

interface Props {
  trigram: string;
  onComplete: (profile: any) => void;
  onCancel: () => void;
}

export const DoctorProfileWizard: React.FC<Props> = ({ trigram, onComplete, onCancel }) => {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<any>({
    rythme: '',
    repos: '',
    enchainer: '',
    typePreference: '',
    momentPreference: '',
    secteurConsults: '',
    zoneVisites: '',
  });

  const steps = [
    {
      title: "Rythme de travail",
      icon: <CalendarRange className="text-blue-500" size={24} />,
      question: "Comment préférez-vous répartir vos gardes dans le mois ?",
      field: 'rythme',
      options: [
        "J'aime condenser mes gardes au maximum (ex: plusieurs à la suite)",
        "Je préfère lisser mes gardes sur l'ensemble du mois",
        "Aucune préférence particulière de rythme"
      ]
    },
    {
      title: "Temps de repos",
      icon: <Clock className="text-indigo-500" size={24} />,
      question: "Quel temps de repos minimum souhaitez-vous entre deux gardes ?",
      field: 'repos',
      options: [
        "Temps de repos court (je peux enchaîner sans problème)",
        "Au moins 12h de repos entre deux gardes",
        "Au moins 24h de repos entre deux gardes"
      ]
    },
    {
      title: "Enchaînement journalier",
      icon: <Activity className="text-emerald-500" size={24} />,
      question: "Êtes-vous prêt(e) à faire plusieurs gardes la même journée (par exemple matinée + soirée) ?",
      field: 'enchainer',
      options: [
        "Oui, sans aucun problème",
        "De manière exceptionnelle seulement",
        "Non, une seule garde par jour maximum"
      ]
    },
    {
      title: "Préférence de Type",
      icon: <ListChecks className="text-amber-500" size={24} />,
      question: "D'une manière générale, quelle est votre affinité avec les différents types de gardes ?",
      field: 'typePreference',
      options: [
        "J'aime tout alterner (Visites, Consults, Téléconsults)",
        "Je privilégie nettement les VISITES",
        "Je privilégie nettement les CONSULTATIONS"
      ]
    },
    {
      title: "Moment de la journée",
      icon: <SunMoon className="text-orange-500" size={24} />,
      question: "Quels sont vos moments de la journée favoris pour travailler ?",
      field: 'momentPreference',
      options: [
        "Matinée (C1, VLT, VOS...)",
        "Après-midi et début de Soirée (C2, C3...)",
        "Tard le Soir et Nuit",
        "Je n'ai pas de préférence d'horaire"
      ]
    },
    {
      title: "Lieu : Consultations",
      icon: <MapPin className="text-rose-500" size={24} />,
      question: "Concernant les CONSULTATIONS, quel site privilégiez-vous en priorité ?",
      field: 'secteurConsults',
      options: [
        "Boulogne uniquement",
        "Courbevoie uniquement",
        "Antony uniquement",
        "Boulogne ou Courbevoie indifféremment",
        "PFG (Pôle de Fièvre/Garde spécifique)",
        "Pas de préférence de site"
      ]
    },
    {
      title: "Secteur : Visites",
      icon: <MapPin className="text-purple-500" size={24} />,
      question: "Concernant les VISITES, quelle zone géographique vous convient le mieux ?",
      field: 'zoneVisites',
      options: [
        "Secteurs Nord/Centre (Colonnes 1N, 2N, 3N)",
        "Secteurs Centre/Sud (Colonnes 4C, 5S, 6S, 7)",
        "Visites de fin de journée (Colonnes 8, 9, 10, 11)",
        "Toute zone métropolitaine (Aucune préférence)"
      ]
    }
  ];

  const handleSelect = (val: string) => {
    const currentStepDef = steps[step];
    setProfile({ ...profile, [currentStepDef.field]: val });
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Validate and complete
      const finalProfile = { ...profile, [currentStepDef.field]: val };
      localStorage.setItem(`doctor_profile_${trigram}`, JSON.stringify(finalProfile));
      onComplete(finalProfile);
    }
  };

  const currentStepDef = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white text-center relative">
           <button onClick={onCancel} className="absolute top-4 right-4 text-blue-200 hover:text-white transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </button>
           <h2 className="text-xl font-black mb-2 flex items-center justify-center gap-2">
             <User size={24} /> Configuration Profil (TES)
           </h2>
           <p className="text-blue-100/90 text-sm">Répondez à ces questions segmentées pour préciser vos critères de planification.</p>
        </div>
        
        <div className="h-1 bg-slate-100 w-full relative">
            <div className="h-full bg-emerald-400 absolute left-0 top-0 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-8">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-2xl shadow-sm border border-slate-100">
                    {currentStepDef.icon}
                </div>
                <div>
                    <h3 className="text-xs text-slate-400 font-bold uppercase tracking-widest">{currentStepDef.title} ({step + 1}/{steps.length})</h3>
                    <p className="text-lg font-bold text-slate-800 leading-tight mt-1">{currentStepDef.question}</p>
                </div>
            </div>

            <div className="space-y-3">
                {currentStepDef.options.map((opt, i) => (
                    <button
                        key={i}
                        onClick={() => handleSelect(opt)}
                        className="w-full text-left p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-slate-700 font-semibold text-sm shadow-sm flex items-center justify-between group"
                    >
                        <span>{opt}</span>
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-indigo-500 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all" />
                        </div>
                    </button>
                ))}
            </div>

            {step > 0 && (
                <button 
                  onClick={() => setStep(step - 1)}
                  className="mt-6 text-sm text-slate-500 font-semibold hover:text-slate-800 transition-colors underline underline-offset-4"
                >
                  Retour à la question précédente
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
