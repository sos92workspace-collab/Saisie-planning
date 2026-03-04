import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { COLUMNS, DEFAULT_ROUNDS, DEFAULT_HEADERS } from './constants';
import { Choice, AppStep, ChoiceCategory, ViewMode, Round, UserProfile, ColumnConfig, UserRole, HeaderConfig, Unavailability, ShiftDefinition, ShiftGlobalSettings } from './types';
import { MatrixHeader } from './components/MatrixHeader';
import { StepProgressBar } from './components/StepProgressBar';
import { RecapView } from './components/RecapView';
import { RoundInfo } from './components/RoundInfo';
import { AdminDashboard } from './components/AdminDashboard';
import { ChatAssistant } from './components/ChatAssistant';
import { UnavailabilityModal } from './components/UnavailabilityModal';

const supabaseUrl = 'https://tnsjdhuulaebclvdtthh.supabase.co';
const supabaseKey = 'sb_publishable_uGW0mWIQ94EO9zmZ56bnAA_guffQW5T';
const supabase = createClient(supabaseUrl, supabaseKey);

const fromDb = (db: any): Choice => ({
  id: db.id, row: db.row, col: db.col, month: db.month - 1, year: db.year,
  groupIndex: db.group_index, subRank: db.sub_rank, category: db.category,
  userTrigram: db.user_trigram, 
  userRole: db.user_role || 'DOCTOR',
  status: db.status, submittedAt: db.submitted_at, roundId: db.round_id,
  colLabel: db.col_label,
  colType: db.col_type,
  colTimeRange: db.col_time_range
});

