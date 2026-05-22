import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronDown, Calendar, Bot, X, ArrowRight } from 'lucide-react';
import { COLUMNS, DEFAULT_ROUNDS, DEFAULT_HEADERS, parseTimeRange, isPublicHoliday } from './constants';
import { Choice, AppStep, ChoiceCategory, ViewMode, Round, UserProfile, ColumnConfig, UserRole, HeaderConfig, Unavailability, ShiftDefinition, ShiftGlobalSettings } from './types';
import { MatrixHeader } from './components/MatrixHeader';

const formatRequestDate = (day: number | undefined, month: number | undefined, year: number | undefined, col: number | undefined, colLabel: string | undefined, is1IndexedMonth: boolean = false, columnConfigs: ColumnConfig[] = []) => {
  if (day == null || month == null || year == null || col == null) return '';
  const adjustedMonth = is1IndexedMonth ? month - 1 : month;
  const d = new Date(year, adjustedMonth, day);
  const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase();
  const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const columnDef = COLUMNS.find(c => c.id === col);
  const cfg = columnConfigs.find(c => c.column_id === col);
  const displayLabel = colLabel || cfg?.custom_label || columnDef?.label || '';
  const typeInfos = columnDef ? ` | ${cfg?.custom_type || columnDef.type} ${cfg?.custom_time_range || columnDef.timeRange}` : '';
  
  return `Col. ${col} : ${displayLabel} - ${dayName} ${dateStr}${typeInfos}`;
};
import { StepProgressBar } from './components/StepProgressBar';
import { RecapView } from './components/RecapView';
import { RoundInfo } from './components/RoundInfo';
import { AdminDashboard } from './components/AdminDashboard';
import { UnavailabilityModal } from './components/UnavailabilityModal';
import { ListView } from './components/ListView';
import { ChatAssistant } from './components/ChatAssistant';
import { DoctorProfileWizard } from './components/DoctorProfileWizard';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

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

const fetchAll = async (supabaseClient: any, table: string, queryModifier: (q: any) => any = (q) => q) => {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabaseClient.from(table).select('*');
    query = queryModifier(query);
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allData.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return allData;
};

