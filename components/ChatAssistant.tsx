import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Choice, AppStep, ColumnConfig, ColumnDefinition, ChoiceCategory } from '../types';
import { Settings, Bot, Check } from 'lucide-react';
import { getDoctorBehaviorContext } from '../src/data/doctorBehaviors';
import { GLOBAL_ALLOCATION_RULES } from '../src/data/allocationRules';
import { isPublicHoliday } from '../constants';

interface Props {
  supabase?: any;
  trigram: string;
  currentRoundId: string | null;
  activeRoundTitle?: string;
  columns?: ColumnDefinition[];
  month?: number;
  year?: number;
  days?: any;
  activePriority?: number;
  monthLabel?: string;
  currentStep?: AppStep;
  columnConfigs?: ColumnConfig[];
  choices?: Choice[];
  currentCategory?: ChoiceCategory;
  onAddChoices: (suggestions: any[]) => void;
  onRequestProfileEdit?: () => void;
  doctorProfile?: string;
  activeRound?: any;
  globalClosures?: any[];
  isBlockedByUnavailability?: (row: number, colId: number, month: number, year: number) => boolean;
  isColOpen?: (colId: number, step: AppStep, day: number, month: number, year: number) => boolean;
}

type Step = 'INIT' | 'Q_EQUATION' | 'Q_NBCYCLES' | 'Q_ALTERNATIVES' | 'Q_TYPE_PRIORITY' | 'Q_PREF_RANKING' | 'PROPOSE' | 'DONE';

const getTopColsPerCategory = (profile: string, availTxt: string, preferredType?: string) => {
    let filterType = '';
    if (preferredType?.includes('(V)')) filterType = 'V';
    else if (preferredType?.includes('(C)')) filterType = 'C';
    else if (preferredType?.includes('(TC)')) filterType = 'TC';

    // 1. parse profile
    // Array to hold matched items so we can sort them and keep type/context info
    const parsedData: { colId: string, type: string, ctx: string, val: number }[] = [];
    const regex = /(\d+):([A-Z]+):(S|WE):([\d,]+)/g;
    let match;
    while ((match = regex.exec(profile)) !== null) {
        parsedData.push({
            colId: match[1],
            type: match[2],
            ctx: match[3],
            val: parseFloat(match[4].replace(',', '.'))
        });
    }

    // 2. parse available slots to { category: Set<colId> }
    const catMap: Record<string, Set<string>> = {
        'normal': new Set(),
        'good_bonus': new Set(),
        'bad_bonus': new Set()
    };
    
    const lines = availTxt.split('\n');
    for (const line of lines) {
        const colMatch = line.match(/Col\s+(\d+)/);
        if (colMatch) {
            const colId = colMatch[1];
            if (line.includes('normal')) catMap.normal.add(colId);
            if (line.includes('good_bonus')) catMap.good_bonus.add(colId);
            if (line.includes('bad_bonus')) catMap.bad_bonus.add(colId);
        }
    }
    
    const topByCategory: Record<string, {id: string, label: string}[]> = {};
    for (const cat of ['normal', 'good_bonus', 'bad_bonus']) {
        const availCols = Array.from(catMap[cat]);
        
        let validScores = parsedData.filter(d => availCols.includes(d.colId) && d.val > 0);
        
        // Filter by preferred type if specified
        if (filterType) {
            const exactTypeScores = validScores.filter(d => d.type === filterType);
            if (exactTypeScores.length > 0) {
                validScores = exactTypeScores;
            }
        }
        
        // Sort descending by value
        validScores.sort((a,b) => b.val - a.val);
        
        // Deduplicate the same item label (e.g. Col 46 (S))
        const uniqueItems: {id: string, label: string}[] = [];
        const seen = new Set<string>();
        for (const item of validScores) {
            const ctxLabel = item.ctx === 'S' ? 'Semaine' : 'Week-end';
            const typeLabel = item.type === 'V' ? 'Visite' : item.type === 'C' ? 'Consultation' : 'Téléconsultation';
            const labelStr = `Col ${item.colId} (${typeLabel}, ${ctxLabel})`;
            const key = item.colId + '_' + item.ctx;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueItems.push({ id: key, label: labelStr });
            }
        }
        
        topByCategory[cat] = uniqueItems;
    }
    
    return topByCategory;
};

interface Message {
    role: 'user' | 'model';
    text: string;
    quickReplies?: string[];
    proposal?: any[];
    rankingOptions?: { id: string, label: string }[];
}