// Helper pour extraire la couleur hexadécimale depuis une classe Tailwind bg-[#...]
const getDefaultColor = (colorClass: string) => {
  const match = colorClass?.match(/bg-\[#([0-9a-fA-F]{6})\]/);
  if (match) return `#${match[1]}`;
  return '#FFFFFF';
};

// Utilitaire pour parser les horaires (ex: "08h-12h" ou "8-12")
const parseTimeRange = (range: string): { start: number, end: number } | null => {
  if (!range) return null;
  const match = range.match(/(\d+)[hH]?[-]?(\d+)?[hH]?/);
  if (!match) return null;
  let start = parseInt(match[1], 10);
  let end = match[2] ? parseInt(match[2], 10) : start + 1; 
  if (end < start) end += 24;
  return { start, end };
};

// Vérifie si deux plages se chevauchent
const doRangesOverlap = (r1: string, r2: string): boolean => {
  const t1 = parseTimeRange(r1);
  const t2 = parseTimeRange(r2);
  if (!t1 || !t2) return false;
  return Math.max(t1.start, t2.start) < Math.min(t1.end, t2.end);
};

const PERIOD_MAPPING: { [key: string]: number[] } = {
  '06-13': [1, 2, 3, 4, 5, 6, 7],
  '07-13': [8, 9, 10, 11],
  'MATIN': [12, 13, 14, 15, 16, 17, 18, 19, 20],
  '13-19': [21, 22, 23, 24, 25],
  'APREM': [26, 27, 28, 29, 30, 31, 32, 33, 34],
  'SOIR': [35, 36, 37, 38, 39, 40, 41, 42],
  'NUIT': [43, 44, 45, 46]
};

// --- COMPONENT: Landscape Lock Screen ---
const LandscapeLockScreen = () => (
  <div className="fixed inset-0 z-[9999] bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center">
    <div className="mb-8 relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 border-4 border-slate-700 rounded-2xl animate-pulse"></div>
        <svg className="w-12 h-12 text-blue-500 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
        </svg>
    </div>
    <h2 className="text-2xl font-black uppercase tracking-widest mb-6 text-white">Mode Paysage Requis</h2>
    <p className="text-sm font-bold text-slate-400 leading-relaxed max-w-xs">
      Pour garantir une lisibilité parfaite du planning, cette application s'utilise <span className="text-blue-400">horizontalement</span>.
    </p>
    <div className="mt-12 flex items-center gap-4 text-xs font-black uppercase tracking-widest text-slate-600">
        <span className="text-2xl">📱</span> Veuillez pivoter votre appareil
    </div>
  </div>
);

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LOGIN);
  const [trigram, setTrigram] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.NORMAL_SELECTION);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [rounds, setRounds] = useState<Round[]>(DEFAULT_ROUNDS);
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [globalClosures, setGlobalClosures] = useState<any[]>([]);
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
  const [shiftGlobalSettings, setShiftGlobalSettings] = useState<ShiftGlobalSettings | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => setIsPortrait(window.innerHeight > window.innerWidth);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const [activePriority, setActivePriority] = useState<number>(1);
  const activeRound = useMemo(() => rounds.find(r => r.isActive) || rounds[0], [rounds]);
  const currentRoundId = activeRound?.id || 1;
  const currentUser = useMemo(() => users.find(u => u.trigram === trigram.toUpperCase()), [users, trigram]);

  useEffect(() => {
     if (activeRound) {
         if (activeRound.step_normal_active) setCurrentStep(AppStep.NORMAL_SELECTION);
         else if (activeRound.step_good_bonus_active) setCurrentStep(AppStep.GOOD_BONUS_SELECTION);
         else if (activeRound.step_bad_bonus_active) setCurrentStep(AppStep.BAD_BONUS_SELECTION);
         else setCurrentStep(AppStep.RECAP_ORDERING);
     }
  }, [activeRound]);

  const category = useMemo((): ChoiceCategory => {
    if (currentStep === AppStep.BAD_BONUS_SELECTION) return 'bad_bonus';
    if (currentStep === AppStep.GOOD_BONUS_SELECTION) return 'good_bonus';
    return 'normal';
  }, [currentStep]);

  const currentStepInstruction = useMemo(() => {
     if (currentStep === AppStep.NORMAL_SELECTION) return activeRound.instructions_normal;
     if (currentStep === AppStep.BAD_BONUS_SELECTION) return activeRound.instructions_bad_bonus;
     if (currentStep === AppStep.GOOD_BONUS_SELECTION) return activeRound.instructions_good_bonus;
     return "";
  }, [currentStep, activeRound]);

  const goToNextStep = () => {
      if (currentStep === AppStep.NORMAL_SELECTION) {
          if (activeRound.step_good_bonus_active) setCurrentStep(AppStep.GOOD_BONUS_SELECTION);
          else if (activeRound.step_bad_bonus_active) setCurrentStep(AppStep.BAD_BONUS_SELECTION);
          else setCurrentStep(AppStep.RECAP_ORDERING);
      } else if (currentStep === AppStep.GOOD_BONUS_SELECTION) {
          if (activeRound.step_bad_bonus_active) setCurrentStep(AppStep.BAD_BONUS_SELECTION);
          else setCurrentStep(AppStep.RECAP_ORDERING);
      } else if (currentStep === AppStep.BAD_BONUS_SELECTION) {
          setCurrentStep(AppStep.RECAP_ORDERING);
      }
  };

  const goToPrevStep = () => {
      if (currentStep === AppStep.RECAP_ORDERING) {
          if (activeRound.step_bad_bonus_active) setCurrentStep(AppStep.BAD_BONUS_SELECTION);
          else if (activeRound.step_good_bonus_active) setCurrentStep(AppStep.GOOD_BONUS_SELECTION);
          else if (activeRound.step_normal_active) setCurrentStep(AppStep.NORMAL_SELECTION);
      } else if (currentStep === AppStep.BAD_BONUS_SELECTION) {
          if (activeRound.step_good_bonus_active) setCurrentStep(AppStep.GOOD_BONUS_SELECTION);
          else if (activeRound.step_normal_active) setCurrentStep(AppStep.NORMAL_SELECTION);
      } else if (currentStep === AppStep.GOOD_BONUS_SELECTION) {
          if (activeRound.step_normal_active) setCurrentStep(AppStep.NORMAL_SELECTION);
      }
  };

  const handleFinalValidation = async () => {
    setIsDataSyncing(true);
    try {
        const { data: rd } = await supabase.from('rounds').select('*').eq('id', currentRoundId).single();
        const { data: gc } = await supabase.from('global_closures').select('*');
        const { data: cfg } = await supabase.from('column_configs').select('*').eq('round_id', currentRoundId);
        const { data: sd } = await supabase.from('shift_definitions').select('*');
        const { data: sgs } = await supabase.from('shift_global_settings').select('*').eq('id', 1).single();
        const { data: unav } = await supabase.from('unavailabilities').select('*').eq('user_trigram', trigram.toUpperCase());
        const { data: assigned } = await supabase.from('choices').select('*').eq('status', 'ASSIGNED').eq('round_id', currentRoundId);
        
        const latestGlobalClosures = gc ? gc.map((g: any) => ({ ...g, month: g.month !== null ? g.month - 1 : null })) : [];
        const latestUnavailabilities = unav ? unav.map((u: any) => ({
            id: u.id, userTrigram: u.user_trigram, day: u.day, month: u.month - 1, year: u.year, period: u.period
        })) : [];
        const latestColumnConfigs = cfg || [];
        const latestShiftDefinitions = sd || [];
        const latestShiftGlobalSettings = sgs || null;
        const latestAssigned = assigned ? assigned.map(fromDb) : [];

        const myPendingChoices = choices.filter(c => c.userTrigram === trigram.toUpperCase() && c.status === 'PENDING');
        const validChoices: Choice[] = [];
        const invalidChoices: Choice[] = [];

        for (const choice of myPendingChoices) {
            let isValid = true;
            
            // Check global closures
            const isColClosed = latestGlobalClosures.some((g: any) => g.col_id === choice.col && g.row === null);
            const isCellClosed = latestGlobalClosures.some((g: any) => g.col_id === choice.col && g.row === choice.row && g.month === choice.month && g.year === choice.year);
            if (isColClosed || isCellClosed) isValid = false;

            // Check column config open/closed
            const colCfg = latestColumnConfigs.find(c => c.column_id === choice.col);
            if (colCfg) {
                const date = new Date(choice.year, choice.month, choice.row);
                const dayOfWeek = date.getDay(); 
                const type: 'w' | 's' | 'd' = (dayOfWeek === 0) ? 'd' : (dayOfWeek === 6) ? 's' : 'w';
                if (choice.category === 'normal') {
                    if (currentUser && currentUser.role !== 'ADMIN' && latestShiftGlobalSettings) {
                        const isDoctor = currentUser.role === 'DOCTOR';
                        const isTargetActive = isDoctor ? latestShiftGlobalSettings.target_doctor_active : latestShiftGlobalSettings.target_substitute_active;
                        
                        if (isTargetActive && latestShiftDefinitions.length > 0) {
                            const shift = latestShiftDefinitions.find((s: any) => choice.col >= s.start_col && choice.col <= s.end_col);
                            if (shift) {
                                const takenCount = choices.filter(c => 
                                    c.row === choice.row && c.month === choice.month && c.year === choice.year &&
                                    c.col >= shift.start_col && c.col <= shift.end_col &&
                                    c.userRole === currentUser.role &&
                                    (c.status === 'ASSIGNED' || c.status === 'PENDING')
                                ).length;
                                const max = isDoctor ? latestShiftGlobalSettings.target_doctor_max : latestShiftGlobalSettings.target_substitute_max;
                                if (takenCount > max) isValid = false; // > max because the choice itself is included in choices
                            }
                        }
                    }
                    if (type === 'w' && !colCfg.open_normal_w) isValid = false;
                    if (type === 's' && !colCfg.open_normal_s) isValid = false;
                    if (type === 'd' && !colCfg.open_normal_d) isValid = false;
                } else if (choice.category === 'bad_bonus') {
                    if (type === 'w' && !colCfg.open_bad_w) isValid = false;
                    if (type === 's' && !colCfg.open_bad_s) isValid = false;
                    if (type === 'd' && !colCfg.open_bad_d) isValid = false;
                } else if (choice.category === 'good_bonus') {
                    if (type === 'w' && !colCfg.open_good_w) isValid = false;
                    if (type === 's' && !colCfg.open_good_s) isValid = false;
                    if (type === 'd' && !colCfg.open_good_d) isValid = false;
                }
            }

            // Check unavailabilities
            const constraints = latestUnavailabilities.filter((u: any) => u.day === choice.row && u.month === choice.month && u.year === choice.year);
            if (constraints.length > 0) {
                if (constraints.some((u: any) => u.period === 'FULL')) isValid = false;
                else {
                    const colDef = COLUMNS.find(c => c.id === choice.col);
                    const colTimeRange = colCfg?.custom_time_range || colDef?.timeRange;
                    if (colTimeRange) {
                        if (constraints.some((u: any) => {
                            if (PERIOD_MAPPING[u.period]) return PERIOD_MAPPING[u.period].includes(choice.col);
                            return doRangesOverlap(u.period, colTimeRange);
                        })) {
                            isValid = false;
                        }
                    }
                }
            }

            // Check if already assigned
            if (latestAssigned.some(c => c.row === choice.row && c.col === choice.col && c.month === choice.month && c.year === choice.year)) {
                isValid = false;
            }

            if (isValid) validChoices.push(choice);
            else invalidChoices.push(choice);
        }

        if (invalidChoices.length > 0) {
            const msg = `Certains de vos choix ne sont plus compatibles avec les paramètres actuels du tour (cases fermées, indisponibilités, ou déjà attribuées).\n\n` +
                        `Les choix suivants vont être supprimés :\n` +
                        invalidChoices.map(c => `- ${new Date(c.year, c.month, c.row).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} : ${c.colLabel}`).join('\n') +
                        `\n\nVoulez-vous continuer et transmettre les choix restants ?`;
            if (!window.confirm(msg)) {
                setIsDataSyncing(false);
                return;
            }
        }

        // Adjust numbering for valid choices
        // Group by category
        const categories = ['normal', 'bad_bonus', 'good_bonus'];
        const finalChoices: Choice[] = [];
        for (const cat of categories) {
            const catChoices = validChoices.filter(c => c.category === cat);
            // Group by original groupIndex
            const groups = Array.from(new Set(catChoices.map(c => c.groupIndex))).sort((a, b) => a - b);
            let newGroupIndex = 1;
            for (const oldGroupIndex of groups) {
                const groupChoices = catChoices.filter(c => c.groupIndex === oldGroupIndex).sort((a, b) => a.subRank - b.subRank);
                let newSubRank = 1;
                for (const c of groupChoices) {
                    finalChoices.push({ ...c, groupIndex: newGroupIndex, subRank: newSubRank });
                    newSubRank++;
                }
                newGroupIndex++;
            }
        }

        // Delete existing PENDING choices for user in DB
        await supabase.from('choices').delete().eq('user_trigram', trigram.toUpperCase()).eq('status', 'PENDING');

        // Insert final choices
        if (finalChoices.length > 0) {
            const payload = finalChoices.map(c => ({
                id: c.id, row: c.row, col: c.col, month: c.month + 1, year: c.year,
                group_index: c.groupIndex, sub_rank: c.subRank, category: c.category,
                user_trigram: c.userTrigram, user_role: c.userRole,
                status: c.status, submitted_at: c.submittedAt, round_id: c.roundId,
                col_label: c.colLabel, col_type: c.colType, col_time_range: c.colTimeRange
            }));
            await supabase.from('choices').insert(payload);
        }

        if (finalChoices.length === 0 && invalidChoices.length > 0) {
            alert("Tous vos choix étaient incompatibles et ont été supprimés. Aucun choix n'a été transmis.\n\nVous allez être déconnecté.");
        } else {
            alert("Vos choix ont bien été transmis.\n\nVous allez être déconnecté.");
        }
        
        setViewMode(ViewMode.LOGIN);
        setTrigram('');
        setPassword('');
        setChoices([]); 
    } catch (e) {
        console.error(e);
        alert("Une erreur est survenue lors de la validation.");
    } finally {
        setIsDataSyncing(false);
    }
  };

  const getNextAvailablePriority = useCallback((cat: ChoiceCategory) => {
    const used = choices
        .filter(c => c.userTrigram === trigram.toUpperCase() && c.category === cat && c.status === 'PENDING')
        .map(c => c.groupIndex);
    if (used.length === 0) return 1;
    let next = 1;
    while (used.includes(next)) next++;
    return Math.min(next, 20);
  }, [choices, trigram]);

  useEffect(() => {
    // Only update activePriority when changing category, step, or user.
    // We intentionally omit 'choices' from dependencies so it doesn't increment automatically on every click.
    const used = choices
        .filter(c => c.userTrigram === trigram.toUpperCase() && c.category === category && c.status === 'PENDING')
        .map(c => c.groupIndex);
    let next = 1;
    while (used.includes(next)) next++;
    setActivePriority(Math.min(next, 20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, currentStep, trigram]);

  const accessStatus = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN' || viewMode === ViewMode.ADMIN) return { allowed: true };
    if (activeRound.isLocked) return { allowed: false, message: "La saisie est temporairement fermée par l'administrateur." };
    if (currentUser.role === 'DOCTOR' && !activeRound.isActiveDoctors) return { allowed: false, message: "Le tour n'est pas encore ouvert aux titulaires." };
    if (currentUser.role === 'SUBSTITUTE' && !activeRound.isActiveSubstitutes) return { allowed: false, message: "Le tour n'est pas encore ouvert aux remplaçants." };
    return { allowed: true };
  }, [currentUser, activeRound, viewMode]);

  const monthsToDisplay = useMemo(() => {
    const list = [];
    if (!activeRound) return [];
    const startM = activeRound.monthStart;
    const startY = activeRound.yearStart;
    for (let i = 0; i < (activeRound.numMonths || 1); i++) {
        const d = new Date(startY, startM + i, 1);
        list.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }) });
    }
    return list;
  }, [activeRound]);

  const daysDataForAI = useMemo(() => {
      if (monthsToDisplay.length === 0) return [];
      const data = [];
      for(const m of monthsToDisplay) {
          const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
          for(let d = 1; d <= daysInMonth; d++) {
              const date = new Date(m.year, m.month, d);
              data.push({
                  day: d, month: m.month, year: m.year,
                  dateStr: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
                  weekday: date.toLocaleDateString('fr-FR', { weekday: 'long' }),
                  isSunday: date.getDay() === 0, isSaturday: date.getDay() === 6
              });
          }
      }
      return data;
  }, [monthsToDisplay]);

  useEffect(() => {
    const init = async () => {
      if (viewMode === ViewMode.LOGIN) setIsInitialLoading(true);
      else setIsDataSyncing(true);
      try {
        const { data: rd } = await supabase.from('rounds').select('*');
        if (rd) setRounds(rd.map((r: any) => ({
            ...r,
            isActive: r.is_active,
            isActiveDoctors: r.is_active_doctors ?? true,
            isActiveSubstitutes: r.is_active_substitutes ?? true,
            isLocked: r.is_locked ?? false,
            numMonths: r.num_months || 1,
            monthStart: r.month_start - 1,
            yearStart: r.year_start,
            step_normal_active: r.step_normal_active ?? true,
            instructions_normal: r.instructions_normal ?? "",
            step_bad_bonus_active: r.step_bad_bonus_active ?? true,
            instructions_bad_bonus: r.instructions_bad_bonus ?? "",
            step_good_bonus_active: r.step_good_bonus_active ?? true,
            instructions_good_bonus: r.instructions_good_bonus ?? "",
        })).sort((a: any, b: any) => a.id - b.id));
        const { data: cfg } = await supabase.from('column_configs').select('*').eq('round_id', currentRoundId);
        if (cfg) setColumnConfigs(cfg);
        const { data: sd } = await supabase.from('shift_definitions').select('*');
        if (sd) setShiftDefinitions(sd);
        const { data: sgs } = await supabase.from('shift_global_settings').select('*').eq('id', 1).single();
        if (sgs) setShiftGlobalSettings(sgs);
        
        const { data: ud } = await supabase.from('users').select('*');
        if (ud) setUsers(ud);
        
        const { data: gc } = await supabase.from('global_closures').select('*');
        if (gc) setGlobalClosures(gc.map((g: any) => ({ ...g, month: g.month !== null ? g.month - 1 : null })));
      } catch (e) {
        console.error("Erreur init:", e);
      } finally {
        setIsInitialLoading(false);
        setIsDataSyncing(false);
      }
    };
    init();
  }, [currentRoundId, viewMode]);

  const fetchChoices = useCallback(async (tri: string) => {
    // MODIFICATION ICI: On récupère les choix de l'utilisateur (PENDING/ASSIGNED) ET TOUS les choix ASSIGNED des autres
    // La syntaxe .or() avec une virgule agit comme un OU
    const { data } = await supabase.from('choices').select('*')
      .neq('status', 'ARCHIVED')
      .or(`user_trigram.eq.${tri.toUpperCase()},status.eq.ASSIGNED`);
      
    if (data) setChoices(data.map(fromDb));
    
    const { data: unav } = await supabase.from('unavailabilities').select('*').eq('user_trigram', tri.toUpperCase());
    if (unav) setUnavailabilities(unav.map((u: any) => ({
        id: u.id, userTrigram: u.user_trigram, day: u.day, month: u.month - 1, year: u.year, period: u.period
    })));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTri = trigram.trim().toUpperCase();
    if (cleanTri === 'ADM' && password === 'admin') {
      setViewMode(ViewMode.ADMIN);
      return;
    }
    const { data: user } = await supabase.from('users').select('*').eq('trigram', cleanTri).single();
    if (user && (!user.password || user.password === password)) {
      await fetchChoices(cleanTri);
      setViewMode(ViewMode.APP);
    } else {
      setLoginError('Identifiants invalides.');
    }
  };

  const isColOpen = useCallback((colId: number, step: AppStep, day: number, month: number, year: number) => {
    const cfg = columnConfigs.find(c => c.column_id === colId);
    if (!cfg) return true;
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay(); 
    const type: 'w' | 's' | 'd' = (dayOfWeek === 0) ? 'd' : (dayOfWeek === 6) ? 's' : 'w';
    
    if (step === AppStep.NORMAL_SELECTION) {
        if (currentUser && currentUser.role !== 'ADMIN' && shiftGlobalSettings) {
            const isDoctor = currentUser.role === 'DOCTOR';
            const isTargetActive = isDoctor ? shiftGlobalSettings.target_doctor_active : shiftGlobalSettings.target_substitute_active;
            
            if (isTargetActive && shiftDefinitions.length > 0) {
                const shift = shiftDefinitions.find(s => colId >= s.start_col && colId <= s.end_col);
                if (shift) {
                    const takenCount = choices.filter(c => 
                        c.row === day && c.month === month && c.year === year &&
                        c.col >= shift.start_col && c.col <= shift.end_col &&
                        c.userRole === currentUser.role &&
                        (c.status === 'ASSIGNED' || c.status === 'PENDING')
                    ).length;
                    
                    const max = isDoctor ? shiftGlobalSettings.target_doctor_max : shiftGlobalSettings.target_substitute_max;
                    if (takenCount >= max) return false;
                }
            }
        }
        
        if (type === 'w') return cfg.open_normal_w;
        if (type === 's') return cfg.open_normal_s;
        return cfg.open_normal_d;
    }
    if (step === AppStep.BAD_BONUS_SELECTION) {
        if (type === 'w') return cfg.open_bad_w;
        if (type === 's') return cfg.open_bad_s;
        return cfg.open_bad_d;
    }
    if (step === AppStep.GOOD_BONUS_SELECTION) {
        if (type === 'w') return cfg.open_good_w;
        if (type === 's') return cfg.open_good_s;
        return cfg.open_good_d;
    }
    return true;
  }, [columnConfigs, currentUser, shiftDefinitions, shiftGlobalSettings, choices]);

  const isBlockedByUnavailability = useCallback((row: number, colId: number, month: number, year: number) => {
    const constraints = unavailabilities.filter(u => u.day === row && u.month === month && u.year === year);
    if (constraints.length === 0) return false;
    if (constraints.some(u => u.period === 'FULL')) return true;
    const colDef = COLUMNS.find(c => c.id === colId);
    if (!colDef) return false;
    const colTimeRange = columnConfigs.find(c => c.column_id === colId)?.custom_time_range || colDef.timeRange;
    return constraints.some(u => {
        if (PERIOD_MAPPING[u.period]) return PERIOD_MAPPING[u.period].includes(colId);
        return doRangesOverlap(u.period, colTimeRange);
    });
  }, [unavailabilities, columnConfigs]);

  const handleCellClick = useCallback(async (row: number, colId: number, month: number, year: number) => {
    if (!accessStatus.allowed || currentStep === AppStep.RECAP_ORDERING) return;

    const cleanTri = trigram.trim().toUpperCase();
    const existing = choices.find(c => c.row === row && c.col === colId && c.month === month && c.year === year && c.userTrigram === cleanTri && c.category === category);
    
    if (existing) {
       if (existing.status === 'ASSIGNED') {
           alert("Impossible de modifier une garde validée. Veuillez contacter l'administrateur.");
           return;
       }
       setChoices(prev => prev.filter(c => c.id !== existing.id));
       return;
    }

    if (!isColOpen(colId, currentStep, row, month, year)) return;
    if (isBlockedByUnavailability(row, colId, month, year)) return;

    const isColClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === null);
    const isCellClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
    if (isColClosed || isCellClosed) {
        alert("Cette case est fermée par l'administrateur.");
        return;
    }

    // Check if cell is ALREADY assigned to someone else
    const assignedToOther = choices.find(c => c.row === row && c.col === colId && c.month === month && c.year === year && c.status === 'ASSIGNED' && c.userTrigram !== cleanTri);
    if (assignedToOther) {
        return; 
    }

    const existingInGroup = choices.filter(c => c.userTrigram === cleanTri && c.category === category && c.groupIndex === activePriority);
    let nextSubRank = 1;
    if (existingInGroup.length > 0) nextSubRank = Math.max(...existingInGroup.map(c => c.subRank)) + 1;
    if (nextSubRank > 11) { alert("Limite atteinte : Max 10 alternatives."); return; }

    const baseColDef = COLUMNS.find(c => c.id === colId);
    const colConfig = columnConfigs.find(c => c.column_id === colId);
    const finalLabel = colConfig?.custom_label || baseColDef?.label || '';
    const finalType = colConfig?.custom_type || baseColDef?.type || '';
    const finalTimeRange = colConfig?.custom_time_range || baseColDef?.timeRange || '';

    if (baseColDef) {
        const mainChoicesSameDay = choices.filter(c => c.userTrigram === cleanTri && c.row === row && c.month === month && c.year === year);
        let hasOverlap = false;
        let overlapRange = '';
        for (const existingChoice of mainChoicesSameDay) {
            const existingTimeRange = existingChoice.colTimeRange || COLUMNS.find(c => c.id === existingChoice.col)?.timeRange;
            if (existingTimeRange && doRangesOverlap(finalTimeRange, existingTimeRange)) {
                hasOverlap = true;
                overlapRange = existingTimeRange;
                break;
            }
        }
        if (hasOverlap) {
            if (!window.confirm(`⚠️ AVERTISSEMENT : Vous avez déjà sélectionné une garde avec des horaires incompatibles (${overlapRange}).\n\nVoulez-vous conserver ce choix malgré tout ?`)) {
                return;
            }
        }
    }

    const newChoice: Choice = {
        id: Math.random().toString(36).substring(2, 11), row, col: colId, month, year,
        groupIndex: activePriority, subRank: nextSubRank, category, 
        userTrigram: cleanTri, userRole: currentUser?.role || 'DOCTOR',
        status: 'PENDING', submittedAt: new Date().toISOString(), roundId: currentRoundId,
        colLabel: finalLabel, colType: finalType, colTimeRange: finalTimeRange
    };
    
    setChoices(prev => [...prev, newChoice]);
  }, [choices, currentStep, trigram, currentRoundId, isColOpen, isBlockedByUnavailability, currentUser, accessStatus, activePriority, category, columnConfigs, globalClosures]);

  const handleAIChoices = useCallback(async (suggestions: any[]) => {
      const newChoices: Choice[] = [];
      const user = users.find(u => u.trigram === trigram.toUpperCase());
      if (!user) return;

      const currentChoicesState = choices; 

      for (const s of suggestions) {
          const month = s.month !== undefined ? s.month : (monthsToDisplay[0]?.month || 0);
          const year = s.year !== undefined ? s.year : (monthsToDisplay[0]?.year || new Date().getFullYear());
          const row = s.day;
          const colId = s.columnId;
          
          const colConfig = columnConfigs.find(c => c.column_id === colId);
          const baseColDef = COLUMNS.find(c => c.id === colId);
          if(!baseColDef) continue;
          
          if (!isColOpen(colId, currentStep, row, month, year)) continue;
          if (isBlockedByUnavailability(row, colId, month, year)) continue;

          const finalLabel = colConfig?.custom_label || baseColDef.label;
          const finalType = colConfig?.custom_type || baseColDef.type;
          const finalTimeRange = colConfig?.custom_time_range || baseColDef.timeRange;

          const targetPriority = s.priority || activePriority;

          const existingInGroup = [...currentChoicesState, ...newChoices].filter(c => 
              c.userTrigram === user.trigram && 
              c.category === category && 
              c.groupIndex === targetPriority
          );
          
          let nextSubRank = 1;
          if (existingInGroup.length > 0) {
              nextSubRank = Math.max(...existingInGroup.map(c => c.subRank)) + 1;
          }

          if (nextSubRank === 1) {
              const mainChoicesSameDay = [...currentChoicesState, ...newChoices].filter(c => 
                  c.userTrigram === user.trigram && 
                  c.row === row && 
                  c.month === month && 
                  c.year === year &&
                  c.subRank === 1
              );
              
              let overlapFound = false;
              for (const existingChoice of mainChoicesSameDay) {
                  const existingTimeRange = existingChoice.colTimeRange || COLUMNS.find(c => c.id === existingChoice.col)?.timeRange;
                  if (existingTimeRange && doRangesOverlap(finalTimeRange, existingTimeRange)) {
                      overlapFound = true;
                      break;
                  }
              }
              if (overlapFound) continue; 
          }

          const choice: Choice = {
              id: Math.random().toString(36).substring(2, 11),
              row, col: colId, month, year,
              groupIndex: targetPriority, 
              subRank: nextSubRank, 
              category,
              userTrigram: user.trigram, userRole: user.role,
              status: 'PENDING', submittedAt: new Date().toISOString(), roundId: currentRoundId,
              colLabel: finalLabel,
              colType: finalType,
              colTimeRange: finalTimeRange
          };
          newChoices.push(choice);
      }
      
      if (newChoices.length > 0) {
          setChoices(prev => [...prev, ...newChoices]);
      }
  }, [users, trigram, activePriority, category, currentRoundId, columnConfigs, isColOpen, isBlockedByUnavailability, monthsToDisplay, currentStep, choices]);

  const dynamicColumns = useMemo(() => {
    return COLUMNS.map(col => {
      const cfg = columnConfigs.find(c => c.column_id === col.id);
      return {
        ...col,
        label: cfg?.custom_label || col.label,
        headerLabel: cfg?.custom_header_label || col.headerLabel,
        type: (cfg?.custom_type as any) || col.type,
        site: (cfg?.custom_site as any) || col.site,
        timeRange: cfg?.custom_time_range || col.timeRange,
        customColor: cfg?.custom_color || getDefaultColor(col.colorClass) || '#FFFFFF'
      };
    });
  }, [columnConfigs]);

  if (isInitialLoading && viewMode === ViewMode.LOGIN) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-xl font-black uppercase tracking-[0.3em] animate-pulse">SOS 92</h1>
      </div>
    );
  }

  if (viewMode === ViewMode.ADMIN) {
    return <AdminDashboard users={users} setUsers={setUsers} rounds={rounds} setRounds={setRounds} supabase={supabase} onLogout={() => setViewMode(ViewMode.LOGIN)} />;
  }

  if (viewMode === ViewMode.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-slate-900">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[60px] shadow-2xl w-full max-w-sm space-y-8 border-t-[12px] border-slate-900">
          <div className="text-center"><h1 className="text-4xl font-black tracking-tighter uppercase mb-2">SOS 92</h1></div>
          {loginError && <div className="p-3 bg-red-50 text-red-500 rounded-2xl text-[10px] font-bold text-center uppercase">{loginError}</div>}
          <div className="space-y-4">
            <input type="text" placeholder="Trigramme" value={trigram} onChange={e => setTrigram(e.target.value)} className="w-full p-5 bg-slate-50 border rounded-3xl font-black uppercase text-center text-2xl outline-none" maxLength={3} />
            <input type="password" placeholder="Code secret" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-slate-50 border rounded-3xl font-black text-center text-2xl outline-none" />
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white p-6 rounded-3xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Connexion</button>
        </form>
      </div>
    );
  }

  const getChoiceColor = (cat: ChoiceCategory) => {
    if (cat === 'bad_bonus') return '#4338ca'; 
    if (cat === 'good_bonus') return '#10b981'; 
    return '#f97316'; 
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden font-sans text-slate-900 relative">
      {isPortrait && <LandscapeLockScreen />}
      {isDataSyncing && <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 z-[100] animate-pulse"></div>}
      
      {!accessStatus.allowed && (
        <div className="absolute inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Accès Restreint</h2>
                <p className="text-slate-400 font-bold leading-relaxed">{accessStatus.message}</p>
                <button onClick={() => setViewMode(ViewMode.LOGIN)} className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all">Retourner à l'accueil</button>
            </div>
        </div>
      )}

      {showUnavailabilityModal && monthsToDisplay.length > 0 && (
          <UnavailabilityModal 
              isOpen={showUnavailabilityModal}
              onClose={() => setShowUnavailabilityModal(false)}
              unavailabilities={unavailabilities}
              setUnavailabilities={setUnavailabilities}
              months={monthsToDisplay}
              trigram={trigram.toUpperCase()}
              supabase={supabase}
          />
      )}

      <RoundInfo round={activeRound} stepInstruction={currentStepInstruction} />
      
      <header className="bg-white border-b px-4 h-[72px] flex items-center justify-between z-30 shrink-0 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-6"><StepProgressBar currentStep={currentStep} round={activeRound} /></div>
        <div className="flex items-center gap-4">
            {currentUser?.role === 'DOCTOR' && currentStep !== AppStep.RECAP_ORDERING && (
                <button 
                    onClick={() => setShowUnavailabilityModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm whitespace-nowrap"
                >
                    <span className="hidden md:inline">Gérer mes indisponibilités</span>
                </button>
            )}

          <div className="text-right hidden sm:block">
            <div className="text-[12px] font-black uppercase text-slate-900">{trigram.toUpperCase()}</div>
            <div className={`text-[7px] font-black uppercase tracking-widest ${currentUser?.role === 'SUBSTITUTE' ? 'text-orange-600' : 'text-blue-600'}`}>
              {currentUser?.role === 'SUBSTITUTE' ? 'Remplaçant' : 'Titulaire'}
            </div>
          </div>
          
          {currentStep > AppStep.NORMAL_SELECTION && (
             <button onClick={goToPrevStep} className="px-6 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all whitespace-nowrap">Précédent</button>
          )}

          {currentStep < AppStep.RECAP_ORDERING ? (
              <button onClick={goToNextStep} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 shadow-lg whitespace-nowrap">Suivant</button>
          ) : (
              <button onClick={handleFinalValidation} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 shadow-lg whitespace-nowrap transition-all animate-pulse">Valider mes choix</button>
          )}
          <button onClick={() => setViewMode(ViewMode.LOGIN)} className="p-2 text-slate-300 hover:text-red-500"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5"/></svg></button>
        </div>
      </header>

      {currentStep !== AppStep.RECAP_ORDERING && (
        <div className="bg-slate-100 border-b px-4 py-3 md:px-8 md:py-4 flex flex-col md:flex-row items-center gap-4 md:gap-8 z-20 shrink-0 shadow-inner justify-between sticky top-0 md:static">
            <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto no-scrollbar">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">Indice Priorité :</span>
                <div className="flex gap-1.5 pb-2 md:pb-0">
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                        <button 
                            key={num} 
                            onClick={() => setActivePriority(num)}
                            className={`w-7 h-7 rounded-full text-[10px] font-black transition-all border-2 shrink-0 ${activePriority === num ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-110' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                        >
                            {num}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border shadow-sm w-full md:w-auto justify-center">
                <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: getChoiceColor(category) }}></div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                    Mode : {category === 'normal' ? 'Garde Cible' : category === 'good_bonus' ? 'Bonne Garde' : 'Garde Normale'}
                </span>
            </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-100">
        {currentStep === AppStep.RECAP_ORDERING ? (
          <RecapView choices={choices.filter(c => c.userTrigram === trigram.toUpperCase())} columns={dynamicColumns} onReorder={setChoices} />
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-12 pb-32">
            {monthsToDisplay.map(({ month, year, label }) => {
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              return (
                <div key={`${year}-${month}`} className="space-y-4">
                  <div className="flex items-center gap-4 px-4"><h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{label}</h2><div className="h-px bg-slate-200 flex-1"></div></div>
                  
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-x-auto">
                     <table className="w-full border-separate border-spacing-0 table-fixed">
                        <MatrixHeader columns={dynamicColumns} globalClosures={globalClosures} />
                        <tbody>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const date = new Date(year, month, day);
                            const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3).replace('.', '');
                            const isSunday = date.getDay() === 0;
                            return (
                              <tr key={day} className={`h-10 md:h-8 hover:bg-slate-50/50 ${isSunday ? 'bg-red-50/30' : ''}`}>
                                <td className={`sticky left-0 border-r border-b text-center z-10 w-20 md:w-16 h-10 md:h-8 font-black ${isSunday ? 'bg-red-100 text-red-600' : 'bg-white text-slate-900'}`}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] md:text-[8px] font-normal opacity-70">{dayName}</span>
                                        <span className="text-[12px] md:text-[10px]">{day}</span>
                                    </div>
                                </td>
                                {dynamicColumns.map(col => {
                                  const isColClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === null);
                                  const isCellClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
                                  const isClosed = isColClosed || isCellClosed;
                                  
                                  const open = isColOpen(col.id, currentStep, day, month, year) && !isClosed;
                                  const isBlocked = isBlockedByUnavailability(day, col.id, month, year);
                                  
                                  // Récupérer une garde validée (ASSIGNED) sur cette case
                                  const assigned = choices.find(ch => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.status === 'ASSIGNED');
                                  
                                  // Mes vœux en attente
                                  const myPendingChoices = choices.filter(ch => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.userTrigram === trigram.toUpperCase() && ch.status === 'PENDING');
                                  const myPending = myPendingChoices.find(ch => ch.category === category) || myPendingChoices[0];
                                  const hasMultiplePending = myPendingChoices.length > 1;
                                  
                                  const isAssignedToMe = assigned && assigned.userTrigram === trigram.toUpperCase();
                                  const isAssignedToOther = assigned && !isAssignedToMe;
                                  
                                  let cellStyles = "border-r border-b border-slate-50 relative text-center transition-all min-w-[60px] w-[60px] md:min-w-[28px] md:w-[28px] ";
                                  let bgColor = '#FFFFFF';
                                  
                                  if (isAssignedToMe) { 
                                      bgColor = '#16a34a'; // Green 600 - Validé pour moi
                                      cellStyles += " shadow-[inset_0_0_0_2px_#4ade80] z-20 scale-[1.05] rounded-sm"; 
                                  } else if (isAssignedToOther) { 
                                      bgColor = '#475569'; // Slate 600 - Validé pour un autre
                                      cellStyles += " opacity-90 cursor-not-allowed"; 
                                  } else if (hasMultiplePending) {
                                      if (myPendingChoices.length === 2) {
                                          const color1 = getChoiceColor(myPendingChoices[0].category);
                                          const color2 = getChoiceColor(myPendingChoices[1].category);
                                          bgColor = `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)`;
                                      } else {
                                          const color1 = getChoiceColor(myPendingChoices[0].category);
                                          const color2 = getChoiceColor(myPendingChoices[1].category);
                                          const color3 = getChoiceColor(myPendingChoices[2].category);
                                          bgColor = `linear-gradient(135deg, ${color1} 33%, ${color2} 33% 66%, ${color3} 66%)`;
                                      }
                                      cellStyles += " text-white shadow-md z-10 cursor-pointer scale-[0.98]";
                                  } else if (myPending) { 
                                      bgColor = getChoiceColor(myPending.category); 
                                      cellStyles += " text-white shadow-md z-10 cursor-pointer scale-[0.98]";
                                  } else if (isBlocked) { 
                                      bgColor = '#f1f5f9'; 
                                      cellStyles += " bg-slate-100 opacity-50 cursor-not-allowed bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0tMSwxIGw1LC01IE0wLDQgbDQsLTQgTTMsNSBsNSwtNSIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')]";
                                  } else if (open) { 
                                      bgColor = col.customColor || '#FFFFFF'; 
                                      cellStyles += " hover:bg-blue-50 cursor-pointer";
                                  } else { 
                                      bgColor = '#e2e8f0'; 
                                      cellStyles += " opacity-30 cursor-not-allowed";
                                  }

                                  if(assigned && !isAssignedToMe) cellStyles += " cursor-not-allowed";

                                  return (
                                    <td key={col.id} onClick={() => open && !assigned && handleCellClick(day, col.id, month, year)} className={cellStyles} style={{ background: bgColor }}>
                                      {/* Contenu de la case */}
                                      
                                      {/* Cas 1 : Mon vœu en attente (sans assignation par dessus) */}
                                      {!assigned && hasMultiplePending && (
                                        <div className="flex flex-col items-center justify-center leading-none w-full h-full relative">
                                            <span className="absolute top-0.5 left-1 text-[10px] md:text-[8px] font-black drop-shadow-md">{myPendingChoices[0].groupIndex}</span>
                                            <span className="absolute bottom-0.5 right-1 text-[10px] md:text-[8px] font-black drop-shadow-md">{myPendingChoices[1].groupIndex}</span>
                                            {myPendingChoices.length > 2 && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] md:text-[8px] font-black drop-shadow-md">{myPendingChoices[2].groupIndex}</span>}
                                        </div>
                                      )}
                                      {!assigned && !hasMultiplePending && myPending && (
                                        <div className="flex flex-col items-center justify-center leading-none">
                                            <span className="text-[12px] md:text-[10px] font-black">{myPending.groupIndex}</span>
                                            {myPending.subRank > 1 && <span className="text-[9px] md:text-[7px] font-black opacity-80 lowercase">.{String.fromCharCode(95 + myPending.subRank)}</span>}
                                        </div>
                                      )}

                                      {/* Cas 2 : Garde Validée (Moi ou Autre) - Affiche le trigramme */}
                                      {(isAssignedToMe || isAssignedToOther) && (
                                          <span className="text-[12px] md:text-[10px] font-black text-white drop-shadow-sm tracking-wide block leading-tight">
                                              {assigned?.userTrigram}
                                          </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                     </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ChatAssistant 
        trigram={trigram} 
        currentRoundId={currentRoundId} 
        columns={dynamicColumns} 
        days={daysDataForAI} 
        activePriority={activePriority} 
        monthLabel={monthsToDisplay[0]?.label || ''} 
        onAddChoices={handleAIChoices}
        currentStep={currentStep}
        columnConfigs={columnConfigs}
        choices={choices}
        currentCategory={category}
      />
    </div>
  );
};

export default App;