// Helper pour extraire la couleur hexadécimale depuis une classe Tailwind bg-[#...]
const getDefaultColor = (colorClass: string) => {
  const match = colorClass?.match(/bg-\[#([0-9a-fA-F]{6})\]/);
  if (match) return `#${match[1]}`;
  return '#FFFFFF';
};

// Vérifie si deux plages se chevauchent
const doRangesOverlap = (r1: string, r2: string, maxOverlapMinutes: number = 0): boolean => {
  const t1 = parseTimeRange(r1);
  const t2 = parseTimeRange(r2);
  if (!t1 || !t2) return false;
  
  // Calculate overlap in minutes
  const overlapStart = Math.max(t1.start, t2.start);
  const overlapEnd = Math.min(t1.end, t2.end);
  
  if (overlapStart < overlapEnd) {
      return (overlapEnd - overlapStart) > maxOverlapMinutes;
  }
  return false;
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

const MonthCounters = ({ month, year, choices, columns, userTrigram }: {
    month: number,
    year: number,
    choices: Choice[],
    columns: any[],
    userTrigram: string
}) => {
    const [expanded, setExpanded] = useState<string | null>(null);

    const stats = {
        'Consultation': { total: 0, semaine: 0, samediAprem: 0, dimancheJf: 0 },
        'Téléconsultation': { total: 0, semaine: 0, samediAprem: 0, dimancheJf: 0 },
        'Visite': { total: 0, semaine: 0, samediAprem: 0, dimancheJf: 0 },
    };

    const rawMyAssigned = choices.filter(c => 
        c.month === month && 
        c.year === year && 
        c.userTrigram === userTrigram && 
        c.status === 'ASSIGNED'
    );

    const myAssigned = rawMyAssigned.filter((a, index, self) => 
        index === self.findIndex((t) => t.row === a.row && t.col === a.col)
    );

    myAssigned.forEach(choice => {
        const col = columns.find(c => c.id === choice.col);
        if (!col) return;
        
        const type = col.type as 'Consultation' | 'Téléconsultation' | 'Visite';
        if (!stats[type]) return;

        const date = new Date(year, month, choice.row);
        const isHoliday = isPublicHoliday(date);
        const isSunday = date.getDay() === 0;
        const isSaturday = date.getDay() === 6;
        const timeRange = parseTimeRange(col.timeRange);

        stats[type].total++;

        if (isSunday || isHoliday) {
            stats[type].dimancheJf++;
        } else if (isSaturday && timeRange && timeRange.start >= 12 * 60) {
            stats[type].samediAprem++;
        } else {
            stats[type].semaine++;
        }
    });

    return (
        <div className="flex flex-wrap gap-4 px-4">
            {(['Consultation', 'Téléconsultation', 'Visite'] as const).map(type => {
                const data = stats[type];
                const isExpanded = expanded === type;
                return (
                    <div key={type} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 min-w-[200px]">
                        <button 
                            onClick={() => setExpanded(isExpanded ? null : type)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-700 text-sm">{type}</span>
                                <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs font-black">{data.total}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                            <div className="px-4 py-3 bg-white border-t border-slate-100 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Semaine</span>
                                    <span className="font-black text-slate-700">{data.semaine}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Samedi Aprem</span>
                                    <span className="font-black text-slate-700">{data.samediAprem}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Dimanche & JF</span>
                                    <span className="font-black text-slate-700">{data.dimancheJf}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    );
};

const exportToICS = (month: number, year: number, choices: Choice[], columns: any[], userTrigram: string) => {
    const rawMyAssigned = choices.filter(c => 
        c.month === month && 
        c.year === year && 
        c.userTrigram === userTrigram && 
        c.status === 'ASSIGNED'
    );

    const myAssigned = rawMyAssigned.filter((a, index, self) => 
        index === self.findIndex((t) => t.row === a.row && t.col === a.col)
    );

    if (myAssigned.length === 0) {
        alert("Aucune garde assignée pour ce mois.");
        return;
    }

    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Planning Gardes//FR\r\n";

    myAssigned.forEach(choice => {
        const col = columns.find(c => c.id === choice.col);
        if (!col) return;

        const date = new Date(year, month, choice.row);
        const timeRange = parseTimeRange(col.timeRange);
        
        let startMins = 8 * 60;
        let endMins = 20 * 60;
        
        if (timeRange) {
            startMins = timeRange.start;
            endMins = timeRange.end;
        }

        const formatICSDate = (d: Date, totalMins: number) => {
            const pad = (n: number) => n.toString().padStart(2, '0');
            const actualDate = new Date(d);
            let actualHour = Math.floor(totalMins / 60);
            let actualMin = totalMins % 60;
            
            if (actualHour >= 24) {
                actualDate.setDate(actualDate.getDate() + 1);
                actualHour -= 24;
            }
            return `${actualDate.getFullYear()}${pad(actualDate.getMonth() + 1)}${pad(actualDate.getDate())}T${pad(actualHour)}${pad(actualMin)}00`;
        };

        const dtStart = formatICSDate(date, startMins);
        const dtEnd = formatICSDate(date, endMins);
        const summary = `Garde ${col.type || ''} - ${col.label || ''}`;

        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += `UID:${choice.id || Math.random().toString(36).substring(7)}@planning\r\n`;
        icsContent += `DTSTAMP:${formatICSDate(new Date(), new Date().getHours() * 60 + new Date().getMinutes())}Z\r\n`;
        icsContent += `DTSTART;TZID=Europe/Paris:${dtStart}\r\n`;
        icsContent += `DTEND;TZID=Europe/Paris:${dtEnd}\r\n`;
        icsContent += `SUMMARY:${summary}\r\n`;
        icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR\r\n";

    const filename = `gardes_${year}_${(month + 1).toString().padStart(2, '0')}.ics`;
    
    // Détection iOS et navigateur spécifique
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

    if (isIOS && isSafari) {
        // Safari iOS : l'URI de données fonctionne parfaitement pour forcer l'ouverture du Calendrier
        window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent);
    } else {
        // Chrome/Firefox sur iOS, Android, et PC : on force le téléchargement du fichier.
        // Sur Chrome iOS, cela va télécharger le fichier et proposer "Ouvrir dans..." en bas de l'écran.
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
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
  const prevChoicesCountRef = useRef<number>(-1);
  const prevCategoryRef = useRef<string>('');
  const clickTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
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
  const [showReproductionModal, setShowReproductionModal] = useState(false);
  const [reproductionStep, setReproductionStep] = useState<AppStep | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isConsultationMode, setIsConsultationMode] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState<any>(() => {
     try {
        return JSON.parse(localStorage.getItem('doctor_profile_TES') || 'null');
     } catch (e) {
        return null;
     }
  });

  // Exchange & Abandon state
  const [exchangeMode, setExchangeMode] = useState<'INACTIVE' | 'SELECT_OWN' | 'SELECT_TARGET'>('INACTIVE');
  const [takeMode, setTakeMode] = useState<'INACTIVE' | 'SELECT_TARGET'>('INACTIVE');
  const [myPendingAbandons, setMyPendingAbandons] = useState<any[]>([]);
  const [myPendingTakes, setMyPendingTakes] = useState<any[]>([]);
  const [showTakeConfirmModal, setShowTakeConfirmModal] = useState(false);
  const [isTakeSidebarOpen, setIsTakeSidebarOpen] = useState(false);
  const [isAbandonSidebarOpen, setIsAbandonSidebarOpen] = useState(false);
  
  const [selectedOwnChoice, setSelectedOwnChoice] = useState<Choice | null>(null);
  const [possibleTargetChoices, setPossibleTargetChoices] = useState<Choice[]>([]);
  const [selectedTargetChoice, setSelectedTargetChoice] = useState<Choice | null>(null);
  const [showExchangeConfirmModal, setShowExchangeConfirmModal] = useState(false);
  const [exchangeRules, setExchangeRules] = useState<any[]>([]);
  const [exchangeModes, setExchangeModes] = useState<Record<number, string>>({});
  const [myPendingExchanges, setMyPendingExchanges] = useState<any[]>([]);
  const [isExchangeSidebarOpen, setIsExchangeSidebarOpen] = useState(false);

  const [hoveredCell, setHoveredCell] = useState<{ day: number, month: number, year: number, colId: number, colLabel: string, colType: string } | null>(null);

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
     if (!activeRound) return "";
     if (currentStep === AppStep.NORMAL_SELECTION) return activeRound.instructions_normal;
     if (currentStep === AppStep.BAD_BONUS_SELECTION) return activeRound.instructions_bad_bonus;
     if (currentStep === AppStep.GOOD_BONUS_SELECTION) return activeRound.instructions_good_bonus;
     return "";
  }, [currentStep, activeRound]);

  const goToNextStep = () => {
      if (!activeRound) return;
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
      if (!activeRound) return;
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
        // 1. Check if the active round is still the same
        const { data: activeRounds } = await supabase.from('rounds').select('*').eq('is_active', true);
        const currentActiveRound = activeRounds && activeRounds.length > 0 ? activeRounds[0] : null;

        if (!currentActiveRound || currentActiveRound.id !== currentRoundId) {
            alert("ATTENTION : La configuration du tour a changé pendant votre saisie (un autre tour a été activé).\n\nVos choix actuels ne sont plus valides pour le tour en cours. Ils vont être supprimés et la page va s'actualiser pour charger la nouvelle configuration.");
            
            // Delete pending choices for this user as they are for the wrong round/config
            await supabase.from('choices').delete().eq('user_trigram', trigram.toUpperCase()).eq('status', 'PENDING');
            
            // Reset to login to force full refresh of config
            setViewMode(ViewMode.LOGIN);
            setTrigram('');
            setPassword('');
            setChoices([]);
            setIsDataSyncing(false);
            return;
        }

        const { data: rd } = await supabase.from('rounds').select('*').eq('id', currentRoundId).single();
        
        if (rd?.is_locked) {
            alert("La saisie est temporairement fermée par l'administrateur. Il n'est plus possible de transmettre des choix.");
            setRounds(prev => prev.map(r => r.id === rd.id ? { ...r, isLocked: true } : r));
            setIsDataSyncing(false);
            return;
        }
        if (currentUser?.role === 'DOCTOR' && !rd?.is_active_doctors) {
            alert("Le tour n'est plus ouvert aux titulaires. Il n'est plus possible de transmettre des choix.");
            setRounds(prev => prev.map(r => r.id === rd.id ? { ...r, isActiveDoctors: false } : r));
            setIsDataSyncing(false);
            return;
        }
        if (currentUser?.role === 'SUBSTITUTE' && !rd?.is_active_substitutes) {
            alert("Le tour n'est plus ouvert aux remplaçants. Il n'est plus possible de transmettre des choix.");
            setRounds(prev => prev.map(r => r.id === rd.id ? { ...r, isActiveSubstitutes: false } : r));
            setIsDataSyncing(false);
            return;
        }

        const gc = await fetchAll(supabase, 'global_closures');
        const { data: cfg } = await supabase.from('column_configs').select('*').eq('round_id', currentRoundId);
        const { data: sd } = await supabase.from('shift_definitions').select('*');
        const { data: sgs } = await supabase.from('shift_global_settings').select('*').eq('id', 1).single();
        const { data: unav } = await supabase.from('unavailabilities').select('*').eq('user_trigram', trigram.toUpperCase());
        const assigned = await fetchAll(supabase, 'choices', q => q.eq('status', 'ASSIGNED').eq('round_id', currentRoundId));
        
        const latestGlobalClosures = gc ? gc.map((g: any) => ({ ...g, month: g.month !== null ? g.month - 1 : null })) : [];
        const latestUnavailabilities = unav ? unav.map((u: any) => ({
            id: u.id, userTrigram: u.user_trigram, day: u.day, month: u.month - 1, year: u.year, period: u.period
        })) : [];
        const latestColumnConfigs = cfg || [];
        const latestShiftDefinitions = sd || [];
        const latestShiftGlobalSettings = sgs || null;
        const latestAssigned = assigned ? assigned.map(fromDb) : [];
        const maxOverlapMinutes = rd?.max_overlap_minutes || 0;

        const myPendingChoices = choices.filter(c => c.userTrigram === trigram.toUpperCase() && c.status === 'PENDING');
        const validChoices: Choice[] = [];
        const invalidChoices: Choice[] = [];

        for (const choice of myPendingChoices) {
            let isValid = true;
            
            // Check for overlaps with ALREADY ASSIGNED shifts for the SAME user
            const myAssignedSameDay = latestAssigned.filter(a => 
                a.userTrigram === trigram.toUpperCase() && 
                a.row === choice.row && 
                a.month === choice.month && 
                a.year === choice.year
            );

            const choiceTimeRange = choice.colTimeRange || COLUMNS.find(c => c.id === choice.col)?.timeRange;
            
            if (choiceTimeRange) {
                for (const assigned of myAssignedSameDay) {
                    const assignedTimeRange = assigned.colTimeRange || COLUMNS.find(c => c.id === assigned.col)?.timeRange;
                    if (assignedTimeRange && doRangesOverlap(choiceTimeRange, assignedTimeRange, maxOverlapMinutes)) {
                        isValid = false;
                        break;
                    }
                }
            }
            
            // Keep the check for "already assigned to someone else" as a hard constraint
            if (isValid && latestAssigned.some(c => c.row === choice.row && c.col === choice.col && c.month === choice.month && c.year === choice.year)) {
                isValid = false;
            }

            if (isValid) validChoices.push(choice);
            else invalidChoices.push(choice);
        }

        if (invalidChoices.length > 0) {
            const msg = `Certains de vos choix sont incompatibles avec des gardes qui vous ont déjà été attribuées ou ont été prises par d'autres praticiens.\n\n` +
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
        const { error: deleteError } = await supabase.from('choices').delete().eq('user_trigram', trigram.toUpperCase()).eq('status', 'PENDING');
        if (deleteError) throw deleteError;

        // Insert final choices
        if (finalChoices.length > 0) {
            const payload = finalChoices.map(c => ({
                id: generateId(), row: c.row, col: c.col, month: c.month + 1, year: c.year,
                group_index: c.groupIndex, sub_rank: c.subRank, category: c.category,
                user_trigram: c.userTrigram, user_role: c.userRole,
                status: c.status, submitted_at: c.submittedAt, round_id: c.roundId,
                col_label: c.colLabel, col_type: c.colType, col_time_range: c.colTimeRange
            }));
            const { error } = await supabase.from('choices').insert(payload);
            if (error) throw error;
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
    if (!activeRound) return { allowed: false, message: "Aucun tour n'est actif." };
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
            maxOverlapMinutes: r.max_overlap_minutes ?? 0,
        })).sort((a: any, b: any) => a.id - b.id));
        const { data: cfg } = await supabase.from('column_configs').select('*').eq('round_id', currentRoundId);
        if (cfg) setColumnConfigs(cfg);
        const { data: sd } = await supabase.from('shift_definitions').select('*');
        if (sd) setShiftDefinitions(sd);
        const { data: sgs } = await supabase.from('shift_global_settings').select('*').eq('id', 1).single();
        if (sgs) setShiftGlobalSettings(sgs);
        
        const { data: ud } = await supabase.from('users').select('*');
        if (ud) setUsers(ud);
        
        const gc = await fetchAll(supabase, 'global_closures');
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
    const data = await fetchAll(supabase, 'choices', q => q.neq('status', 'ARCHIVED').or(`user_trigram.eq.${tri.toUpperCase()},status.eq.ASSIGNED`));
      
    if (data) setChoices(data.map(fromDb));
    
    const { data: unav } = await supabase.from('unavailabilities').select('*').eq('user_trigram', tri.toUpperCase());
    if (unav) setUnavailabilities(unav.map((u: any) => ({
        id: u.id, userTrigram: u.user_trigram, day: u.day, month: u.month - 1, year: u.year, period: u.period
    })));

    // Fetch my pending exchanges
    const { data: myExchanges } = await supabase.from('exchange_requests')
      .select('*, requester_choice:choices!requester_choice_id(*)')
      .eq('requester_trigram', tri.toUpperCase())
      .eq('status', 'PENDING');
    if (myExchanges) setMyPendingExchanges(myExchanges);

    // Fetch my abandons (pending and approved)
    const { data: myAbandons } = await supabase.from('abandon_requests')
      .select('*, requester_choice:choices!choice_id(*)')
      .eq('requester_trigram', tri.toUpperCase())
      .in('status', ['PENDING', 'APPROVED']);
    if (myAbandons) setMyPendingAbandons(myAbandons);

    // Fetch my pending takes
    const { data: myTakes } = await supabase.from('take_requests')
      .select('*')
      .eq('requester_trigram', tri.toUpperCase())
      .eq('status', 'PENDING');
    if (myTakes) setMyPendingTakes(myTakes);

    // Load exchange rules
    const { data: rulesData } = await supabase.from('exchange_rules').select('*');
    if (rulesData) setExchangeRules(rulesData);
    
    const { data: modesData } = await supabase.from('exchange_modes').select('*');
    if (modesData) {
      const modesMap: Record<number, string> = {};
      modesData.forEach((m: any) => modesMap[m.col_id] = m.mode);
      setExchangeModes(modesMap);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent | null, targetMode: ViewMode = ViewMode.APP) => {
    if (e) e.preventDefault();
    const cleanTri = trigram.trim().toUpperCase();
    
    const { data: user } = await supabase.from('users').select('*').eq('trigram', cleanTri).single();
    if (user && (!user.password || user.password === password)) {
      await fetchChoices(cleanTri);
      if (user.role === 'ADMIN') {
        setViewMode(ViewMode.ADMIN);
      } else {
        setViewMode(targetMode);
      }
    } else {
      setLoginError('Identifiants invalides.');
    }
  };

  const handleReproduceChoices = () => {
    if (!reproductionStep) return;
    
    const sourceCategory = reproductionStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                           reproductionStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';
    
    const targetCategory = currentStep === AppStep.NORMAL_SELECTION ? 'normal' : 
                           currentStep === AppStep.GOOD_BONUS_SELECTION ? 'good_bonus' : 'bad_bonus';

    const sourceChoices = choices.filter(c => c.userTrigram === trigram.toUpperCase() && c.category === sourceCategory && c.status === 'PENDING');
    
    const currentCategoryChoices = choices.filter(c => c.userTrigram === trigram.toUpperCase() && c.category === targetCategory && c.status === 'PENDING');
    let maxGroupIndex = currentCategoryChoices.length > 0 ? Math.max(...currentCategoryChoices.map(c => c.groupIndex)) : 0;

    const newChoices: Choice[] = [];
    
    const groupedSourceChoices = sourceChoices.reduce((acc, choice) => {
        if (!acc[choice.groupIndex]) acc[choice.groupIndex] = [];
        acc[choice.groupIndex].push(choice);
        return acc;
    }, {} as Record<number, Choice[]>);

    const sortedGroupIndices = Object.keys(groupedSourceChoices).map(Number).sort((a, b) => a - b);
    
    for (const groupIndex of sortedGroupIndices) {
        const group = groupedSourceChoices[groupIndex].sort((a, b) => a.subRank - b.subRank);
        let hasAddedToGroup = false;
        let currentSubRank = 1;
        
        for (const choice of group) {
            if (isColOpen(choice.col, currentStep, choice.row, choice.month, choice.year)) {
                const alreadyExists = currentCategoryChoices.some(c => c.row === choice.row && c.col === choice.col && c.month === choice.month && c.year === choice.year);
                if (!alreadyExists) {
                    if (!hasAddedToGroup) {
                        maxGroupIndex++;
                        hasAddedToGroup = true;
                    }
                    newChoices.push({
                        ...choice,
                        id: crypto.randomUUID(),
                        category: targetCategory,
                        groupIndex: maxGroupIndex,
                        subRank: currentSubRank,
                        submittedAt: new Date().toISOString()
                    });
                    currentSubRank++;
                }
            }
        }
    }

    if (newChoices.length > 0) {
        setChoices(prev => [...prev, ...newChoices]);
        alert(`${newChoices.length} choix ont été reproduits avec succès.`);
    } else {
        alert("Aucun choix compatible n'a pu être reproduit.");
    }
    
    setShowReproductionModal(false);
    setReproductionStep(null);
  };

  const isColOpen = useCallback((colId: number, step: AppStep, day: number, month: number, year: number) => {
    const cfg = columnConfigs.find(c => c.column_id === colId);
    if (!cfg) return true;
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay(); 
    const type: 'w' | 's' | 'd' = (dayOfWeek === 0 || isPublicHoliday(date)) ? 'd' : (dayOfWeek === 6) ? 's' : 'w';
    
    // Safety check: In APP mode, if user or settings are not loaded yet, default to closed to prevent flashing open
    if ((viewMode === ViewMode.APP || viewMode === ViewMode.LIST_INPUT) && (!currentUser || !shiftGlobalSettings)) return false;

    if (currentUser && currentUser.role !== 'ADMIN' && shiftGlobalSettings) {
        const isDoctor = currentUser.role === 'DOCTOR';
        const isTargetActive = isDoctor ? 
            (step === AppStep.NORMAL_SELECTION ? shiftGlobalSettings.target_doctor_normal_active :
             step === AppStep.GOOD_BONUS_SELECTION ? shiftGlobalSettings.target_doctor_good_active :
             step === AppStep.BAD_BONUS_SELECTION ? shiftGlobalSettings.target_doctor_bad_active : false)
            : 
            (step === AppStep.NORMAL_SELECTION ? shiftGlobalSettings.target_substitute_normal_active :
             step === AppStep.GOOD_BONUS_SELECTION ? shiftGlobalSettings.target_substitute_good_active :
             step === AppStep.BAD_BONUS_SELECTION ? shiftGlobalSettings.target_substitute_bad_active : false);
        
        if (isTargetActive && shiftDefinitions.length > 0) {
            const matchingShifts = shiftDefinitions.filter(s => colId >= s.start_col && colId <= s.end_col);
            for (const shift of matchingShifts) {
                // Count how many guards are taken for this specific day within this shift range
                // MODIFIED: Count ALL ASSIGNED, ignore role, ignore PENDING
                const takenCount = choices.filter(c => 
                    c.row === day && c.month === month && c.year === year &&
                    c.col >= shift.start_col && c.col <= shift.end_col &&
                    c.status === 'ASSIGNED'
                ).length;
                
                const max = isDoctor ? shiftGlobalSettings.target_doctor_max : shiftGlobalSettings.target_substitute_max;
                if (takenCount >= max) return false;
            }
        }
    }

    if (step === AppStep.NORMAL_SELECTION) {
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
  }, [columnConfigs, currentUser, shiftDefinitions, shiftGlobalSettings, choices, viewMode]);

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

  // --- EFFECT: Auto-select lowest available priority when step/category changes ---
  useEffect(() => {
      if (viewMode !== ViewMode.APP && viewMode !== ViewMode.LIST_INPUT) return;
      
      // Calculate used priorities for current user and category
      const userChoices = choices.filter(c => 
          c.userTrigram === trigram.toUpperCase() && 
          c.category === category &&
          c.status === 'PENDING'
      );
      
      const usedPriorities = new Set(userChoices.map(c => c.groupIndex));
      
      // Find lowest available priority starting from 1
      let lowestAvailable = 1;
      while (usedPriorities.has(lowestAvailable)) {
          lowestAvailable++;
      }
      
      // Only update when entering the step/category to set the initial "cursor".
      // We DO NOT include 'choices' in the dependency array because we don't want to 
      // auto-jump to the next priority immediately after the user makes a choice.
      // This allows the user to add alternatives (1.1, 1.2) to the current priority naturally.
      setActivePriority(lowestAvailable);
      
  }, [currentStep, category, viewMode]);

  // --- EFFECT: Auto-select lowest available priority when a choice is removed ---
  useEffect(() => {
      if (viewMode !== ViewMode.APP && viewMode !== ViewMode.LIST_INPUT) return;
      
      const userChoices = choices.filter(c => 
          c.userTrigram === trigram.toUpperCase() && 
          c.category === category &&
          c.status === 'PENDING'
      );
      
      if (category === prevCategoryRef.current && prevChoicesCountRef.current !== -1 && userChoices.length < prevChoicesCountRef.current) {
          // A choice was removed within the same category
          const usedPriorities = new Set(userChoices.map(c => c.groupIndex));
          let lowestAvailable = 1;
          while (usedPriorities.has(lowestAvailable)) {
              lowestAvailable++;
          }
          setActivePriority(lowestAvailable);
      }
      
      prevChoicesCountRef.current = userChoices.length;
      prevCategoryRef.current = category;
  }, [choices, category, trigram, viewMode]);



  const handleAIChoices = useCallback(async (suggestions: any[]) => {
      const newChoices: Choice[] = [];
      const user = users.find(u => u.trigram === trigram.toUpperCase());
      if (!user) return;

      const currentRound = rounds.find(r => r.id === currentRoundId);
      const maxOverlapMinutes = currentRound?.maxOverlapMinutes || 0;

      for (const s of suggestions) {
          const month = s.month !== undefined ? s.month : (monthsToDisplay[0]?.month || 0);
          const year = s.year !== undefined ? s.year : (monthsToDisplay[0]?.year || new Date().getFullYear());
          const row = s.day;
          const colId = s.columnId;
          const assignedCategory = s.category || category; // Fallback ou fourni par IA
          
          const colConfig = columnConfigs.find(c => c.column_id === colId);
          const baseColDef = COLUMNS.find(c => c.id === colId);
          if(!baseColDef) continue;
          
          const finalLabel = colConfig?.custom_label || baseColDef.label;
          const finalType = colConfig?.custom_type || baseColDef.type;
          const finalTimeRange = colConfig?.custom_time_range || baseColDef.timeRange;

          const targetPriority = s.priority || activePriority;

          // Check if we need to assign a subRank to this priority group
          const existingInGroup = [...choices, ...newChoices].filter(c => 
              c.status === 'PENDING' &&
              c.userTrigram === user.trigram && 
              c.category === assignedCategory && 
              c.groupIndex === targetPriority
          );
          
          let nextSubRank = 1;
          if (existingInGroup.length > 0) {
              nextSubRank = Math.max(...existingInGroup.map(c => c.subRank)) + 1;
          }

          if (nextSubRank > 27) continue;

          if (nextSubRank === 1) {
              const assignedSameDay = [...choices, ...newChoices].filter(c => 
                  c.userTrigram === user.trigram && 
                  c.row === row && 
                  c.month === month && 
                  c.year === year &&
                  c.status === 'ASSIGNED'
              );
              
              let overlapFound = false;
              for (const assignedChoice of assignedSameDay) {
                  const existingTimeRange = assignedChoice.colTimeRange || COLUMNS.find(c => c.id === assignedChoice.col)?.timeRange;
                  if (existingTimeRange && doRangesOverlap(finalTimeRange, existingTimeRange, maxOverlapMinutes)) {
                      overlapFound = true;
                      break;
                  }
              }
              if (overlapFound) continue; 
          }

          const choice: Choice = {
              id: generateId(),
              row, col: colId, month, year,
              groupIndex: targetPriority, 
              subRank: nextSubRank, 
              category: assignedCategory,
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
  }, [users, trigram, activePriority, category, currentRoundId, columnConfigs, monthsToDisplay, choices]);

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

  const computePossibleTargets = useCallback((ownChoice: Choice) => {
    // 1. Determine period of ownChoice
    const d = new Date(ownChoice.year, ownChoice.month, ownChoice.row);
    const dayOfWeek = d.getDay();
    const isHoliday = isPublicHoliday(d);
    let sourcePeriod: 'SEMAINE' | 'SAMEDI' | 'DIMANCHE' = 'SEMAINE';
    if (dayOfWeek === 0 || isHoliday) sourcePeriod = 'DIMANCHE';
    else if (dayOfWeek === 6) sourcePeriod = 'SAMEDI';

    // 2. Find matching rules
    const mode = exchangeModes[ownChoice.col] || 'GLOBAL';
    const activePeriod = mode === 'GLOBAL' ? 'GLOBAL' : sourcePeriod;
    
    const validRules = exchangeRules.filter(r => 
      r.source_col_id === ownChoice.col && 
      r.source_period === activePeriod
    );

    // 3. Find all EMPTY cells that match the rules and are not closed
    const possibleTargets: any[] = [];

    monthsToDisplay.forEach(({ month, year }) => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const targetDate = new Date(year, month, day);
        
        // Skip target dates that are in the past or less than 48h away
        const now = new Date();
        const diffHours = (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffHours < 48) {
            continue;
        }

        const targetDayOfWeek = targetDate.getDay();
        const targetIsHoliday = isPublicHoliday(targetDate);
        let targetPeriod: 'SEMAINE' | 'SAMEDI' | 'DIMANCHE' = 'SEMAINE';
        if (targetDayOfWeek === 0 || targetIsHoliday) targetPeriod = 'DIMANCHE';
        else if (targetDayOfWeek === 6) targetPeriod = 'SAMEDI';

        dynamicColumns.forEach(col => {
          // Check if rule exists for this target col and period
          const isValidRule = validRules.some(r => r.target_col_id === col.id && r.target_period === targetPeriod);
          if (!isValidRule) return;

          // Check if cell is globally closed or closed by config
          const isClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
          const open = isColOpen(col.id, currentStep, day, month, year) && !isClosed;
          if (!open) return;

          // Check if cell is already assigned to ANYONE
          const isAssigned = choices.some(c => c.row === day && c.col === col.id && c.month === month && c.year === year && c.status === 'ASSIGNED');
          if (isAssigned) return;

          // Check if cell is already targeted by me in another pending exchange
          const isAlreadyTargetedByMe = myPendingExchanges.some(ex => ex.target_row === day && ex.target_col === col.id && ex.target_month === month && ex.target_year === year);
          if (isAlreadyTargetedByMe) return;

          possibleTargets.push({
            id: `empty-${day}-${month}-${year}-${col.id}`,
            row: day,
            col: col.id,
            month,
            year,
            colLabel: col.label
          });
        });
      }
    });

    setPossibleTargetChoices(possibleTargets);
  }, [choices, exchangeRules, exchangeModes, trigram, currentRoundId, globalClosures, monthsToDisplay, dynamicColumns, isColOpen, currentStep, myPendingExchanges]);

  const handleCellClick = useCallback(async (row: number, colId: number, month: number, year: number, isDoubleClick: boolean = false, explicitPriority?: number) => {
    if (exchangeMode !== 'INACTIVE') {
        const clickedAssigned = choices.find(c => c.row === row && c.col === colId && c.month === month && c.year === year && c.status === 'ASSIGNED');

        if (exchangeMode === 'SELECT_OWN') {
            if (clickedAssigned && clickedAssigned.userTrigram === trigram.toUpperCase()) {
                const theDate = new Date(year, month, row, 0, 0, 0); // month is JS 0-indexed month
                const now = new Date();
                const diffHours = (theDate.getTime() - now.getTime()) / (1000 * 60 * 60);

                if (diffHours < 48) {
                    alert("Appeler le standard SOS92 car la demande est à moins de 48 heures de la garde.");
                    return;
                }

                const existingPending = myPendingExchanges.find(ex => ex.requester_choice_id === clickedAssigned.id);
                if (existingPending) {
                    if (!window.confirm("Vous avez déjà une demande d'échange en attente pour cette garde. Voulez-vous la remplacer par une nouvelle demande ? L'ancienne sera supprimée.")) {
                        return;
                    }
                }
                setSelectedOwnChoice(clickedAssigned);
                setExchangeMode('SELECT_TARGET');
                computePossibleTargets(clickedAssigned);
            }
        } else if (exchangeMode === 'SELECT_TARGET') {
            if (clickedAssigned && clickedAssigned.userTrigram === trigram.toUpperCase()) {
                const existingPending = myPendingExchanges.find(ex => ex.requester_choice_id === clickedAssigned.id);
                if (existingPending) {
                    if (!window.confirm("Vous avez déjà une demande d'échange en attente pour cette garde. Voulez-vous la remplacer par une nouvelle demande ? L'ancienne sera supprimée.")) {
                        return;
                    }
                }
                setSelectedOwnChoice(clickedAssigned);
                computePossibleTargets(clickedAssigned);
            } else if (possibleTargetChoices.some(c => c.row === row && c.col === colId && c.month === month && c.year === year)) {
                const target = possibleTargetChoices.find(c => c.row === row && c.col === colId && c.month === month && c.year === year);
                setSelectedTargetChoice(target);
                setShowExchangeConfirmModal(true);
            } else if (myPendingExchanges.some(ex => ex.target_row === row && ex.target_col === colId && ex.target_month === month && ex.target_year === year)) {
                alert("Vous avez déjà une demande d'échange en attente pour récupérer cette garde.");
            }
        }
        return;
    }

    if (takeMode === 'SELECT_TARGET') {
        const isAssigned = choices.some(c => c.row === row && c.col === colId && c.month === month && c.year === year && c.status === 'ASSIGNED');
        if (isAssigned) {
            alert("Cette garde est déjà assignée.");
            return;
        }
        
        const isClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
        if (isClosed || !isColOpen(colId, currentStep, row, month, year)) {
            alert("Cette garde n'est pas ouverte.");
            return;
        }

        const existingPending = myPendingTakes.find(tk => tk.target_row === row && tk.target_col === colId && tk.target_month === month && tk.target_year === year);
        if (existingPending) {
            alert("Vous avez déjà une demande de prise de garde en attente pour cette date.");
            return;
        }

        const colConfig = columnConfigs.find(c => c.column_id === colId);
        const colDef = COLUMNS.find(c => c.id === colId);
        const colLabel = colConfig?.custom_label || colDef?.label || '';

        setSelectedTargetChoice({
            id: `empty-take-${row}-${month}-${year}-${colId}`,
            row, col: colId, month, year, colLabel, colType: colDef?.type || '', colTimeRange: colDef?.timeRange || '',
            userId: currentUser?.id || '', userTrigram: trigram.toUpperCase(), status: 'PENDING', submittedAt: '', roundId: currentRoundId, category: 'normal'
        });
        setShowTakeConfirmModal(true);
        return;
    }

    if (!accessStatus.allowed || currentStep === AppStep.RECAP_ORDERING || isConsultationMode) return;

    const cleanTri = trigram.trim().toUpperCase();
    const existing = choices.find(c => c.row === row && c.col === colId && c.month === month && c.year === year && c.userTrigram === cleanTri && c.category === category);
    
    if (existing) {
       if (isDoubleClick) return;
       if (existing.status === 'ASSIGNED') {
           alert("Impossible de modifier une garde validée. Veuillez contacter l'administrateur.");
           return;
       }
       
       // REMOVAL LOGIC WITH RE-RANKING
       setChoices(prev => {
           const remaining = prev.filter(c => c.id !== existing.id);
           
           // Case 1: Removing an alternative (subRank > 1)
           // Just shift up the subRanks of subsequent alternatives in the same group
           if (existing.subRank > 1) {
               return remaining.map(c => {
                   if (c.status === 'PENDING' && c.userTrigram === cleanTri && c.category === category && c.groupIndex === existing.groupIndex && c.subRank > existing.subRank) {
                       return { ...c, subRank: c.subRank - 1 };
                   }
                   return c;
               });
           }
           
           // Case 2: Removing a main choice (subRank === 1)
           // Check if there are alternatives in this group
           const alternatives = remaining.filter(c => c.status === 'PENDING' && c.userTrigram === cleanTri && c.category === category && c.groupIndex === existing.groupIndex);
           
           if (alternatives.length > 0) {
               // Promote the first alternative (subRank 2) to be the new main choice (subRank 1)
               // and shift others accordingly
               return remaining.map(c => {
                   if (c.status === 'PENDING' && c.userTrigram === cleanTri && c.category === category && c.groupIndex === existing.groupIndex) {
                       return { ...c, subRank: c.subRank - 1 };
                   }
                   return c;
               });
           } else {
               // No alternatives left in this group. The group is now empty.
               // We must shift down the groupIndex of all subsequent groups to fill the gap.
               // e.g. Group 1 removed -> Group 2 becomes Group 1, Group 3 becomes Group 2...
               return remaining.map(c => {
                   if (c.status === 'PENDING' && c.userTrigram === cleanTri && c.category === category && c.groupIndex > existing.groupIndex) {
                       return { ...c, groupIndex: c.groupIndex - 1 };
                   }
                   return c;
               });
           }
       });
       return;
    }

    // Removed strict blocking for unavailabilities as per user request
    // Only block if cell is ALREADY assigned to someone else
    const assignedToOther = choices.find(c => c.row === row && c.col === colId && c.month === month && c.year === year && c.status === 'ASSIGNED' && c.userTrigram !== cleanTri);
    if (assignedToOther) {
        return; 
    }

    // Block if cell is closed (either by global closure or round config)
    const isClosed = globalClosures.some((gc: any) => gc.col_id === colId && gc.row === row && gc.month === month && gc.year === year);
    const open = isColOpen(colId, currentStep, row, month, year) && !isClosed;
    
    if (!open) {
        return; // Cell is closed for this round/step or globally
    }

    if (isBlockedByUnavailability(row, colId, month, year)) {
        return; // Cell is blocked by user's unavailability
    }

    let targetGroupIndex = explicitPriority !== undefined ? explicitPriority : activePriority;
    let nextSubRank = 1;

    if (isDoubleClick && explicitPriority === undefined) {
        const userPendingChoices = choices.filter(c => c.status === 'PENDING' && c.userTrigram === cleanTri && c.category === category);
        const maxGroupIndex = userPendingChoices.length > 0 ? Math.max(...userPendingChoices.map(c => c.groupIndex)) : 0;
        targetGroupIndex = maxGroupIndex + 1;
        setActivePriority(targetGroupIndex);
    } else {
        const existingInGroup = choices.filter(c => c.status === 'PENDING' && c.userTrigram === cleanTri && c.category === category && c.groupIndex === targetGroupIndex);
        if (existingInGroup.length > 0) nextSubRank = Math.max(...existingInGroup.map(c => c.subRank)) + 1;
        if (nextSubRank > 27) { alert("Limite atteinte : Max 26 alternatives."); return; }
    }

    const baseColDef = COLUMNS.find(c => c.id === colId);
    const colConfig = columnConfigs.find(c => c.column_id === colId);
    const finalLabel = colConfig?.custom_label || baseColDef?.label || '';
    const finalType = colConfig?.custom_type || baseColDef?.type || '';
    const finalTimeRange = colConfig?.custom_time_range || baseColDef?.timeRange || '';

    const currentRound = rounds.find(r => r.id === currentRoundId);
    const maxOverlapMinutes = currentRound?.maxOverlapMinutes || 0;

    if (baseColDef) {
        // Check specifically for overlaps with ALREADY ASSIGNED shifts for the SAME user
        const assignedSameDay = choices.filter(c => c.userTrigram === cleanTri && c.row === row && c.month === month && c.year === year && c.status === 'ASSIGNED');
        
        for (const assignedChoice of assignedSameDay) {
            const existingTimeRange = assignedChoice.colTimeRange || COLUMNS.find(c => c.id === assignedChoice.col)?.timeRange;
            if (existingTimeRange && doRangesOverlap(finalTimeRange, existingTimeRange, maxOverlapMinutes)) {
                alert(`⚠️ ACTION BLOQUÉE : Une garde vous a déjà été attribuée sur des horaires incompatibles (${existingTimeRange}).`);
                return;
            }
        }
    }

    const newChoice: Choice = {
        id: generateId(), row, col: colId, month, year,
        groupIndex: targetGroupIndex, subRank: nextSubRank, category, 
        userTrigram: cleanTri, userRole: currentUser?.role || 'DOCTOR',
        status: 'PENDING', submittedAt: new Date().toISOString(), roundId: currentRoundId,
        colLabel: finalLabel, colType: finalType, colTimeRange: finalTimeRange
    };
    
    setChoices(prev => [...prev, newChoice]);
  }, [choices, currentStep, trigram, currentRoundId, isColOpen, isBlockedByUnavailability, currentUser, accessStatus, activePriority, category, columnConfigs, globalClosures, exchangeMode, possibleTargetChoices, selectedOwnChoice, selectedTargetChoice, computePossibleTargets, myPendingAbandons, myPendingExchanges, setShowExchangeConfirmModal, setSelectedTargetChoice, setExchangeMode, setSelectedOwnChoice, isConsultationMode, takeMode, myPendingTakes, setShowTakeConfirmModal, COLUMNS]);

  const displayedAbandons = useMemo(() => {
    return myPendingAbandons.filter(ab => {
        let m: number;
        let y: number;
        if (ab.requester_choice) {
            m = ab.requester_choice.month - 1; 
            y = ab.requester_choice.year;
        } else if (ab.shift_snapshot) {
            m = ab.shift_snapshot.month - 1; 
            y = ab.shift_snapshot.year;
        } else {
            return false;
        }
        return monthsToDisplay.some(md => md.month === m && md.year === y);
    });
  }, [myPendingAbandons, monthsToDisplay]);

  const handleExchangeConfirm = async () => {
    if (!selectedOwnChoice || !selectedTargetChoice) return;
    
    try {
      const existingPending = myPendingExchanges.find(ex => ex.requester_choice_id === selectedOwnChoice.id);
      if (existingPending) {
         await supabase.from('exchange_requests').delete().eq('id', existingPending.id);
      }

      const { error } = await supabase.from('exchange_requests').insert({
        round_id: currentRoundId,
        requester_trigram: trigram.toUpperCase(),
        requester_choice_id: selectedOwnChoice.id,
        target_row: selectedTargetChoice.row,
        target_col: selectedTargetChoice.col,
        target_month: selectedTargetChoice.month,
        target_year: selectedTargetChoice.year,
        target_col_label: selectedTargetChoice.colLabel,
        status: 'PENDING'
      });
      
      if (error) throw error;
      
      alert("Votre demande d'échange a été envoyée à l'administrateur.");
      
      // Refresh my pending exchanges
      const { data: myExchanges } = await supabase.from('exchange_requests')
        .select('*, requester_choice:choices!requester_choice_id(*)')
        .eq('requester_trigram', trigram.toUpperCase())
        .eq('status', 'PENDING');
      if (myExchanges) setMyPendingExchanges(myExchanges);

      setExchangeMode('INACTIVE');
      setSelectedOwnChoice(null);
      setSelectedTargetChoice(null);
      setShowExchangeConfirmModal(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'envoi de la demande d'échange.");
    }
  };

  const handleTakeConfirm = async () => {
    if (!selectedTargetChoice) return;
    try {
        const { error } = await supabase.from('take_requests').insert({
            round_id: currentRoundId,
            requester_trigram: trigram.toUpperCase(),
            target_row: selectedTargetChoice.row,
            target_col: selectedTargetChoice.col,
            target_month: selectedTargetChoice.month,
            target_year: selectedTargetChoice.year,
            target_col_label: selectedTargetChoice.colLabel,
            status: 'PENDING'
        });

        if (error) throw error;
        
        alert("Votre demande de prise de garde a été envoyée à l'administrateur.");

        // Refresh my takes
        const { data: myTakes } = await supabase.from('take_requests')
          .select('*')
          .eq('requester_trigram', trigram.toUpperCase())
          .eq('status', 'PENDING');
        if (myTakes) setMyPendingTakes(myTakes);

        setTakeMode('INACTIVE');
        setSelectedTargetChoice(null);
        setShowTakeConfirmModal(false);
    } catch (err) {
        console.error(err);
        alert("Une erreur est survenue lors de la demande.");
    }
  };

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
        <form onSubmit={(e) => handleLogin(e, ViewMode.APP)} className="bg-white p-12 rounded-[60px] shadow-2xl w-full max-w-sm space-y-8 border-t-[12px] border-slate-900">
          <div className="text-center"><h1 className="text-4xl font-black tracking-tighter uppercase mb-2">SOS 92</h1></div>
          {loginError && <div className="p-3 bg-red-50 text-red-500 rounded-2xl text-[10px] font-bold text-center uppercase">{loginError}</div>}
          <div className="space-y-4">
            <input type="text" placeholder="Trigramme" value={trigram} onChange={e => setTrigram(e.target.value)} className="w-full p-5 bg-slate-50 border rounded-3xl font-black uppercase text-center text-2xl outline-none" maxLength={3} />
            <input type="password" placeholder="Code secret" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-slate-50 border rounded-3xl font-black text-center text-2xl outline-none" />
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={(e) => handleLogin(e, ViewMode.APP)} className="w-full bg-slate-900 text-white p-4 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all text-sm">Saisie via Planning</button>
            <button type="button" onClick={(e) => handleLogin(e, ViewMode.LIST_INPUT)} className="w-full bg-blue-600 text-white p-4 rounded-3xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all text-sm">Saisie via Liste</button>
          </div>
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
      {isDataSyncing && <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 z-[100] animate-pulse"></div>}
      
      {!accessStatus.allowed && !isConsultationMode && (
        <div className="absolute inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Accès Restreint</h2>
                <p className="text-slate-400 font-bold leading-relaxed">{accessStatus.message}</p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => setIsConsultationMode(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20">Consulter le planning attribué</button>
                    <button onClick={() => setViewMode(ViewMode.LOGIN)} className="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-black uppercase tracking-widest hover:bg-white/20 transition-all">Retourner à l'accueil</button>
                </div>
            </div>
        </div>
      )}

      {showExchangeConfirmModal && selectedOwnChoice && selectedTargetChoice && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-xl font-black uppercase text-slate-900 mb-4">Confirmer l'échange</h3>
                <p className="text-sm text-slate-600 mb-6">
                    Vous êtes sur le point de proposer un échange :
                </p>
                <div className="space-y-4 mb-8">
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                        <div className="text-[10px] font-black text-orange-500 uppercase mb-1">Vous cédez :</div>
                        <div className="font-bold text-slate-900 text-sm">
                            {formatRequestDate(selectedOwnChoice.row, selectedOwnChoice.month, selectedOwnChoice.year, selectedOwnChoice.col, selectedOwnChoice.colLabel, false, columnConfigs)}
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
                        </div>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="text-[10px] font-black text-blue-500 uppercase mb-1">Vous récupérez :</div>
                        <div className="font-bold text-slate-900 text-sm">
                            {formatRequestDate(selectedTargetChoice.row, selectedTargetChoice.month, selectedTargetChoice.year, selectedTargetChoice.col, selectedTargetChoice.colLabel, false, columnConfigs)}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => {
                            setShowExchangeConfirmModal(false);
                            setSelectedTargetChoice(null);
                        }} 
                        className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleExchangeConfirm} 
                        className="flex-1 py-3 bg-blue-600 text-white text-sm font-black uppercase rounded-xl hover:bg-blue-700 shadow-lg transition-colors"
                    >
                        Confirmer
                    </button>
                </div>
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

      {showReproductionModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border">
                <div className="p-6 border-b bg-slate-50">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reproduire mes choix</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Sélectionnez l'étape dont vous souhaitez reproduire les choix.</p>
                </div>
                <div className="p-6 space-y-4">
                    {currentStep > AppStep.NORMAL_SELECTION && (
                        <button 
                            onClick={() => setReproductionStep(AppStep.NORMAL_SELECTION)}
                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${reproductionStep === AppStep.NORMAL_SELECTION ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                        >
                            <div className="font-black text-slate-900 uppercase">Étape 1</div>
                            <div className="text-xs text-slate-500 font-medium">Garde cible</div>
                        </button>
                    )}
                    {currentStep > AppStep.GOOD_BONUS_SELECTION && (
                        <button 
                            onClick={() => setReproductionStep(AppStep.GOOD_BONUS_SELECTION)}
                            className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${reproductionStep === AppStep.GOOD_BONUS_SELECTION ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
                        >
                            <div className="font-black text-slate-900 uppercase">Étape 2</div>
                            <div className="text-xs text-slate-500 font-medium">Bonne garde</div>
                        </button>
                    )}
                </div>
                <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={() => {
                            setShowReproductionModal(false);
                            setReproductionStep(null);
                        }}
                        className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleReproduceChoices}
                        disabled={!reproductionStep}
                        className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        Valider
                    </button>
                </div>
            </div>
        </div>
      )}

      {!isConsultationMode && <RoundInfo round={activeRound} stepInstruction={currentStepInstruction} />}
      
      <header className="bg-white border-b px-4 h-[72px] flex items-center justify-between z-30 shrink-0 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-6">
            {!isConsultationMode && <StepProgressBar currentStep={currentStep} round={activeRound} />}
            {isConsultationMode && (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Consultation Planning</h1>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Mode Lecture Seule</p>
                    </div>
                </div>
            )}
        </div>
        <div className="flex items-center gap-4">
            {currentUser?.role !== 'ADMIN' && (
                <div className="flex items-center gap-2">
                    {activeRound?.allow_exchanges && isConsultationMode && takeMode === 'INACTIVE' && (
                        <>
                        <button 
                            onClick={() => {
                                if (exchangeMode === 'INACTIVE') {
                                    setExchangeMode('SELECT_OWN');
                                    setSelectedOwnChoice(null);
                                    setPossibleTargetChoices([]);
                                    setTakeMode('INACTIVE');
                                } else {
                                    setExchangeMode('INACTIVE');
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${exchangeMode !== 'INACTIVE' ? 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600' : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-500 hover:text-white'}`}
                        >
                            <span className="hidden md:inline">{exchangeMode !== 'INACTIVE' ? 'Annuler l\'échange' : 'Échanger une garde'}</span>
                            <span className="md:hidden">Échanger</span>
                        </button>
                        {exchangeMode === 'INACTIVE' && (
                           <button 
                               onClick={() => setIsExchangeSidebarOpen(true)}
                               className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${myPendingExchanges.length > 0 ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                           >
                               <span className="hidden md:inline">Mes Échanges ({myPendingExchanges.length})</span>
                               <span className="md:hidden">Échanges ({myPendingExchanges.length})</span>
                           </button>
                        )}
                        </>
                    )}

                    {activeRound?.allow_takes && isConsultationMode && exchangeMode === 'INACTIVE' && (
                        <>
                        <button 
                            onClick={() => {
                                if (takeMode === 'INACTIVE') {
                                    setTakeMode('SELECT_TARGET');
                                    setExchangeMode('INACTIVE');
                                } else {
                                    setTakeMode('INACTIVE');
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${takeMode !== 'INACTIVE' ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600' : 'bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-500 hover:text-white'}`}
                        >
                            <span className="hidden md:inline">{takeMode !== 'INACTIVE' ? 'Annuler la prise' : 'Prendre une garde'}</span>
                            <span className="md:hidden">Prendre</span>
                        </button>
                        {takeMode === 'INACTIVE' && (
                           <button 
                               onClick={() => setIsTakeSidebarOpen(true)}
                               className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${myPendingTakes.length > 0 ? 'bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                           >
                               <span className="hidden md:inline">Mes Prises ({myPendingTakes.length})</span>
                               <span className="md:hidden">Prises ({myPendingTakes.length})</span>
                           </button>
                        )}
                        </>
                    )}

                    {activeRound?.allow_exchanges && isConsultationMode && exchangeMode === 'INACTIVE' && takeMode === 'INACTIVE' && (
                        <>
                           <button 
                               onClick={() => setIsAbandonSidebarOpen(true)}
                               className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${displayedAbandons.length > 0 ? 'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                           >
                               <span className="hidden md:inline">Mes Abandons ({displayedAbandons.length})</span>
                               <span className="md:hidden">Abandons ({displayedAbandons.length})</span>
                           </button>
                        </>
                    )}

                    {!isConsultationMode && (
                        <button 
                            onClick={() => setViewMode(viewMode === ViewMode.APP ? ViewMode.LIST_INPUT : ViewMode.APP)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all shadow-sm whitespace-nowrap"
                        >
                            <span className="hidden md:inline">{viewMode === ViewMode.APP ? 'Saisie via Liste' : 'Saisie via Planning'}</span>
                            <span className="md:hidden">{viewMode === ViewMode.APP ? 'Liste' : 'Planning'}</span>
                        </button>
                    )}

                    {(viewMode === ViewMode.APP || isConsultationMode) && exchangeMode === 'INACTIVE' && takeMode === 'INACTIVE' && (
                        <button 
                            onClick={() => {
                                setIsConsultationMode(!isConsultationMode);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm whitespace-nowrap ${isConsultationMode ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white'}`}
                        >
                            <span className="hidden md:inline">{isConsultationMode ? 'Retour à la saisie' : 'Consulter le planning'}</span>
                            <span className="md:hidden">Planning</span>
                        </button>
                    )}

                    {!isConsultationMode && currentStep !== AppStep.RECAP_ORDERING && (
                        <button 
                            onClick={() => setShowUnavailabilityModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm whitespace-nowrap"
                        >
                            <span className="hidden md:inline">Gérer mes indisponibilités</span>
                            <span className="md:hidden">Indispo</span>
                        </button>
                    )}
                </div>
            )}

          {exchangeMode === 'INACTIVE' && (
              <>
                  <div className="text-right hidden sm:block">
                    <div className="text-[12px] font-black uppercase text-slate-900">{trigram.toUpperCase()}</div>
                    <div className={`text-[7px] font-black uppercase tracking-widest ${currentUser?.role === 'SUBSTITUTE' ? 'text-orange-600' : 'text-blue-600'}`}>
                      {currentUser?.role === 'SUBSTITUTE' ? 'Remplaçant' : 'Titulaire'}
                    </div>
                  </div>
                  
                  {!isConsultationMode && currentStep > AppStep.NORMAL_SELECTION && (
                     <button onClick={goToPrevStep} className="hidden md:block px-6 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all whitespace-nowrap">Précédent</button>
                  )}

                  {!isConsultationMode && (currentStep < AppStep.RECAP_ORDERING ? (
                      <button onClick={goToNextStep} className="hidden md:block px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 shadow-lg whitespace-nowrap">Suivant</button>
                  ) : (
                      <button onClick={handleFinalValidation} className="hidden md:block px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 shadow-lg whitespace-nowrap transition-all animate-pulse">Valider mes choix</button>
                  ))}
                  <button onClick={() => setViewMode(ViewMode.LOGIN)} className="p-2 text-slate-300 hover:text-red-500"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5"/></svg></button>
              </>
          )}
        </div>
      </header>

      {takeMode !== 'INACTIVE' && (
          <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row items-center justify-center gap-4 shadow-lg z-40 shrink-0">
              {takeMode === 'SELECT_TARGET' && (
                  <div className="font-bold flex items-center gap-3 text-sm">
                      <span className="w-3 h-3 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.5)]"></span>
                      Sélectionnez une garde vide et ouverte sur le planning pour la prendre
                  </div>
              )}
          </div>
      )}

      {/* Exchange Banner */}
      {exchangeMode !== 'INACTIVE' && (
          <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row items-center justify-center gap-4 shadow-lg z-40 shrink-0">
              {exchangeMode === 'SELECT_OWN' && (
                  <div className="font-bold flex items-center gap-3 text-sm">
                      <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.5)]"></span>
                      Sélectionnez l'une de vos gardes (en jaune) à échanger
                  </div>
              )}
              {exchangeMode === 'SELECT_TARGET' && selectedOwnChoice && (
                  <>
                      <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
                          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center font-black shadow-inner text-white">
                              {selectedOwnChoice.row}
                          </div>
                          <div className="pr-2">
                              <div className="text-[10px] text-slate-400 font-black uppercase">Vous cédez</div>
                              <div className="font-bold text-sm text-white">
                                  {formatRequestDate(selectedOwnChoice.row, selectedOwnChoice.month, selectedOwnChoice.year, selectedOwnChoice.col, selectedOwnChoice.colLabel, false, columnConfigs)}
                              </div>
                          </div>
                      </div>
                      
                      <div className="text-slate-500 hidden md:block">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/30 border-dashed">
                          {selectedTargetChoice ? (
                              <>
                                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-black shadow-inner text-white">
                                      {selectedTargetChoice.row}
                                  </div>
                                  <div className="pr-2">
                                      <div className="text-[10px] text-blue-400 font-black uppercase">Vous récupérez</div>
                                      <div className="font-bold text-sm text-blue-300">
                                          {formatRequestDate(selectedTargetChoice.row, selectedTargetChoice.month, selectedTargetChoice.year, selectedTargetChoice.col, selectedTargetChoice.colLabel, false, columnConfigs)}
                                      </div>
                                  </div>
                              </>
                          ) : (
                              <>
                                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                  </div>
                                  <div className="pr-2">
                                      <div className="text-[10px] text-blue-400 font-black uppercase">Vous récupérez</div>
                                      <div className="font-bold text-sm text-blue-300">Sélectionnez une garde bleue</div>
                                  </div>
                              </>
                          )}
                      </div>
                      
                      <button 
                          onClick={() => {
                              setExchangeMode('SELECT_OWN');
                              setSelectedOwnChoice(null);
                              setPossibleTargetChoices([]);
                          }}
                          className="ml-auto px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-white"
                      >
                          Annuler
                      </button>
                  </>
              )}
          </div>
      )}

      {/* Mobile Bottom Navigation */}
      {!isConsultationMode && viewMode !== ViewMode.LOGIN && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-between items-center z-[90] shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] pb-safe">
            {currentStep > AppStep.NORMAL_SELECTION ? (
                <button onClick={goToPrevStep} className="flex-1 py-3.5 mr-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase active:bg-slate-200 transition-colors text-center shadow-sm">Précédent</button>
            ) : <div className="flex-1 mr-2"></div>}

            {currentStep < AppStep.RECAP_ORDERING ? (
                <button onClick={goToNextStep} className="flex-1 py-3.5 ml-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase active:bg-blue-700 shadow-md text-center transition-colors">Suivant</button>
            ) : (
                <button onClick={handleFinalValidation} className="flex-1 py-3.5 ml-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase active:bg-emerald-700 shadow-md transition-colors animate-pulse text-center">Valider</button>
            )}
        </div>
      )}

      {currentStep !== AppStep.RECAP_ORDERING && !isConsultationMode && viewMode !== ViewMode.LIST_INPUT && (
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
            
            <div className="flex items-center gap-4">
                {activeRound?.allow_choice_reproduction && currentStep > AppStep.NORMAL_SELECTION && (
                    <button onClick={() => setShowReproductionModal(true)} className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-[10px] font-black uppercase hover:bg-purple-200 shadow-sm transition-all whitespace-nowrap">
                        Reproduire mes choix
                    </button>
                )}
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border shadow-sm w-full md:w-auto justify-center">
                    <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: getChoiceColor(category) }}></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                        Mode : {category === 'normal' ? 'Étape 1' : category === 'good_bonus' ? 'Étape 2' : 'Étape 3 - Garde au choix'}
                    </span>
                </div>
            </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-100">
        {currentStep === AppStep.RECAP_ORDERING ? (
          <div className="flex-1 overflow-hidden flex flex-col pb-24 md:pb-0">
            <RecapView choices={choices.filter(c => c.userTrigram === trigram.toUpperCase())} columns={dynamicColumns} onReorder={setChoices} activeRound={activeRound} />
          </div>
        ) : viewMode === ViewMode.LIST_INPUT ? (
          <div className="flex-1 overflow-auto custom-scrollbar p-4 pb-32">
              <ListView 
                  monthsToDisplay={monthsToDisplay}
                  dynamicColumns={dynamicColumns}
                  choices={choices}
                  currentStep={currentStep}
                  category={category}
                  trigram={trigram}
                  globalClosures={globalClosures}
                  unavailabilities={unavailabilities}
                  handleCellClick={handleCellClick}
                  isColOpen={isColOpen}
                  isBlockedByUnavailability={isBlockedByUnavailability}
                  columnConfigs={columnConfigs}
                  activePriority={activePriority}
              />
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-12 pb-32">
            {monthsToDisplay.map(({ month, year, label }) => {
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              
              // Compute which columns are entirely closed for this step
              const closedColumnsForStep = dynamicColumns.filter(col => {
                  const cfg = columnConfigs.find(c => c.column_id === col.id);
                  if (!cfg) return false;
                  if (currentStep === AppStep.NORMAL_SELECTION) return !cfg.open_normal_w && !cfg.open_normal_s && !cfg.open_normal_d;
                  if (currentStep === AppStep.BAD_BONUS_SELECTION) return !cfg.open_bad_w && !cfg.open_bad_s && !cfg.open_bad_d;
                  if (currentStep === AppStep.GOOD_BONUS_SELECTION) return !cfg.open_good_w && !cfg.open_good_s && !cfg.open_good_d;
                  return false;
              }).map(col => col.id);

              return (
                <div key={`${year}-${month}`} className="space-y-4">
                  <div className="flex items-center gap-4 px-4">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{label}</h2>
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <button 
                        onClick={() => {
                           window.dispatchEvent(new CustomEvent('trigger-ai-proposal'));
                        }}
                        className={`flex items-center gap-2 ${trigram.toUpperCase() === 'TES' ? 'px-4' : 'px-3'} py-2 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-200 transition-colors text-sm font-black shadow-sm`}
                        title="Générer planning IA"
                    >
                        <Bot className="w-4 h-4" />
                        {trigram.toUpperCase() === 'TES' && (
                            <span className="hidden sm:inline">Générer planning complet IA</span>
                        )}
                    </button>
                    <button 
                        onClick={() => exportToICS(month, year, choices, dynamicColumns, trigram.toUpperCase())}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-bold shadow-sm"
                    >
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Exporter mes gardes</span>
                    </button>
                  </div>
                  
                  <MonthCounters month={month} year={year} choices={choices} columns={dynamicColumns} userTrigram={trigram.toUpperCase()} />

                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200">
                     <table className="w-max min-w-full border-separate border-spacing-0 table-fixed">
                        <MatrixHeader columns={dynamicColumns} globalClosures={globalClosures} month={month} year={year} closedColumns={closedColumnsForStep} hoveredCell={hoveredCell} />
                        <tbody>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const date = new Date(year, month, day);
                            const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3).replace('.', '');
                            const isSunday = date.getDay() === 0;
                            const isHoliday = isPublicHoliday(date);
                            const isOffDay = isSunday || isHoliday;
                            const isWeekend = date.getDay() === 6 || isOffDay;
                            
                            const isHoveredRow = hoveredCell?.day === day && hoveredCell?.month === month && hoveredCell?.year === year;
                            const rowHeaderBg = isHoveredRow ? 'bg-blue-100 text-blue-800' : (isWeekend ? 'bg-red-100 text-red-600' : 'bg-white text-slate-900');
                            
                            return (
                              <tr key={day} className={`h-10 md:h-8 hover:bg-slate-50/50 ${isWeekend ? 'bg-red-50/30' : ''}`}>
                                <td className={`sticky left-0 border-r border-b border-slate-200 text-center z-10 w-20 md:w-16 h-10 md:h-8 font-black ${rowHeaderBg}`}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] md:text-[8px] font-normal opacity-70">{dayName}</span>
                                        <span className="text-[12px] md:text-[10px]">{day}</span>
                                    </div>
                                </td>
                                {dynamicColumns.map(col => {
                                  const isClosed = globalClosures.some((gc: any) => gc.col_id === col.id && gc.row === day && gc.month === month && gc.year === year);
                                  
                                  const isHoveredCol = hoveredCell?.colId === col.id && hoveredCell?.month === month && hoveredCell?.year === year;
                                  const isCrosshair = isHoveredRow || isHoveredCol;
                                  
                                  const open = isColOpen(col.id, currentStep, day, month, year) && !isClosed;
                                  const isBlocked = isBlockedByUnavailability(day, col.id, month, year);
                                  
                                  // Récupérer une garde validée (ASSIGNED) sur cette case
                                  const rawAssignedList = choices.filter(ch => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.status === 'ASSIGNED');
                                  const assignedList = rawAssignedList.filter((a, index, self) => 
                                      index === self.findIndex((t) => t.userTrigram === a.userTrigram)
                                  );
                                  
                                  // Mes vœux en attente
                                  const myPendingChoices = choices.filter(ch => ch.row === day && ch.col === col.id && ch.month === month && ch.year === year && ch.userTrigram === trigram.toUpperCase() && ch.status === 'PENDING');
                                  const myPending = myPendingChoices.find(ch => ch.category === category) || myPendingChoices[0];
                                  const hasMultiplePending = myPendingChoices.length > 1;
                                  
                                  const isAssignedToMe = assignedList.some(a => a.userTrigram === trigram.toUpperCase());
                                  const isAssignedToOther = assignedList.length > 0 && !isAssignedToMe;
                                  
                                  let cellStyles = "border-r border-b border-slate-200 relative text-center transition-all min-w-[60px] w-[60px] md:min-w-[28px] md:w-[28px] ";
                                  if (isCrosshair) cellStyles += "after:absolute after:inset-0 after:bg-blue-500/10 after:pointer-events-none ";
                                  let bgColor = '#FFFFFF';
                                  
                                  const timeRange = parseTimeRange(col.timeRange);
                                  const isWeekendTime = isOffDay || (date.getDay() === 6 && timeRange && timeRange.end > 14 * 60);
                                  const isWeekendGuard = isWeekendTime && (col.type === 'Consultation' || col.type === 'Téléconsultation') && col.label !== 'PFG' && col.label !== 'TcN';
                                  
                                  const pendingGiveUp = myPendingExchanges.find(ex => ex.requester_choice?.row === day && ex.requester_choice?.col === col.id && (ex.requester_choice?.month - 1) === month && ex.requester_choice?.year === year);
                                  const pendingTake = myPendingExchanges.find(ex => ex.target_row === day && ex.target_col === col.id && ex.target_month === month && ex.target_year === year);
                                  
                                  const pendingAbandon = myPendingAbandons.find(ab => ab.status === 'PENDING' && ab.requester_choice?.row === day && ab.requester_choice?.col === col.id && (ab.requester_choice?.month - 1) === month && ab.requester_choice?.year === year);

                                  const cellDateObj = new Date(year, month, day, 0, 0, 0);
                                  const cellDiffHours = (cellDateObj.getTime() - Date.now()) / (1000 * 60 * 60);
                                  const isLessThan48h = cellDiffHours < 48;

                                  if (exchangeMode !== 'INACTIVE') {
                                      const isOwnSelected = selectedOwnChoice?.row === day && selectedOwnChoice?.col === col.id && selectedOwnChoice?.month === month && selectedOwnChoice?.year === year;
                                      const isTargetSelected = selectedTargetChoice?.row === day && selectedTargetChoice?.col === col.id && selectedTargetChoice?.month === month && selectedTargetChoice?.year === year;
                                      const isPossibleTarget = possibleTargetChoices.some(c => c.row === day && c.col === col.id && c.month === month && c.year === year);
                                      
                                      if (isOwnSelected) {
                                          bgColor = '#f97316'; // orange-500
                                          cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#ea580c] cursor-pointer";
                                      } else if (isTargetSelected) {
                                          bgColor = '#22c55e'; // green-500
                                          cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#16a34a] cursor-pointer";
                                      } else if (isPossibleTarget) {
                                          bgColor = '#3b82f6'; // blue-500
                                          cellStyles += " opacity-100 z-10 scale-[1.02] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#2563eb] cursor-pointer hover:bg-blue-600";
                                      } else if (exchangeMode === 'SELECT_OWN' && isAssignedToMe) {
                                          if (!isLessThan48h) {
                                              bgColor = '#fde047'; // Yellow 300
                                              cellStyles += " opacity-100 cursor-pointer hover:scale-[1.05] hover:z-20 hover:shadow-[inset_0_0_0_2px_#facc15] transition-all";
                                          } else {
                                              bgColor = col.customColor || '#FFFFFF';
                                              cellStyles += " opacity-40 cursor-pointer text-slate-900"; // pointer so it triggers the alert
                                          }
                                      } else if (pendingGiveUp) {
                                          bgColor = '#a855f7'; // purple-500
                                          cellStyles += " opacity-40 rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#9333ea] cursor-not-allowed";
                                      } else if (pendingTake) {
                                          bgColor = '#c084fc'; // purple-400
                                          cellStyles += " opacity-40 rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#9333ea] cursor-not-allowed";
                                      } else if (assignedList.length > 0) {
                                          bgColor = col.customColor || '#FFFFFF';
                                          cellStyles += " opacity-30 text-slate-900";
                                      } else {
                                          bgColor = '#f8fafc';
                                          cellStyles += " opacity-20";
                                      }
                                  } else if (takeMode !== 'INACTIVE') {
                                      const isTargetSelected = selectedTargetChoice?.row === day && selectedTargetChoice?.col === col.id && selectedTargetChoice?.month === month && selectedTargetChoice?.year === year;
                                      const existingTake = myPendingTakes.find(tk => tk.target_row === day && tk.target_col === col.id && tk.target_month === month && tk.target_year === year);
                                      
                                      if (isTargetSelected) {
                                          bgColor = '#0d9488'; // teal-600
                                          cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#0f766e]";
                                      } else if (existingTake) {
                                          bgColor = '#14b8a6'; // teal-500
                                          cellStyles += " opacity-50 rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#0f766e] cursor-not-allowed pointer-events-none";
                                      } else if (open && !isClosed && assignedList.length === 0 && !isLessThan48h) {
                                          bgColor = col.customColor || '#FFFFFF';
                                          cellStyles += " hover:bg-teal-50 cursor-pointer transition-colors opacity-100 text-slate-900 font-bold hover:shadow-[inset_0_0_0_2px_#5eead4]";
                                      } else if (open && !isClosed && assignedList.length === 0 && isLessThan48h) {
                                          bgColor = col.customColor || '#FFFFFF';
                                          cellStyles += " opacity-30 cursor-not-allowed text-slate-900 pointer-events-none"; 
                                      } else if (assignedList.length > 0) {
                                          bgColor = col.customColor || '#FFFFFF';
                                          cellStyles += " opacity-30 cursor-not-allowed text-slate-900 pointer-events-none";
                                      } else {
                                          bgColor = '#f8fafc';
                                          cellStyles += " opacity-20 pointer-events-none";
                                      }
                                  } else if (isConsultationMode) {
                                      if (pendingAbandon) {
                                          bgColor = '#be123c'; // rose-700
                                          cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#9f1239]";
                                      } else if (pendingGiveUp) {
                                          bgColor = '#a855f7'; // purple-500
                                          cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#9333ea]";
                                      } else if (pendingTake) {
                                          bgColor = '#c084fc'; // purple-400
                                          cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-white font-black shadow-[inset_0_0_0_2px_#9333ea]";
                                      } else if (isAssignedToMe) {
                                          bgColor = '#fde047'; // Yellow 300
                                          cellStyles += " opacity-100 z-20 scale-[1.05] rounded-sm text-slate-900 font-black shadow-[inset_0_0_0_2px_#facc15]";
                                      } else if (assignedList.length > 0) {
                                          bgColor = col.customColor || '#FFFFFF';
                                          cellStyles += " opacity-100 text-slate-900";
                                      } else if (isClosed) {
                                          bgColor = '#f1f5f9'; // slate-100 for global closures
                                          cellStyles += " opacity-40";
                                      } else {
                                          bgColor = col.customColor || '#FFFFFF';
                                          cellStyles += " opacity-70";
                                      }
                                      cellStyles += " cursor-default";
                                  } else if (isAssignedToMe) { 
                                      bgColor = '#fde047'; // Yellow 300
                                      cellStyles += open ? " opacity-100 z-20 scale-[1.05] rounded-sm text-slate-900 font-black shadow-[inset_0_0_0_2px_#facc15]" : " opacity-60 z-20 rounded-sm text-slate-900 font-bold"; 
                                  } else if (assignedList.length > 0) { 
                                      bgColor = open ? (col.customColor || '#FFFFFF') : '#f1f5f9';
                                      cellStyles += open ? " opacity-100 cursor-not-allowed text-slate-900" : " opacity-50 cursor-not-allowed text-slate-500"; 
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
                                      cellStyles += open ? " text-white shadow-md z-10 cursor-pointer scale-[0.98]" : " text-white shadow-sm z-10 cursor-not-allowed opacity-60";
                                  } else if (myPending) { 
                                      bgColor = getChoiceColor(myPending.category); 
                                      cellStyles += open ? " text-white shadow-md z-10 cursor-pointer scale-[0.98]" : " text-white shadow-sm z-10 cursor-not-allowed opacity-60";
                                  } else if (isClosed) {
                                      bgColor = '#f1f5f9'; // slate-100 for global closures
                                      cellStyles += " opacity-40 cursor-not-allowed";
                                  } else if (!open) { 
                                      bgColor = '#f1f5f9'; // slate-100 for grayed out closed cells
                                      cellStyles += " opacity-40 cursor-not-allowed";
                                  } else { 
                                      bgColor = col.customColor || '#FFFFFF'; 
                                      cellStyles += " hover:bg-blue-50 cursor-pointer opacity-70";
                                  }

                                  if (!isConsultationMode && isBlocked) {
                                      bgColor = `linear-gradient(to bottom left, transparent calc(50% - 1.5px), #ef4444 calc(50% - 1.5px), #ef4444 calc(50% + 1.5px), transparent calc(50% + 1.5px)), ${bgColor}`;
                                      if (!myPending && !hasMultiplePending) {
                                          cellStyles = cellStyles.replace('cursor-pointer', 'cursor-not-allowed');
                                      }
                                  }

                                  if (isWeekendGuard) {
                                      bgColor = `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.15)), ${bgColor}`;
                                  }

                                  if(assignedList.length > 0 && !isAssignedToMe && !isConsultationMode) cellStyles += " cursor-not-allowed";

                                  return (
                                    <td 
                                      key={col.id} 
                                      onMouseEnter={() => setHoveredCell({ day, month, year, colId: col.id, colLabel: col.label, colType: col.type })}
                                      onMouseLeave={() => setHoveredCell(null)}
                                      onClick={(e) => {
                                          if (exchangeMode === 'INACTIVE' && takeMode === 'INACTIVE' && (isConsultationMode || assignedList.length > 0)) return;
                                          const cellKey = `${day}-${col.id}`;
                                          const existingTimeout = clickTimeoutsRef.current.get(cellKey);
                                          if (existingTimeout) {
                                              clearTimeout(existingTimeout);
                                          }
                                          const newTimeout = setTimeout(() => {
                                              handleCellClick(day, col.id, month, year, false);
                                              clickTimeoutsRef.current.delete(cellKey);
                                          }, 250);
                                          clickTimeoutsRef.current.set(cellKey, newTimeout);
                                      }}
                                      onDoubleClick={(e) => {
                                          e.preventDefault();
                                          if (isConsultationMode || assignedList.length > 0) return;
                                          const cellKey = `${day}-${col.id}`;
                                          const existingTimeout = clickTimeoutsRef.current.get(cellKey);
                                          if (existingTimeout) {
                                              clearTimeout(existingTimeout);
                                              clickTimeoutsRef.current.delete(cellKey);
                                          }
                                          handleCellClick(day, col.id, month, year, true);
                                      }}
                                      className={cellStyles} 
                                      style={{ background: bgColor }}
                                      title={(!isConsultationMode && isBlocked) ? "Indisponibilité" : undefined}
                                    >
                                      {/* Contenu de la case */}
                                      
                                      {/* Cas 1 : Mon vœu en attente (sans assignation par dessus) */}
                                      {!isConsultationMode && assignedList.length === 0 && hasMultiplePending && (
                                        <div className="flex flex-col items-center justify-center leading-none w-full h-full relative">
                                            <span className="absolute top-0.5 left-0.5 text-[10px] md:text-[8px] font-black drop-shadow-md">
                                                {myPendingChoices[0].groupIndex}
                                                {myPendingChoices[0].subRank > 1 && <span className="text-[8px] md:text-[6px] opacity-80 lowercase">.{String.fromCharCode(95 + myPendingChoices[0].subRank)}</span>}
                                            </span>
                                            
                                            {myPendingChoices.length === 2 ? (
                                                <span className="absolute bottom-0.5 right-0.5 text-[10px] md:text-[8px] font-black drop-shadow-md">
                                                    {myPendingChoices[1].groupIndex}
                                                    {myPendingChoices[1].subRank > 1 && <span className="text-[8px] md:text-[6px] opacity-80 lowercase">.{String.fromCharCode(95 + myPendingChoices[1].subRank)}</span>}
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] md:text-[8px] font-black drop-shadow-md">
                                                        {myPendingChoices[1].groupIndex}
                                                        {myPendingChoices[1].subRank > 1 && <span className="text-[8px] md:text-[6px] opacity-80 lowercase">.{String.fromCharCode(95 + myPendingChoices[1].subRank)}</span>}
                                                    </span>
                                                    <span className="absolute bottom-0.5 right-0.5 text-[10px] md:text-[8px] font-black drop-shadow-md">
                                                        {myPendingChoices[2].groupIndex}
                                                        {myPendingChoices[2].subRank > 1 && <span className="text-[8px] md:text-[6px] opacity-80 lowercase">.{String.fromCharCode(95 + myPendingChoices[2].subRank)}</span>}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                      )}
                                      {!isConsultationMode && assignedList.length === 0 && !hasMultiplePending && myPending && (
                                        <div className="flex flex-col items-center justify-center leading-none">
                                            <span className="text-[12px] md:text-[10px] font-black">{myPending.groupIndex}</span>
                                            {myPending.subRank > 1 && <span className="text-[9px] md:text-[7px] font-black opacity-80 lowercase">.{String.fromCharCode(95 + myPending.subRank)}</span>}
                                        </div>
                                      )}

                                      {/* Cas 2 : Garde Validée (Moi ou Autre) - Affiche le(s) trigramme(s) */}
                                      {(isAssignedToMe || isAssignedToOther) && (
                                          <div className="flex flex-col items-center justify-center gap-[1px] relative">
                                              {isConsultationMode && pendingGiveUp && (
                                                  <span className="absolute -top-1 md:-top-2 right-0 text-white font-black drop-shadow-md text-[10px] md:text-[14px]">↗</span>
                                              )}
                                              {isConsultationMode && pendingTake && (
                                                  <span className="absolute -top-1 md:-top-2 right-0 text-white font-black drop-shadow-md text-[10px] md:text-[14px]">↙</span>
                                              )}
                                              {assignedList.map((a, i) => (
                                                  <span key={i} className={`text-[14px] md:text-[11px] font-black drop-shadow-sm tracking-tighter block leading-none ${(isConsultationMode && (pendingGiveUp || pendingTake)) ? 'text-white' : 'text-slate-900'}`}>
                                                      {a.userTrigram}
                                                  </span>
                                              ))}
                                          </div>
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

      {hoveredCell && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 text-xs md:text-sm font-bold pointer-events-none border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4">
            <span className="text-blue-400 whitespace-nowrap">
                {new Date(hoveredCell.year, hoveredCell.month, hoveredCell.day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
            <span className="text-emerald-400 whitespace-nowrap">{hoveredCell.colType}</span>
            <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
            <span className="text-orange-400 whitespace-nowrap">Col {hoveredCell.colId}</span>
            <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0"></div>
            <span className="whitespace-nowrap">{hoveredCell.colLabel}</span>
        </div>
      )}

      {/* Exchange Sidebar */}
      <div 
        className={`absolute top-0 right-0 h-full bg-white shadow-2xl z-[300] border-l border-slate-200 transition-transform duration-300 transform w-96 flex flex-col ${isExchangeSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-widest text-slate-900">Demandes en attente</h3>
            <button onClick={() => setIsExchangeSidebarOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {[...myPendingExchanges].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(ex => {
                 const date = new Date(ex.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                 return (
                 <div key={ex.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col gap-3 relative">
                     <div className="absolute top-3 right-4 text-[9px] text-slate-400 font-mono">{date}</div>
                     <div className="flex flex-col gap-1 mt-2">
                         <span className="text-[10px] font-black uppercase text-purple-500 tracking-widest">Garde cédée (Départ)</span>
                         <span className="text-sm font-bold text-slate-800">
                             {formatRequestDate(ex.requester_choice?.row, ex.requester_choice?.month, ex.requester_choice?.year, ex.requester_choice?.col, ex.requester_choice?.colLabel, true, columnConfigs)}
                         </span>
                     </div>
                     <div className="flex justify-center text-slate-300 -my-1">
                        <ChevronDown size={16} />
                     </div>
                     <div className="flex flex-col gap-1">
                         <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Garde souhaitée (Arrivée)</span>
                         <span className="text-sm font-bold text-slate-800">
                             {formatRequestDate(ex.target_row, ex.target_month, ex.target_year, ex.target_col, ex.target_col_label, false, columnConfigs)}
                         </span>
                     </div>
                     <div className="pt-3 border-t border-slate-200 mt-1">
                         <button 
                             onClick={async () => {
                                 if(!window.confirm("Annuler cette demande d'échange ?")) return;
                                 try {
                                     await supabase.from('exchange_requests').delete().eq('id', ex.id);
                                     setMyPendingExchanges(prev => prev.filter(p => p.id !== ex.id));
                                 } catch(err) {
                                     console.error(err);
                                 }
                             }}
                             className="w-full text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                         >
                             Annuler la demande
                         </button>
                     </div>
                 </div>
             )})}
             {myPendingExchanges.length === 0 && (
                 <div className="text-center text-slate-400 font-bold text-sm mt-8">Aucune demande d'échange en cours.</div>
             )}
        </div>
      </div>

      {/* Abandon Sidebar */}
      <div 
        className={`absolute top-0 right-0 h-full bg-white shadow-2xl z-[300] border-l border-slate-200 transition-transform duration-300 transform w-96 flex flex-col ${isAbandonSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-widest text-slate-900">Mes Abandons</h3>
            <button onClick={() => setIsAbandonSidebarOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {[...displayedAbandons].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(ab => {
                 const date = new Date(ab.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                 const isApproved = ab.status === 'APPROVED';
                 return (
                 <div key={ab.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col gap-3 relative">
                     <div className="absolute top-3 right-4 text-[9px] text-slate-400 font-mono">{date}</div>
                     <div className="flex flex-col gap-1 mt-2">
                         <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Garde abandonnée</span>
                             {isApproved ? (
                                 <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[9px] font-black uppercase">Validé</span>
                             ) : (
                                 <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black uppercase">En attente</span>
                             )}
                         </div>
                         <span className="text-sm font-bold text-slate-800 mt-1">
                             {ab.requester_choice 
                               ? formatRequestDate(ab.requester_choice.row, ab.requester_choice.month, ab.requester_choice.year, ab.requester_choice.col, ab.requester_choice.colLabel, true, columnConfigs)
                               : ab.shift_snapshot
                                 ? formatRequestDate(ab.shift_snapshot.row, ab.shift_snapshot.month, ab.shift_snapshot.year, ab.shift_snapshot.col, ab.shift_snapshot.colLabel, true, columnConfigs)
                                 : 'Garde supprimée'}
                         </span>
                     </div>
                 </div>
             )})}
             {displayedAbandons.length === 0 && (
                 <div className="text-center text-slate-400 font-bold text-sm mt-8">Aucun abandon pour les mois affichés.</div>
             )}
        </div>
      </div>

      {/* Take Sidebar */}
      <div 
        className={`absolute top-0 right-0 h-full bg-white shadow-2xl z-[300] border-l border-slate-200 transition-transform duration-300 transform w-96 flex flex-col ${isTakeSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black uppercase tracking-widest text-slate-900">Mes Prises</h3>
            <button onClick={() => setIsTakeSidebarOpen(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {[...myPendingTakes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(tk => {
                 const date = new Date(tk.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                 const theDate = new Date(tk.target_year, tk.target_month, tk.target_row);
                 const dateStr = theDate.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

                 return (
                 <div key={tk.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col gap-3 relative">
                     <div className="absolute top-3 right-4 text-[9px] text-slate-400 font-mono">{date}</div>
                     <div className="flex flex-col gap-1 pr-24">
                         <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black uppercase text-teal-600 tracking-widest">Demande</span>
                             <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black uppercase">En attente</span>
                         </div>
                         <span className="text-sm font-bold text-slate-800 mt-1 capitalize">
                             {dateStr}
                         </span>
                         <span className="text-sm font-black text-slate-500">
                             {tk.target_col_label}
                         </span>
                     </div>
                     <div className="pt-3 border-t border-slate-200 mt-1">
                         <button 
                             onClick={async () => {
                                 if(!window.confirm("Annuler cette demande de prise de garde ?")) return;
                                 try {
                                     await supabase.from('take_requests').delete().eq('id', tk.id);
                                     setMyPendingTakes(prev => prev.filter(p => p.id !== tk.id));
                                 } catch(err) {
                                     console.error(err);
                                 }
                             }}
                             className="w-full px-4 py-2 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                         >
                             <X size={14} /> Annuler
                         </button>
                     </div>
                 </div>
             )})}
             {myPendingTakes.length === 0 && (
                 <div className="text-center text-slate-400 font-bold text-sm mt-8">Aucune prise de garde en cours.</div>
             )}
        </div>
      </div>

      {showExchangeConfirmModal && (
        <div className="fixed inset-0 z-[400] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 shadow-2xl">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full transform transition-all shadow-xl">
                <h3 className="text-2xl font-black uppercase text-slate-900 mb-6 text-center tracking-tighter">Confirmation de la demande d'échange</h3>
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-center gap-4 bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <div className="flex-1">
                            <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest block mb-1">Je donne ma garde :</span>
                            <span className="text-sm font-bold text-slate-800 leading-snug">
                                {formatRequestDate(selectedOwnChoice?.row, selectedOwnChoice?.month, selectedOwnChoice?.year, selectedOwnChoice?.col, selectedOwnChoice?.colLabel, false, columnConfigs)}
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-center text-slate-300">
                        <ArrowRight size={24} className="rotate-90 md:rotate-0" />
                    </div>
                    <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <div className="flex-1">
                            <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest block mb-1">Pour récupérer la garde :</span>
                            <span className="text-sm font-bold text-slate-800 leading-snug">
                                {formatRequestDate(selectedTargetChoice?.row, selectedTargetChoice?.month, selectedTargetChoice?.year, selectedTargetChoice?.col, selectedTargetChoice?.colLabel, false, columnConfigs)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setShowExchangeConfirmModal(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">Annuler</button>
                    <button onClick={handleExchangeConfirm} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 transition-all flex justify-center items-center gap-2">Confirmer la demande</button>
                </div>
            </div>
        </div>
      )}

      {showTakeConfirmModal && (
        <div className="fixed inset-0 z-[400] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 shadow-2xl">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full transform transition-all shadow-xl">
                <h3 className="text-2xl font-black uppercase text-slate-900 mb-6 text-center tracking-tighter">Prise de garde</h3>
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-center gap-4 bg-teal-50 p-4 rounded-xl border border-teal-100">
                        <div className="flex-1">
                            <span className="text-[10px] font-black uppercase text-teal-600 tracking-widest block mb-1">Garde ciblée :</span>
                            <span className="text-sm font-bold text-slate-800 leading-snug">
                                {formatRequestDate(selectedTargetChoice?.row, selectedTargetChoice?.month, selectedTargetChoice?.year, selectedTargetChoice?.col, selectedTargetChoice?.colLabel, false, columnConfigs)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setShowTakeConfirmModal(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors">Annuler</button>
                    <button onClick={handleTakeConfirm} className="flex-1 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-teal-500/20 transition-all flex justify-center items-center gap-2">Confirmer</button>
                </div>
            </div>
        </div>
      )}

      {viewMode === ViewMode.APP && (
        <ChatAssistant 
          supabase={supabase}
          trigram={trigram}
          currentRoundId={currentRoundId}
          activeRoundTitle={rounds.find(r => r.id === currentRoundId)?.title || ''}
          activeRound={rounds.find(r => r.id === currentRoundId)}
          globalClosures={globalClosures}
          columns={dynamicColumns}
          month={monthsToDisplay[0]?.month ?? 0}
          year={monthsToDisplay[0]?.year ?? new Date().getFullYear()}
          days={monthsToDisplay.length > 0 ? Array.from({ length: new Date(monthsToDisplay[0].year, monthsToDisplay[0].month + 1, 0).getDate() }, (_, i) => ({
            day: i + 1,
            weekday: new Date(monthsToDisplay[0].year, monthsToDisplay[0].month, i + 1).toLocaleDateString('fr-FR', { weekday: 'long' }),
            isSunday: new Date(monthsToDisplay[0].year, monthsToDisplay[0].month, i + 1).getDay() === 0
          })) : []}
          activePriority={activePriority}
          monthLabel={monthsToDisplay.length > 0 ? `${new Date(monthsToDisplay[0].year, monthsToDisplay[0].month).toLocaleString('fr-FR', { month: 'long' })} ${monthsToDisplay[0].year}` : ''}
          currentStep={currentStep}
          columnConfigs={columnConfigs}
          choices={choices}
          currentCategory={category}
          onAddChoices={handleAIChoices}
          doctorProfile={doctorProfile ? JSON.stringify(doctorProfile, null, 2) : ''}
          isBlockedByUnavailability={isBlockedByUnavailability}
          isColOpen={isColOpen}
        />
      )}

    </div>
  );
};

export default App;