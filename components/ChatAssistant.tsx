
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Choice, AppStep, ColumnConfig, ColumnDefinition, ChoiceCategory } from '../types';

interface Props {
  trigram: string;
  currentRoundId: number;
  columns: ColumnDefinition[];
  days: any[]; 
  activePriority: number;
  monthLabel: string;
  currentStep: AppStep;
  columnConfigs: ColumnConfig[];
  choices: Choice[];
  currentCategory: ChoiceCategory;
  onAddChoices: (newChoices: { day: number; columnId: number; priority: number; month?: number; year?: number }[]) => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export const ChatAssistant: React.FC<Props> = ({ trigram, currentRoundId, columns, days, activePriority, monthLabel, currentStep, columnConfigs, choices, currentCategory, onAddChoices }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; suggestions?: any[] }[]>([
      { role: 'model', text: "Bonjour Docteur. Je suis votre assistant de planification personnel SOS 92. Dites-moi simplement vos contraintes, vos préférences (sites, horaires) et le nombre de gardes souhaité, et je m'occupe du reste. Par quoi commençons-nous ? Vos indisponibilités ?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSend(transcript);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const openColumnsContext = useMemo(() => {
    if (!columns || !columnConfigs) return "";
    return columns.filter(col => {
      const cfg = columnConfigs.find(c => c.column_id === col.id);
      if (!cfg) return true; 

      if (currentStep === AppStep.NORMAL_SELECTION) {
          return cfg.open_normal_w || cfg.open_normal_s || cfg.open_normal_d;
      }
      if (currentStep === AppStep.BAD_BONUS_SELECTION) {
          return cfg.open_bad_w || cfg.open_bad_s || cfg.open_bad_d;
      }
      if (currentStep === AppStep.GOOD_BONUS_SELECTION) {
          return cfg.open_good_w || cfg.open_good_s || cfg.open_good_d;
      }
      return false;
    }).map(c => `ID:${c.id} | ${c.label} | ${c.type} | Site:${c.site} | ${c.timeRange}`).join('\n');
  }, [columns, columnConfigs, currentStep]);

  const phaseName = useMemo(() => {
      if (currentStep === AppStep.NORMAL_SELECTION) return "GARDES CIBLES (Prioritaires)";
      if (currentStep === AppStep.BAD_BONUS_SELECTION) return "GARDES NORMALES (Ex Mauvais Bonus)";
      if (currentStep === AppStep.GOOD_BONUS_SELECTION) return "BONNES GARDES (Ex Bons Bonus)";
      return "CLASSEMENT";
  }, [currentStep]);

  // Récupération des choix DE CETTE PHASE uniquement
  const myCurrentPhaseChoices = useMemo(() => {
      if (!choices) return [];
      return choices.filter(c => c.userTrigram === (trigram || '').toUpperCase() && c.category === currentCategory);
  }, [choices, trigram, currentCategory]);

  const existingChoicesContext = useMemo(() => {
      if (myCurrentPhaseChoices.length === 0) return "Aucun choix posé pour l'instant dans cette phase.";
      return myCurrentPhaseChoices.map(c => {
          const suffix = c.subRank > 1 ? `.${String.fromCharCode(96 + c.subRank)}` : ''; 
          return `- Le ${c.row}/${c.month + 1}: Col ${c.col} (${c.colTimeRange}) -> Priorité ${c.groupIndex}${suffix}`;
      }).join('\n');
  }, [myCurrentPhaseChoices]);

  // Calcul de la prochaine priorité logique basée sur ce qui existe DÉJÀ
  const nextLogicalPriority = useMemo(() => {
      if (myCurrentPhaseChoices.length === 0) return 1;
      const maxUsed = Math.max(...myCurrentPhaseChoices.map(c => c.groupIndex));
      return maxUsed + 1;
  }, [myCurrentPhaseChoices]);

  const handleSend = async (text: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, text: messageText }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = 'gemini-3-flash-preview';
      
      const calendarCtx = (days || []).map(d => `J${d.day}: ${d.weekday} ${d.isSunday ? '(DIMANCHE/FERIE)' : ''}`).join(', ');

      const systemInstruction = `
        Tu es le Secrétaire Médical Virtuel intelligent de SOS Médecins 92.
        
        CONTEXTE STRICT DE LA PHASE EN COURS :
        - MOIS : ${monthLabel}
        - PHASE : ${phaseName}
        - CATÉGORIE TECHNIQUE : ${currentCategory}
        
        SITUATION DU MÉDECIN (INDEX ET CHOIX) :
        - Index de priorité "Actif" (sélectionné manuellement) : ${activePriority}
        - Prochaine priorité logique (calculée sur l'historique) : ${nextLogicalPriority}
        - CHOIX DÉJÀ POSÉS DANS CETTE PHASE :
        ${existingChoicesContext}
        
        RÈGLES DE GESTION DES PRIORITÉS (CRITIQUE) :
        1. Si le médecin demande d'ajouter de nouvelles gardes distinctes (pas des alternatives), tu DOIS incrémenter la priorité pour chacune.
           Utilise la valeur ${nextLogicalPriority} comme point de départ si l'utilisateur ne précise pas de priorité spécifique.
           Exemple : S'il veut 2 gardes, propose priorité ${nextLogicalPriority} et ${nextLogicalPriority + 1}.
        2. Si le médecin demande une ALTERNATIVE ("cette garde OU cette garde"), utilise le MÊME numéro de priorité pour les deux. Le système gérera le 'a', 'b'.
        
        RÈGLES D'OR DE PLANIFICATION :
        1. **UNICITÉ HORAIRE** : Interdiction absolue de proposer deux gardes principales (rang 1) qui se chevauchent le même jour. Vérifie les "Choix déjà posés".
        2. **OUVERTURE** : Tu ne dois proposer QUE des colonnes listées dans "INVENTAIRE" ci-dessous. Les autres sont fermées pour cette phase.
        
        INVENTAIRE DES COLONNES OUVERTES :
        ${openColumnsContext}
        
        CALENDRIER :
        ${calendarCtx}

        TON JOB :
        1. Analyse la demande.
        2. Trouve les créneaux libres dans l'inventaire.
        3. Construit le JSON avec les priorités intelligentes (incrémentées si besoin).
        
        FORMAT JSON (Invisible) :
        \`\`\`json
        [
          {"day": 5, "columnId": 12, "priority": ${nextLogicalPriority}}, 
          {"day": 12, "columnId": 35, "priority": ${nextLogicalPriority + 1}}
        ]
        \`\`\`
      `;

      const chatHistory = newMessages.map(m => `${m.role === 'user' ? 'MÉDECIN' : 'ASSISTANT'}: ${m.text}`).join('\n\n');

      const response = await ai.models.generateContent({
        model,
        contents: chatHistory,
        config: { 
            systemInstruction,
            temperature: 0.7,
        }
      });

      const responseText = response.text || "Je n'ai pas compris, pouvez-vous répéter ?";
      
      const jsonMatch = responseText.match(/```json\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/);
      let suggestions = undefined;
      let cleanText = responseText;

      if (jsonMatch) {
        try {
          suggestions = JSON.parse(jsonMatch[1]);
          cleanText = responseText.replace(/```json[\s\S]*```/, '').trim();
          cleanText += "\n\n(Cliquer sur valider pour appliquer ces choix au planning)";
        } catch (e) {
          console.error("Erreur parse JSON IA", e);
        }
      }

      setMessages([...newMessages, { role: 'model', text: cleanText, suggestions }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'model', text: "Désolé, je rencontre une erreur technique." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const confirmSuggestions = (suggestions: any[]) => {
    onAddChoices(suggestions);
    setMessages(prev => [...prev, { role: 'model', text: `C'est noté ! J'ai ajouté ces ${suggestions.length} créneaux à votre tableau.` }]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
      {isOpen && (
        <div className="w-80 md:w-96 h-[600px] bg-white rounded-[32px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <span className="text-xl">🤖</span>
              </div>
              <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-blue-300">Assistant</h3>
                  <p className="text-[10px] text-slate-400 font-medium">SOS Médecins 92</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`
                    max-w-[85%] p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-sm whitespace-pre-wrap
                    ${m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white border text-slate-700 rounded-bl-none'}
                `}>
                  {m.text}
                </div>
                {m.suggestions && (
                  <button 
                    onClick={() => confirmSuggestions(m.suggestions!)} 
                    className="mt-3 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 animate-pulse"
                  >
                    <span>✅</span> Valider {m.suggestions.length} choix
                  </button>
                )}
              </div>
            ))}
            {isTyping && (
                <div className="flex items-center gap-1 ml-2">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t flex gap-3 items-center">
            <button 
                onClick={toggleVoice} 
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all shadow-sm border ${isListening ? 'bg-red-500 text-white border-red-600 animate-pulse shadow-red-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-blue-50 hover:text-blue-500'}`}
                title="Dictée vocale"
            >
              {isListening ? (
                  <div className="flex gap-0.5 items-center h-4">
                      <div className="w-1 h-full bg-white animate-[music-bar_1s_ease-in-out_infinite]"></div>
                      <div className="w-1 h-2/3 bg-white animate-[music-bar_1s_ease-in-out_infinite_0.2s]"></div>
                      <div className="w-1 h-full bg-white animate-[music-bar_1s_ease-in-out_infinite_0.4s]"></div>
                  </div>
              ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              )}
            </button>
            <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Répondez ici..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  onKeyDown={e => e.key === 'Enter' && handleSend(input)}
                />
                <button 
                    onClick={() => handleSend(input)}
                    disabled={!input.trim()}
                    className="absolute right-2 top-1.5 p-1.5 bg-slate-900 text-white rounded-xl disabled:opacity-0 transition-all hover:bg-blue-600"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`
            w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-4 border-white transition-all duration-300 pointer-events-auto
            ${isOpen ? 'bg-slate-200 text-slate-400 rotate-45 scale-90' : 'bg-blue-600 text-white hover:scale-110 hover:bg-blue-700'}
        `}
      >
        {isOpen ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        ) : (
            <div className="relative">
                <span className="text-3xl">🤖</span>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
            </div>
        )}
      </button>
    </div>
  );
};