const InteractiveRanking: React.FC<{ options: {id: string, label: string}[], columnConfigs: any[], onSubmit: (result: string) => void }> = ({ options, columnConfigs, onSubmit }) => {
    const [selections, setSelections] = useState<{id: string, label: string}[]>([]);
    const [showAll, setShowAll] = useState(false);

    const toggleSelection = (opt: {id: string, label: string}) => {
        if (selections.find(s => s.id === opt.id)) {
            setSelections(selections.filter(s => s.id !== opt.id));
        } else {
            setSelections([...selections, opt]);
        }
    };

    const handleSubmit = () => {
        if (selections.length === 0) {
            onSubmit('Peu importe au mieux');
        } else {
            onSubmit(selections.map((s, i) => `${i + 1}.${s.label}`).join(' > '));
        }
    };

    const displayedOptions = showAll ? options : options.slice(0, 5);

    return (
        <div className="flex flex-col gap-2 mt-3 w-full bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Classez par ordre :</h4>
            <div className="flex flex-col gap-2">
                {displayedOptions.map((opt) => {
                    const idx = selections.findIndex(s => s.id === opt.id);
                    const isSelected = idx !== -1;
                    
                    const match = opt.label.match(/Col (\d+)/);
                    let titleAdd = '';
                    if (match && columnConfigs) {
                        const colCfg = columnConfigs.find(c => c.column_id === parseInt(match[1], 10));
                        if (colCfg) {
                            titleAdd = ` - ${colCfg.custom_label} (${colCfg.custom_type})`;
                        }
                    }

                    return (
                        <button 
                            key={opt.id}
                            onClick={() => toggleSelection(opt)}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${isSelected ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                        >
                            <div 
                                className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full border-2 ${isSelected ? 'border-indigo-600 font-black' : 'border-slate-200 font-medium'}`}
                                style={{
                                    backgroundColor: isSelected ? '#4f46e5' : '#f8fafc',
                                    color: isSelected ? '#ffffff' : '#94a3b8'
                                }}
                            >
                                {isSelected ? (idx + 1) : '-'}
                            </div>
                            <span className={isSelected ? 'font-bold' : ''}>{opt.label.replace(')', `)${titleAdd}`)}</span>
                        </button>
                    )
                })}
            </div>

            {!showAll && options.length > 5 && (
                <button 
                    onClick={() => setShowAll(true)}
                    className="mt-2 text-[10px] text-indigo-600 font-bold uppercase tracking-wider hover:underline"
                >
                    Voir toutes les colonnes habituelles ({options.length})
                </button>
            )}

            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                <button 
                    onClick={handleSubmit}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 rounded-lg transition-colors"
                >
                    {selections.length > 0 ? "Valider le classement" : "Passer (Peu importe)"}
                </button>
            </div>
        </div>
    );
};

export const ChatAssistant: React.FC<Props> = ({ 
  supabase, trigram, currentRoundId, activeRoundTitle = 'TOUR ACTIF', 
  columns, month, year, days, activePriority, monthLabel, currentStep, 
  columnConfigs, choices, currentCategory, onAddChoices, 
  onRequestProfileEdit, doctorProfile, activeRound, globalClosures,
  isBlockedByUnavailability, isColOpen
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [predictiveProfileData, setPredictiveProfileData] = useState<string>('');

  useEffect(() => {
      const fetchProfile = async () => {
          if (!supabase || !trigram) return;
          try {
              const { data, error } = await supabase.from('predictibilites_ia_choix_medecin')
                  .select('score_predictibilite, repos_moyen_heures, repartition_colonnes')
                  .eq('trigramme', trigram.toUpperCase())
                  .single();
              if (data) {
                  let profileText = `Profil prédictif pour ${trigram.toUpperCase()} :\n`;
                  profileText += `Score de prédictibilité: ${data.score_predictibilite}\n`;
                  profileText += `Repos moyen entre deux gardes: ${data.repos_moyen_heures}h\n`;
                  profileText += `Répartition probabiliste des colonnes :\n${data.repartition_colonnes}\n`;
                  setPredictiveProfileData(profileText);
              }
          } catch(e) {
              console.error("Failed to fetch predictive profile", e);
          }
      };
      fetchProfile();
  }, [supabase, trigram]);
  
  const [step, setStep] = useState<Step>('INIT');
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposalsHistory, setProposalsHistory] = useState<string[]>([]);
  
  const [targetVolume, setTargetVolume] = useState<string>('');
  const [selectedEquation, setSelectedEquation] = useState<string>('');
  const [numCycles, setNumCycles] = useState<number>(1);
  const [numAlternatives, setNumAlternatives] = useState<number>(0);
  const [preferredType, setPreferredType] = useState<string>('Peu importe');
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [userRankings, setUserRankings] = useState<Record<string, string>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (isOpen && messages.length === 0 && step === 'INIT') {
         // Auto start logic if opened empty
     }
  }, [isOpen]);

  useEffect(() => {
      const handleTrigger = () => {
          setIsOpen(true);
          setStep('Q_EQUATION');
          
          let eqOptions: string[] = [];
          const t = activeRound?.title?.toUpperCase() || '';
          if (t.includes('NUIT')) {
              eqOptions = ["1 GC (44/45) + 2 B + 1 N", "1 GC (44/45) + 1 B + 2 N", "1 GC (44/45) + 3 N", "1 GC (46) + 1 B", "1 GC (46) + 1 N"];
          } else if (t.includes('SAMEDI')) {
              eqOptions = ["1 GC + 1 B + 1 N", "1 GC + 2 N"];
          } else if (t.includes('VISITE')) {
              eqOptions = ["2 GC + 1 B"];
          } else if (t.includes('SUPP')) {
              eqOptions = ["2 GC + 2 B (Avec Visite)", "0 GC + 1 B (Sans Visite)"];
          } else if (t.includes('REMPLAÇANT') || t.includes('REMPLACANT')) {
              eqOptions = ["1 GC + 2 B"];
          } else if (t.includes('BONUS')) {
              eqOptions = ["1 B"];
          } else {
              eqOptions = ["1 GC + 1 B + 1 N", "2 GC", "1 B"]; // default fallback
          }
          
          setMessages([{
             role: 'model', 
             text: `Bonjour Docteur ! Je vais préparer vos attributions pour le tour **${activeRoundTitle}**.\n\nQuelle équation d'attribution souhaitez-vous viser pour vos blocs de gardes parmi celles de ce tour ?`,
             quickReplies: eqOptions
          }]);
      };
      window.addEventListener('trigger-ai-proposal', handleTrigger);
      return () => window.removeEventListener('trigger-ai-proposal', handleTrigger);
  }, [activeRound]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMessage = (role: 'user'|'model', text: string, quickReplies?: string[], proposal?: any[], rankingOptions?: { id: string, label: string }[]) => {
      setMessages(p => [...p, { role, text, quickReplies, proposal, rankingOptions }]);
  };

  const availableCellsContext = useMemo(() => {
    if (!columns || !columnConfigs || month === undefined || year === undefined) return "Aucune cellule disponible.";
    
    // Convert closures and choices to simple lookups for fast checking
    const closedSet = new Set((globalClosures || [])
        .filter(c => c.month === month && c.year === year)
        .map(c => `${c.row}-${c.col_id}`)
    );
    const assignedSet = new Set((choices || [])
        .filter(c => c.status === 'ASSIGNED' || (c.status === 'PENDING' && c.userTrigram === trigram.toUpperCase()))
        .map(c => `${c.row}-${c.col}`)
    );

    const availableEntries: string[] = [];
    const numDays = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= numDays; day++) {
        for (const col of columns) {
            // Check if occupied or closed globally
            if (closedSet.has(`${day}-${col.id}`) || assignedSet.has(`${day}-${col.id}`)) continue;
            
            // Check availability per doctor limits / unavailabilities
            if (isBlockedByUnavailability && isBlockedByUnavailability(day, col.id, month, year)) continue;

            let authorizedCategories = [];
            
            if (isColOpen) {
                // If isColOpen is passed from parent App.tsx, it knows exactly what targets and configurations are valid for the given day/col/category
                if (isColOpen(col.id, AppStep.NORMAL_SELECTION, day, month, year)) authorizedCategories.push("normal");
                if (isColOpen(col.id, AppStep.GOOD_BONUS_SELECTION, day, month, year)) authorizedCategories.push("good_bonus");
                if (isColOpen(col.id, AppStep.BAD_BONUS_SELECTION, day, month, year)) authorizedCategories.push("bad_bonus");
            } else {
                // Fallback (should not be reached if props are provided)
                const date = new Date(year, month, day);
                const isSunday = date.getDay() === 0;
                const isHoliday = isPublicHoliday(date);
                const isOffDay = isSunday || isHoliday;
                const isWeekend = date.getDay() === 6 || isOffDay;
                const cfg = columnConfigs.find(c => c.column_id === col.id);
                if (!cfg) continue;

                if (isHoliday && cfg.open_normal_d) authorizedCategories.push("normal");
                else if (isSunday && cfg.open_normal_d) authorizedCategories.push("normal");
                else if (isWeekend && cfg.open_normal_s && !isSunday) authorizedCategories.push("normal");
                else if (!isWeekend && cfg.open_normal_w) authorizedCategories.push("normal");
                
                if (isHoliday && cfg.open_good_d) authorizedCategories.push("good_bonus");
                else if (isSunday && cfg.open_good_d) authorizedCategories.push("good_bonus");
                else if (isWeekend && cfg.open_good_s && !isSunday) authorizedCategories.push("good_bonus");
                else if (!isWeekend && cfg.open_good_w) authorizedCategories.push("good_bonus");

                if (isHoliday && cfg.open_bad_d) authorizedCategories.push("bad_bonus");
                else if (isSunday && cfg.open_bad_d) authorizedCategories.push("bad_bonus");
                else if (isWeekend && cfg.open_bad_s && !isSunday) authorizedCategories.push("bad_bonus");
                else if (!isWeekend && cfg.open_bad_w) authorizedCategories.push("bad_bonus");
            }

            if (authorizedCategories.length > 0) {
                availableEntries.push(`- Jour ${day} | Col ${col.id} (${col.label}) | Catégories possibles: [${authorizedCategories.join(', ')}]`);
            }
        }
    }
    return availableEntries.join('\n');
  }, [columns, columnConfigs, globalClosures, choices, month, year, isColOpen, isBlockedByUnavailability]);

  const existingChoicesContext = useMemo(() => {
      const myCurrentPhaseChoices = (choices||[]).filter(c => c.userTrigram === (trigram || '').toUpperCase());
      if (myCurrentPhaseChoices.length === 0) return "Aucun choix posé pour l'instant dans ce tour par ce médecin.";
      return myCurrentPhaseChoices.map(c => `- Jour ${c.row} Col ${c.col} -> Étape ${c.category} (Priorité ${c.groupIndex})`).join('\n');
  }, [choices, trigram]);

  const buildBasePrompt = (equation: string = "", cycles: number = 1, alternatives: number = 0, rankings: Record<string, string> = {}, prefType: string = "") => {
    const calendarCtx = Array.from({length: days || 31}, (_, i) => `Jour ${i+1}`).join(', ');
    const fallbackProfile = getDoctorBehaviorContext(trigram);
    const predictiveProfile = predictiveProfileData || fallbackProfile;
    
    let volumeTargetString = "";
    if (equation) {
        volumeTargetString = `L'utilisateur a choisi l'équation d'attribution : "${equation}".
Il souhaite y participer ${cycles} fois. Tu dois générer la combinaison de gardes (GC, B, N) correspondant à cette équation EXACTEMENT ${cycles} fois. 
RÈGLE D'INCRÉMENTATION DE PRIORITÉ CRUCIALE : Chaque étape (category) possède sa propre incrémentation distincte de priorité. 
C'est-à-dire que tu dois numéroter priority = 1, 2, 3... UNIQUEMENT pour les GC ("normal"), puis TU REPARS À priority = 1, 2, 3... pour les B ("good_bonus"), et tu REPARS À priority = 1, 2, 3... pour les N ("bad_bonus").
Pour CHAQUE choix principal d'une catégorie (chaque 'priority' unique au sein d'une category), tu DOIS générer exactement ${alternatives} ALTERNATIVES de repli pour sécuriser l'attribution. Les alternatives partagent STRICTEMENT le même chiffre de 'priority' au sein de cette catégorie.`;
    }

    let rankingString = "";
    if (rankings && Object.keys(rankings).length > 0) {
        rankingString = "\nPRÉFÉRENCES MANUELLES EXPLICITES DU MÉDECIN POUR CE TOUR :\nLA RÈGLE DE SÉLECTION PROBABILISTE DOIT SOUMETTRE SON CHOIX À CES PRÉFÉRENCES MANUELLES LORSQU'ELLES SONT DÉFINIES :\n";
        if (rankings['normal'] && !rankings['normal'].includes("Peu importe")) rankingString += `- Gardes Cibles (normal) : L'ordre de préférence des colonnes est strictement : ${rankings['normal']}\n`;
        if (rankings['good_bonus'] && !rankings['good_bonus'].includes("Peu importe")) rankingString += `- Bonnes Gardes (good_bonus) : L'ordre de préférence des colonnes est strictement : ${rankings['good_bonus']}\n`;
        if (rankings['bad_bonus'] && !rankings['bad_bonus'].includes("Peu importe")) rankingString += `- Gardes Normales (bad_bonus) : L'ordre de préférence des colonnes est strictement : ${rankings['bad_bonus']}\n`;
    }
    
    const preferredTypeString = prefType && prefType !== 'Peu importe' 
        ? `\n      - **ATTENTION (PRIORITÉ D'ACTIVITÉ REQUISE)** : Le médecin a explicitement demandé de privilégier le format d'activité suivant : **${prefType}**. Tu dois filtrer son historique (V, C, TC) pour trouver en toute première priorité les colonnes de ce type. S'il n'y a plus de dispos dans ce type, tu peux piocher dans ses autres types habituels.`
        : '';
    
    return `
      Tu es le générateur automatisé et probabiliste des attributions de SOS Médecins 92.
      
      BASE DE DONNÉES COMPORTEMENTALES (SCORING PRÉDICTIF ET PROBABILITÉS SEMAINE/WEEK-END) :
      ${predictiveProfile}
      ${rankingString}

      RÈGLE DE SÉLECTION PROBABILISTE (CRITIQUE) :
      Lorsque tu attribues des gardes, analyse le profil comportemental ci-dessus. Le format exact est "colonne:type_de_garde:contexte:ratio_probabilité" (ex: "46:V:S:0,6667" signifie col 46, type Visite (V), contexte Semaine (S), avec un ratio de probabilité).
      - **ORDRE DE PRIORITÉ DÉCROISSANT** : Les données du profil sont DÉJÀ classées par chance décroissante, de la plus forte probabilité (à gauche) à la plus faible (à droite). Les colonnes qui apparaissent en premier dans la liste sont Celles que le médecin veut en priorité ! Tu dois impérativement les privilégier.${preferredTypeString}
      - Respecte EN PRIORITÉ l'ordre de préférence donné par le médecin dans PRÉFÉRENCES MANUELLES (s'il en a donné un) pour choisir parmi ses tops top.
      - S'il n'y a pas de préférence explicite ou pour la suite, cherche à attribuer en choix principal les gardes situées au début de son profil selon leur contexte (S pour semaine, WE pour le week-end et jours fériés).
      - Propose en alternatives les gardes listées plus loin (avec des probabilités plus faibles), pour épuiser les possibilités.
      - **RÈGLE D'OR ABSOLUE : Tu ne dois JAMAIS proposer une garde sur une colonne pour laquelle le ratio est à 0 ou qui n'apparait pas du tout dans l'historique des préférences du médecin. Si la colonne n'est pas dans son historique, elle lui est TOTALEMENT INTERDITE.**
      - Si (et seulement si) AUCUNE cellule de la liste disponible ne correspond à un pourcentage > 0 dans ses habitudes de la catégorie voulue, alors retourne un tableau JSON strictement VIDE \`[]\` et explique lui explicitement que tu n'as trouvé aucune garde disponible correspondant à ses préférences.

      ${volumeTargetString}

      RÈGLES D'ATTRIBUTION GLOBALES ET ÉQUATIONS DE TOURS :
      ${GLOBAL_ALLOCATION_RULES}

      VOICI LA LISTE STRICTE DES SEULES CELLULES DISPONIBLES ET OUVERTES SUR LE PLANNING :
      (Aucune autre cellule n'est disponible. Tu ne dois piocher QUE dans cette liste).
      ${availableCellsContext}

      CALENDRIER DE CE MOIS (Pour associer jour 1-31 aux colonnes) :
      ${calendarCtx}
      
      DÉJÀ PRIS PAR CE MÉDECIN LUI-MÊME :
      ${existingChoicesContext}

      ATTENTION MOTEUR IA :
      1. Sers-toi de la charte d'attribution (GC, B, N) pour proposer des combinaisons de gardes complètes si le médecin en demande. Essaie de satisfaire les équations de tours fournies.
      2. Applique le filtrage comportemental (historique) : Choisis de préférence les gardes (colonnes, créneaux) que le médecin aime historiquement faire.
      3. CRUCIAL : Tu ne dois utiliser STRICTEMENT QUE des cellules (Jour/Colonne) présentes dans la "LISTE STRICTE DES SEULES CELLULES DISPONIBLES" et la category doit être une des "Catégories possibles" indiquées pour cette cellule.
      4. Retourne OBLIGATOIREMENT "category" dans chaque objet de retour JSON (valeurs : "normal" pour GC, "good_bonus" pour B, "bad_bonus" pour N).

      REFUS ACTUELS MOTEUR : ${proposalsHistory.length > 0 ? proposalsHistory.join(' | ') : 'Aucun'}
    `;
  };

  const parseLLMResponse = (text: string) => {
      try {
          let safeText = text.trim();
          const match = text.match(/```json\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/) || text.match(/(\[\s*\{[\s\S]*\}\s*\])/);
          if (match) {
              const suggestions = JSON.parse(match[1]);
              const cleanText = text.replace(/```json[\s\S]*```/, '').replace(/\[\s*\{[\s\S]*\}\s*\]/, '').trim();
              return { suggestions, cleanText };
          }
      } catch(e) { console.error(e); }
      return { suggestions: null, cleanText: text };
  };

  const handleConversation = async (userText: string, updatedMessages: Message[]) => {
      if (step === 'Q_EQUATION') {
          setSelectedEquation(userText);
          setStep('Q_NBCYCLES');
          setIsTyping(true);
          setTimeout(() => {
              addMessage('model', `Très bien pour l'équation : ${userText}.\n\nÀ combien de cycles (tours d'attribution) souhaitez-vous participer avec cette formule ?`, 
              ["1", "2", "3", "4", "5", "8", "10", "15"]);
              setIsTyping(false);
          }, 800);
          return;
      }
      
      if (step === 'Q_NBCYCLES') {
          const cycles = parseInt(userText) || 1;
          setNumCycles(cycles);
          setStep('Q_ALTERNATIVES');
          setIsTyping(true);
          setTimeout(() => {
              addMessage('model', `C'est noté pour ${cycles} participation(s). Je vais multiplier vos choix de l'équation par ${cycles}.\n\nPour finir, à quel point souhaitez-vous sécuriser vos vœux ? (Nombre d'alternatives/vœux de repli proposés par index de priorité)`,
              ["0", "1", "2", "3"]);
              setIsTyping(false);
          }, 800);
          return;
      }

      if (step === 'Q_ALTERNATIVES') {
          let alts = 0;
          if (userText.includes("1")) alts = 1;
          if (userText.includes("2")) alts = 2;
          if (userText.includes("3")) alts = 3;
          setNumAlternatives(alts);
          
          setStep('Q_TYPE_PRIORITY');
          setIsTyping(true);
          setTimeout(() => {
              addMessage('model', `Voulez-vous privilégier un type d'activité en particulier pour ces choix, selon ce qui est disponible ?`,
              ["Peu importe", "Consultation (C)", "Visite (V)", "Téléconsultation (TC)"]);
              setIsTyping(false);
          }, 800);
          return;
      }

      if (step === 'Q_TYPE_PRIORITY') {
          setPreferredType(userText);
          
          let catsToProcess: string[] = [];
          if (selectedEquation.includes('GC')) catsToProcess.push('normal');
          if (selectedEquation.includes('B') && !selectedEquation.includes('1 B')) catsToProcess.push('good_bonus'); 
          if (selectedEquation.includes('B') && selectedEquation.includes('1 B')) catsToProcess.push('good_bonus');
          if (selectedEquation.includes('N')) catsToProcess.push('bad_bonus');
          
          catsToProcess = catsToProcess.filter((v, i, a) => a.indexOf(v) === i); // deduplicate
          
          setPendingCategories(catsToProcess.slice(1));
          setStep('Q_PREF_RANKING');
          handleRankingStep(catsToProcess, {}, numAlternatives, numCycles, selectedEquation, userText);
          return;
      }

      setIsTyping(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const modelVar = 'gemini-3.1-pro-preview';

          const chatHistory = updatedMessages.map(m => `\${m.role === 'user' ? 'MEDECIN' : 'ASSISTANT'}:\n\${m.text}`).join('\n\n');
          const prompt = buildBasePrompt(selectedEquation, numCycles, numAlternatives, userRankings, preferredType) + "\n\nDISCUSSION:\n" + chatHistory + "\n\nINSTRUCTION: Réponds naturellement. Si on te demande de générer une combinaison ou de corriger des gardes, ajoute OBLIGATOIREMENT le JSON de la proposition formaté comme ça : ```json [ { \"day\": X, \"columnId\": Y, \"priority\": Z, \"category\": C } ] ```";

          const response = await ai.models.generateContent({
              model: modelVar,
              contents: prompt,
              config: { temperature: 0.7 } 
          });

          const { suggestions, cleanText } = parseLLMResponse(response.text || "Je n'ai pas pu vous comprendre.");
          
          addMessage(
              'model', 
              cleanText || "Voici", 
              suggestions ? ["✅ Valider et poser la sélection", "🔄 Générer une autre proposition"] : [],
              suggestions || undefined
          );

      } catch (e) {
          console.error("Conversation error", e);
          addMessage('model', "Erreur de connexion avec l'IA. Veuillez réessayer.", ["🔄 Réessayer"]);
      } finally {
          setIsTyping(false);
      }
  };

  const computeLocalProposal = (equation: string, cycles: number, alternatives: number, rankings: Record<string, string>, prefType: string): any[] => {
      let reqGC = 0, reqB = 0, reqN = 0;
      const gcMatch = equation.match(/(\d+)\s*(?:GC|CG)/i); if (gcMatch) reqGC = parseInt(gcMatch[1], 10);
      const bMatch = equation.match(/(\d+)\s*B/i); if (bMatch) reqB = parseInt(bMatch[1], 10);
      const nMatch = equation.match(/(\d+)\s*N/i); if (nMatch) reqN = parseInt(nMatch[1], 10);
      if (equation.toUpperCase() === "1 B") { reqB = 1; }
      
      reqGC *= cycles;
      reqB *= cycles;
      reqN *= cycles;

      const profile = predictiveProfileData || getDoctorBehaviorContext(trigram);
      const colScores: { colId: string, type: string, ctx: string, val: number, rank: number }[] = [];
      const regex = /(\d+):([A-Z]+):(S|WE):([\d,]+)/g;
      let match;
      let rank = 1000;
      while ((match = regex.exec(profile)) !== null) {
          colScores.push({
              colId: match[1],
              type: match[2],
              ctx: match[3],
              val: parseFloat(match[4].replace(',', '.')),
              rank: rank-- 
          });
      }

      const closedSet = new Set((globalClosures || [])
          .filter(c => c.month === month && c.year === year)
          .map(c => `${c.row}-${c.col_id}`)
      );
      const assignedSet = new Set((choices || [])
          .filter(c => c.status === 'ASSIGNED' || (c.status === 'PENDING' && c.userTrigram === trigram.toUpperCase()))
          .map(c => `${c.row}-${c.col}`)
      );

      const availableCells: { day: number, colId: string, ctx: string, cats: string[] }[] = [];
      const numDays = new Date(year || 2026, (month || 0) + 1, 0).getDate();

      for (let day = 1; day <= numDays; day++) {
           const date = new Date(year || 2026, month || 0, day);
           const isSun = date.getDay() === 0;
           const isHol = isPublicHoliday(date);
           const cellCtx = (date.getDay() === 6 || isSun || isHol) ? 'WE' : 'S';

          for (const col of (columns || [])) {
              if (closedSet.has(`${day}-${col.id}`) || assignedSet.has(`${day}-${col.id}`)) continue;
              if (isBlockedByUnavailability && isBlockedByUnavailability(day, col.id, month!, year!)) continue;

              let authorizedCategories: string[] = [];
              if (isColOpen) {
                  const numColId = parseInt(col.id.toString(), 10);
                  if (isColOpen(numColId, AppStep.NORMAL_SELECTION, day, month!, year!)) authorizedCategories.push("normal");
                  if (isColOpen(numColId, AppStep.GOOD_BONUS_SELECTION, day, month!, year!)) authorizedCategories.push("good_bonus");
                  if (isColOpen(numColId, AppStep.BAD_BONUS_SELECTION, day, month!, year!)) authorizedCategories.push("bad_bonus");
              } else {
                  // Fallback to strict configs
                  const isWeekend = date.getDay() === 6 || isSun || isHol;
                  const cfg = columnConfigs?.find(c => c.column_id === col.id);
                  if (!cfg) continue;

                  if ((isHol || isSun) && cfg.open_normal_d) authorizedCategories.push("normal");
                  else if (isWeekend && cfg.open_normal_s && !isSun && !isHol) authorizedCategories.push("normal");
                  else if (!isWeekend && cfg.open_normal_w) authorizedCategories.push("normal");
                  
                  if ((isHol || isSun) && cfg.open_good_d) authorizedCategories.push("good_bonus");
                  else if (isWeekend && cfg.open_good_s && !isSun && !isHol) authorizedCategories.push("good_bonus");
                  else if (!isWeekend && cfg.open_good_w) authorizedCategories.push("good_bonus");

                  if ((isHol || isSun) && cfg.open_bad_d) authorizedCategories.push("bad_bonus");
                  else if (isWeekend && cfg.open_bad_s && !isSun && !isHol) authorizedCategories.push("bad_bonus");
                  else if (!isWeekend && cfg.open_bad_w) authorizedCategories.push("bad_bonus");
              }
              if (authorizedCategories.length > 0) {
                  availableCells.push({ day, colId: col.id.toString(), ctx: cellCtx, cats: authorizedCategories });
              }
          }
      }

      const parsePrefType = (pt: string) => {
           if (pt.includes('(V)')) return 'V';
           if (pt.includes('(C)')) return 'C';
           if (pt.includes('(TC)')) return 'TC';
           return '';
      };
      const prefTypeFilter = parsePrefType(prefType);

      const getCellScore = (cell: typeof availableCells[0], cat: string) => {
          if (!cell.cats.includes(cat)) return -1;
          
          const rankingStr = rankings[cat] || '';
          let manualRankScore = 0;
          if (rankingStr) {
              const parts = rankingStr.split('>');
              for (let i = 0; i < parts.length; i++) {
                  const p = parts[i];
                  const colMatch = p.match(/Col (\d+)/);
                  if (colMatch && colMatch[1] === cell.colId) {
                      const isWeRank = p.toLowerCase().includes('week-end');
                      const isSemRank = p.toLowerCase().includes('semaine');
                      if (isWeRank && cell.ctx === 'WE') { manualRankScore = 50000 - i; break; }
                      if (isSemRank && cell.ctx === 'S') { manualRankScore = 50000 - i; break; }
                      if (!isWeRank && !isSemRank) { manualRankScore = 50000 - i; break; }
                  }
              }
          }
          if (manualRankScore > 0) return manualRankScore;

          const profileMatch = colScores.find(cs => cs.colId === cell.colId && cs.ctx === cell.ctx);
          
          if (!profileMatch || profileMatch.val <= 0) return -1;

          let baseScore = profileMatch.rank; 
          
          if (prefTypeFilter) {
              const matchesProfileType = profileMatch.type === prefTypeFilter;
              
              // If not in profile, try to infer from columnConfigs to still apply prefType filter
              let matchesConfigType = false;
              if (columnConfigs) {
                  const cfg = columnConfigs.find(c => c.column_id.toString() === cell.colId);
                  if (cfg && cfg.custom_type) {
                      const t = cfg.custom_type.toLowerCase();
                      if (prefTypeFilter === 'V' && t.includes('visite')) matchesConfigType = true;
                      else if (prefTypeFilter === 'TC' && t.includes('télé')) matchesConfigType = true;
                      else if (prefTypeFilter === 'C' && t.includes('consultation') && !t.includes('télé')) matchesConfigType = true;
                  }
              }

              if (matchesProfileType || matchesConfigType) {
                  baseScore += 10000; 
              }
          }

          return baseScore;
      };

      // We need to peek at max available blocks to respect the equation's ratio if we run out of cells
      // Determine strictly eligible cells
      const eligibleCellsCat = { normal: 0, good_bonus: 0, bad_bonus: 0 };
      for (const cell of availableCells) {
          for (const cat of cell.cats) {
               if (getCellScore(cell, cat) > -1) {
                   eligibleCellsCat[cat as keyof typeof eligibleCellsCat]++;
               }
          }
      }

      const maxBlocksPerCat = { normal: 0, good_bonus: 0, bad_bonus: 0 };
      for (const cat of ['normal', 'good_bonus', 'bad_bonus']) {
          // each priority choice requires (1 + alternatives) cells
          maxBlocksPerCat[cat as keyof typeof maxBlocksPerCat] = Math.floor(eligibleCellsCat[cat as keyof typeof eligibleCellsCat] / (1 + alternatives));
      }

      // Calculate the maximum complete cycles we can actually achieve
      let maxPossibleCycles = cycles;
      if (reqGC > 0 && maxBlocksPerCat.normal < reqGC) {
          const possibleCycles = Math.floor(maxBlocksPerCat.normal / (reqGC / cycles));
          if (possibleCycles < maxPossibleCycles) maxPossibleCycles = possibleCycles;
      }
      if (reqB > 0 && maxBlocksPerCat.good_bonus < reqB) {
          const possibleCycles = Math.floor(maxBlocksPerCat.good_bonus / (reqB / cycles));
          if (possibleCycles < maxPossibleCycles) maxPossibleCycles = possibleCycles;
      }
      if (reqN > 0 && maxBlocksPerCat.bad_bonus < reqN) {
          const possibleCycles = Math.floor(maxBlocksPerCat.bad_bonus / (reqN / cycles));
          if (possibleCycles < maxPossibleCycles) maxPossibleCycles = possibleCycles;
      }

      // We enforce at least 1 cycle if there's any room, or scale down safely 
      // Actually, to make sure the ratio is NEVER inverted, we scale reqGC, reqB, reqN to maxPossibleCycles
      // UNLESS maxPossibleCycles is 0, in which case we do what we can, but we cap to preserve ratio.
      
      let finalReqGC = reqGC;
      let finalReqB = reqB;
      let finalReqN = reqN;

      if (maxPossibleCycles >= 1 && maxPossibleCycles < cycles) {
          // cleanly scale down
          finalReqGC = (reqGC / cycles) * maxPossibleCycles;
          finalReqB = (reqB / cycles) * maxPossibleCycles;
          finalReqN = (reqN / cycles) * maxPossibleCycles;
      } else if (maxPossibleCycles === 0) {
          // Extremely constrained. Cap to available blocks but preserve the ratio mathematically if possible.
          // Simplest is to let it run but clamped to the equation's base ratios.
          // E.g. if equation is 2 GC + 1 B, and we only have 1 GC and 5 B. We must NOT generate 1 GC and 5 B.
          // The base ratio is reqGC/cycles. If we don't even have 1 full cycle, we should perhaps drop to 0 
          // or just clamp to whatever the base fractions are. We will cap them to the base equation values.
          finalReqGC = Math.min(reqGC, maxBlocksPerCat.normal);
          finalReqB = Math.min(reqB, maxBlocksPerCat.good_bonus);
          finalReqN = Math.min(reqN, maxBlocksPerCat.bad_bonus);

          // Force ratio check (e.g. if 2 GC : 1 B, finalReqB cannot exceed finalReqGC / 2)
          if (reqGC > 0 && reqB > 0) {
              const ratio = reqGC / reqB;
              if (finalReqGC / finalReqB < ratio) {
                 finalReqB = Math.floor(finalReqGC / ratio);
              } else if (finalReqGC / finalReqB > ratio) {
                 finalReqGC = Math.floor(finalReqB * ratio);
              }
          }
      }

      // Safe guards in case ratio bounding logic results in 0
      if (finalReqGC <= 0 && reqGC > 0 && maxBlocksPerCat.normal > 0) finalReqGC = Math.min(reqGC, maxBlocksPerCat.normal);
      if (finalReqB <= 0 && reqB > 0 && maxBlocksPerCat.good_bonus > 0) finalReqB = Math.min(reqB, maxBlocksPerCat.good_bonus);
      if (finalReqN <= 0 && reqN > 0 && maxBlocksPerCat.bad_bonus > 0) finalReqN = Math.min(reqN, maxBlocksPerCat.bad_bonus);

      const generateForCategory = (cat: 'normal'|'good_bonus'|'bad_bonus', reqAmount: number, usedSet: Set<string>) => {
           const results: any[] = [];
           if (reqAmount === 0) return results;

           const scoredCells = availableCells
              .filter(cell => !usedSet.has(`${cell.day}-${cell.colId}`))
              .map(cell => ({ cell, score: getCellScore(cell, cat) }))
              .filter(x => x.score > -1)
              .sort((a,b) => b.score - a.score);

           const remainingPool = [...scoredCells];
           let priorityCounter = 1;

           for (let i = 0; i < reqAmount; i++) {
               if (remainingPool.length === 0) break;

               // Pick Main Choice (always the highest available score -> Choix 1)
               const primary = remainingPool.shift()!;
               results.push({ day: primary.cell.day, columnId: parseInt(primary.cell.colId), priority: priorityCounter, category: cat });
               usedSet.add(`${primary.cell.day}-${primary.cell.colId}`);
               
               const blockCols = new Set<string>();
               blockCols.add(primary.cell.colId);
               
               // Pick Alternatives (try to find Choix 2, then Choix 3 by picking different columns to offer diversity)
               let altsFound = 0;
               while (altsFound < alternatives && remainingPool.length > 0) {
                   // Find highest scored distinct column to act as Alt
                   let altIdx = remainingPool.findIndex(sc => !blockCols.has(sc.cell.colId));
                   
                   // If no distinct column is found, fallback to the highest remaining cell
                   if (altIdx === -1) altIdx = 0;
                   
                   const alt = remainingPool.splice(altIdx, 1)[0];
                   results.push({ day: alt.cell.day, columnId: parseInt(alt.cell.colId), priority: priorityCounter, category: cat });
                   usedSet.add(`${alt.cell.day}-${alt.cell.colId}`);
                   blockCols.add(alt.cell.colId);
                   altsFound++;
               }
               priorityCounter++;
           }
           return results;
      };

      const usedGlobal = new Set<string>();
      const finalProposal: any[] = [];
      
      const gcProp = generateForCategory('normal', finalReqGC, usedGlobal);
      const bProp = generateForCategory('good_bonus', finalReqB, usedGlobal);
      const nProp = generateForCategory('bad_bonus', finalReqN, usedGlobal);

      finalProposal.push(...gcProp, ...bProp, ...nProp);
      
      // Inject meta variables so the frontend can display a warning if limited
      (finalProposal as any).meta = {
          reqGC,
          reqB,
          reqN,
          genGC: gcProp.length > 0 ? gcProp[gcProp.length - 1].priority : 0,
          genB: bProp.length > 0 ? bProp[bProp.length - 1].priority : 0,
          genN: nProp.length > 0 ? nProp[nProp.length - 1].priority : 0,
      };

      return finalProposal;
  };

  const generateProposal = async (equation: string = selectedEquation, cycles: number = numCycles, alternatives: number = numAlternatives, rankings: Record<string, string> = userRankings, prefType: string = preferredType) => {
      setIsTyping(true);
      try {
          const suggestions = computeLocalProposal(equation, cycles, alternatives, rankings, prefType);
          
          setTimeout(() => {
              if (suggestions && suggestions.length > 0) {
                  const mText = "Voici la proposition optimisée (choix prioritaires et alternatives) générée localement. Cliquez sur le bouton Valider si cela vous convient.";
                  addMessage('model', mText, ["✅ Valider et poser la sélection", "🔄 Générer une autre proposition"], suggestions);
              } else {
                  const mText = "Je n'ai trouvé aucune garde disponible qui correspond à vos préférences historiques pour l'équation demandée.";
                  addMessage('model', mText, ["🔄 Générer une autre proposition"]);
              }
              setIsTyping(false);
          }, 800);

      } catch (e) {
          console.error("Generation error", e);
          addMessage('model', "Erreur de génération. Veuillez réessayer.", ["🔄 Réessayer"]);
          setIsTyping(false);
      }
  };

  const handleRankingStep = (catsToProcess: string[], currentRankings: Record<string, string>, currentAlts: number, cycles: number, equation: string, prefType: string) => {
      setStep('Q_PREF_RANKING'); // ensure we stay in this state until we are done
      if (catsToProcess.length === 0) {
          setStep('PROPOSE');
          setIsTyping(true);
          setTimeout(() => {
              addMessage('model', `Parfait ! Je calcule vos attributions pour : ${cycles}x la formule [${equation}] avec ${currentAlts} alternative(s) par choix. Je m'appuie sur le classement que vous m'avez donné et votre historique...`);
              generateProposal(equation, cycles, currentAlts, currentRankings, prefType);
          }, 800);
          return;
      }
      
      const cat = catsToProcess[0];
      const label = cat === 'normal' ? 'Garde Cible (GC)' : cat === 'good_bonus' ? 'Bonne Garde (B)' : 'Garde Normale/Mauvaise (N)';
      
      const topByCategory = getTopColsPerCategory(predictiveProfileData || getDoctorBehaviorContext(trigram), availableCellsContext, prefType);
      const top3 = topByCategory[cat] || [];
      
      if (top3.length === 0) {
          // Si on n'a trouvé aucune garde pour cette catégorie, on saute à la suivante.
          setTimeout(() => {
              const nextCats = catsToProcess.slice(1);
              setPendingCategories(nextCats);
              handleRankingStep(nextCats, currentRankings, currentAlts, cycles, equation, prefType);
          }, 0);
          return;
      }

      if (top3.length === 1) {
          // S'il n'y en a qu'une, pas besoin de classer. On enregistre en auto et passe à la suivante.
          setTimeout(() => {
              const nextCats = catsToProcess.slice(1);
              setPendingCategories(nextCats);
              const updatedR = {...currentRankings, [cat]: `1.${top3[0].label}`};
              setUserRankings(updatedR);
              handleRankingStep(nextCats, updatedR, currentAlts, cycles, equation, prefType);
          }, 0);
          return;
      }

      addMessage('model', `Pour l'étape **${label}**, voici votre Top des colonnes disponibles et habituelles. Cliquez sur celles qui vous intéressent pour les classer par ordre de priorité :`, undefined, undefined, top3);
  };

  const confirmSuggestions = (suggestions: any[]) => {
      if (onAddChoices) {
         onAddChoices(suggestions);
         addMessage('model', `Sélection validée ! Les choix ont été ajoutés à votre tableau.`, ["➕ Programmer un autre lot"]);
         setStep('DONE');
      }
  };

  const processResponse = (text: string) => {
      const newMessages: Message[] = [...messages, { role: 'user', text }];
      setMessages(newMessages);
      
      if (text === "✅ Valider et poser la sélection") {
          const lastProp = messages.slice().reverse().find(m => m.proposal)?.proposal;
          if (lastProp) confirmSuggestions(lastProp);
          return;
      }
      if (text === "🔄 Générer une autre proposition" || text === "🔄 Réessayer") {
          const lastProp = messages.slice().reverse().find(m => m.proposal)?.proposal;
          if (lastProp) setProposalsHistory(p => [...p, JSON.stringify(lastProp)]);
          generateProposal();
          return;
      }
      if (text === "➕ Programmer un autre lot") {
          const t = new CustomEvent('trigger-ai-proposal');
          window.dispatchEvent(t);
          return;
      }

      // Si le texte ne correspond à aucun quick reply strict, on converse avec l'IA en texte libre.
      // D'abord vérifier si c'est une réponse de Q_PREF_RANKING
      if (step === 'Q_PREF_RANKING') {
          let currentCat = '';
          if (selectedEquation.includes('GC') && !userRankings['normal']) currentCat = 'normal';
          else if (selectedEquation.includes('B') && !userRankings['good_bonus']) currentCat = 'good_bonus';
          else if (selectedEquation.includes('N') && !userRankings['bad_bonus']) currentCat = 'bad_bonus';
          
          if (currentCat) {
              const updatedRankings = { ...userRankings, [currentCat]: text };
              setUserRankings(updatedRankings);
              
              const nextCats = pendingCategories;
              setPendingCategories(nextCats.slice(1));
              handleRankingStep(nextCats, updatedRankings, numAlternatives, numCycles, selectedEquation, preferredType);
          }
          return;
      }

      handleConversation(text, newMessages);
  };

  const handleTextSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const input = form.elements.namedItem('chatInput') as HTMLInputElement;
      if (input.value.trim()) {
          processResponse(input.value.trim());
          input.value = '';
      }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
      {isOpen && (
        <div className="w-80 md:w-[420px] h-[650px] bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
          {/* Header */}
          <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
                  <Bot size={22} className="text-indigo-600" />
              </div>
              <div className="max-w-[150px]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 truncate" title={activeRoundTitle}>IA - {activeRoundTitle}</h3>
                  <button onClick={onRequestProfileEdit} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium underline underline-offset-2 text-left">Modifier profil global</button>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full shrink-0">
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors p-2" title="Fermer l'assistant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>

          {/* Chat Container */}
          <div className="flex-1 flex flex-col overflow-hidden">
             <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col \${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`
                        max-w-[85%] p-4 rounded-3xl text-[13px] font-medium leading-relaxed shadow-sm whitespace-pre-wrap
                        \${m.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-sm' 
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}
                    `}>
                      {m.text}
                    </div>
                    {m.proposal && (
                        <div className="mt-3 w-full bg-white border border-slate-200 p-4 rounded-2xl shadow-sm mr-auto max-w-[85%]">
                            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Proposition générée ({m.proposal.length} gardes)</h4>
                            {(m.proposal as any).meta && ((m.proposal as any).meta.genGC < (m.proposal as any).meta.reqGC || (m.proposal as any).meta.genB < (m.proposal as any).meta.reqB || (m.proposal as any).meta.genN < (m.proposal as any).meta.reqN) && (
                                <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 font-medium leading-relaxed">
                                   ⚠️ <strong>Limite de validité atteinte :</strong> L'algorithme a demandé {((m.proposal as any).meta.reqGC)} GC, {((m.proposal as any).meta.reqB)} B, et {((m.proposal as any).meta.reqN)} N selon vos cycles, mais a du s'arrêter avant car <strong>vous n'avez plus assez de disponibilités correspondantes sur ce mois.</strong>
                                </div>
                            )}
                            <div className="mb-4">
                                {(() => {
                                    const normal = m.proposal.filter((p: any) => p.category === 'normal');
                                    const good = m.proposal.filter((p: any) => p.category === 'good_bonus');
                                    const bad = m.proposal.filter((p: any) => p.category === 'bad_bonus');

                                    const renderCat = (items: any[], title: string, wrapClass: string, dotClass: string, badgeClass: string) => {
                                        if (items.length === 0) return null;
                                        const grouped = items.reduce((acc, it) => {
                                            if (!acc[it.priority]) acc[it.priority] = [];
                                            acc[it.priority].push(it);
                                            return acc;
                                        }, {} as Record<number, any[]>);

                                        return (
                                            <div className={`mb-2 p-2.5 rounded-xl border \${wrapClass}`}>
                                                <h5 className="text-[10px] font-bold uppercase mb-2 text-slate-500">{title}</h5>
                                                {Object.entries(grouped).map(([prio, list]) => (
                                                    <div key={prio} className="mb-2 last:mb-0 space-y-1">
                                                        {(list as any[]).map((p, idx) => {
                                                            const colCfg = columnConfigs?.find(c => c.column_id === p.columnId);
                                                            const colTitle = colCfg ? ` - ${colCfg.custom_label} (${colCfg.custom_type})` : '';
                                                            return (
                                                                <div key={idx} className="text-[11px] text-slate-700 font-medium flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-1.5 h-1.5 rounded-full \${dotClass}`}></div>
                                                                        <span>Jour {p.day}</span>
                                                                    </div>
                                                                    <span className="truncate max-w-[120px]" title={`Col ${p.columnId}${colTitle}`}>
                                                                        Col {p.columnId}{colTitle}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold \${badgeClass}`}>
                                                                        {idx === 0 ? `Prio ${prio}` : `Alt ${idx}`}
                                                                    </span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    };

                                    return (
                                        <div className="flex flex-col gap-1.5">
                                            {renderCat(normal, "Étape 1 (Cibles)", "bg-orange-50/50 border-orange-100", "bg-orange-500", "bg-orange-100 text-orange-700")}
                                            {renderCat(good, "Étape 2 (Bonnes)", "bg-slate-50 border-slate-200", "bg-slate-500", "bg-slate-200 text-slate-700")}
                                            {renderCat(bad, "Étape 3 (Normales)", "bg-emerald-50/50 border-emerald-100", "bg-emerald-500", "bg-emerald-100 text-emerald-700")}
                                        </div>
                                    );
                                })()}
                            </div>
                            <button 
                                onClick={() => confirmSuggestions(m.proposal!)} 
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={16} /> Valider ces choix
                            </button>
                        </div>
                    )}
                    {m.quickReplies && m.quickReplies.length > 0 && (
                       <div className={`flex flex-wrap gap-2 mt-2 w-full \${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         {m.quickReplies.map((qr, qrIdx) => (
                            <button 
                              key={qrIdx}
                              onClick={() => {
                                  if (qr === "✅ Valider et poser la sélection") {
                                      confirmSuggestions(m.proposal!);
                                  } else if (qr === "🔄 Générer une autre proposition") {
                                      generateProposal();
                                  } else {
                                      processResponse(qr);
                                  }
                              }}
                              className={`transition-colors text-xs font-semibold px-3 py-1.5 rounded-2xl border flex items-center gap-1
                                \${qr.includes('Générer') || qr.includes('Autre') ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm' :
                                qr.includes('Valider') ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' :
                                'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm'}`}
                            >
                              {qr}
                            </button>
                         ))}
                       </div>
                    )}
                    {m.rankingOptions && i === messages.length - 1 && (
                         <InteractiveRanking 
                            options={m.rankingOptions}
                            columnConfigs={columnConfigs} 
                            onSubmit={(res) => {
                                processResponse(res);
                            }} 
                         />
                    )}
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex items-center gap-2 max-w-[85%] p-4 bg-white border border-slate-200 rounded-3xl rounded-bl-sm text-slate-500 shadow-sm w-16">
                     <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                     <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                     <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
                <div ref={messagesEndRef} className="h-2" />
             </div>

             <div className="p-3 bg-white border-t border-slate-200 flex flex-col items-center justify-center text-center">
                 <p className="text-[10px] text-slate-400 font-medium italic">Utilisez les boutons ci-dessus pour guider l'assistant.</p>
             </div>
          </div>

        </div>
      )}

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-white hover:bg-slate-50 text-indigo-600 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-105 pointer-events-auto border-2 border-indigo-100 group relative"
      >
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
        </span>
        <Bot size={30} className="group-hover:animate-pulse" />
      </button>
    </div>
  );
};
