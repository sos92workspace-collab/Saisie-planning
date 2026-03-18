
import { GuardType, Site, ColumnDefinition, Round, HeaderConfig } from './types';

export const parseTimeRange = (range: string): { start: number, end: number } | null => {
  if (!range) return null;
  const match = range.match(/(\d+)[hH]?[-]?(\d+)?[hH]?/);
  if (!match) return null;
  let start = parseInt(match[1], 10);
  let end = match[2] ? parseInt(match[2], 10) : start + 1; 
  if (end < start) end += 24;
  return { start, end };
};

export const getEasterDate = (year: number): Date => {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
};

export const isPublicHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const fixedHolidays = [
    { d: 1, m: 0 },
    { d: 1, m: 4 },
    { d: 8, m: 4 },
    { d: 14, m: 6 },
    { d: 15, m: 7 },
    { d: 1, m: 10 },
    { d: 11, m: 10 },
    { d: 25, m: 11 },
  ];

  if (fixedHolidays.some(h => h.d === day && h.m === month)) return true;

  const easter = getEasterDate(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

  const variableHolidays = [easterMonday, ascension, whitMonday];
  
  return variableHolidays.some(h => h.getDate() === day && h.getMonth() === month);
};

export const DAYS_OF_WEEK = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const generateDefaultRounds = (): Round[] => {
  const rounds: Round[] = [];
  const now = new Date();
  for (let i = 1; i <= 10; i++) {
    rounds.push({
      id: i,
      title: i === 1 ? 'Tour de Priorité 1' : `Tour ${i}`,
      instructions: i === 1 
        ? "Bienvenue au premier tour de sélection. Veuillez privilégier vos gardes de coeur."
        : `Consignes pour le tour ${i}. Veuillez compléter les créneaux restants.`,
      isActive: i === 1,
      isActiveDoctors: true,
      isActiveSubstitutes: true,
      isLocked: false,
      monthStart: now.getMonth(),
      yearStart: now.getFullYear(),
      numMonths: 1,
      
      // Par défaut, toutes les étapes sont actives avec des consignes vides
      step_normal_active: true,
      instructions_normal: "",
      
      step_bad_bonus_active: true,
      instructions_bad_bonus: "",
      
      step_good_bonus_active: true,
      instructions_good_bonus: ""
    });
  }
  return rounds;
};

export const DEFAULT_ROUNDS: Round[] = generateDefaultRounds();

export const DEFAULT_HEADERS: HeaderConfig[] = [
  { round_id: 0, label: "06h - 13h", start_col: 1, end_col: 7, color: "#1e293b" }, // Slate 800
  { round_id: 0, label: "07h - 13h", start_col: 8, end_col: 11, color: "#1e293b" },
  { round_id: 0, label: "Matin", start_col: 12, end_col: 20, color: "#064e3b" }, // Emerald 900
  { round_id: 0, label: "13h - 19h", start_col: 21, end_col: 26, color: "#1e293b" },
  { round_id: 0, label: "Après-midi", start_col: 27, end_col: 35, color: "#064e3b" },
  { round_id: 0, label: "Soir / 19h - 01h", start_col: 36, end_col: 43, color: "#312e81" }, // Indigo 900
  { round_id: 0, label: "Nuit", start_col: 44, end_col: 47, color: "#020617" }, // Slate 950
];

export const COLUMNS: ColumnDefinition[] = [
  // 06h-13h : VISITES MATIN (1-7) - Rose/Violet
  ...[
    { label: '1N' }, { label: '2N' }, { label: '3N' }, { label: '4C' }, { label: '5S' }, { label: '6S' }, { label: '7' }
  ].map((d, i) => ({
    id: i + 1,
    label: d.label,
    type: GuardType.VISIT,
    site: Site.NONE,
    timeRange: '06h-13h',
    colorClass: 'bg-[#f0abfc]', // Fuchsia 300
  })),

  // 07h-13h : TRANSITION (8-11) - Blanc
  ...[8, 9, 10, 11].map(id => ({
    id,
    label: id.toString(),
    type: GuardType.OTHER,
    site: Site.NONE,
    timeRange: '07h-13h',
    colorClass: 'bg-white',
  })),

  // MATIN : CONSULTATIONS (12-20)
  { id: 12, label: 'Tc', type: GuardType.TELECONSULTATION, site: Site.COU, timeRange: '08h-12h', colorClass: 'bg-[#fca5a5]' }, // Red 300
  { id: 13, label: 'C1', type: GuardType.CONSULTATION, site: Site.COU, timeRange: '08h-12h', colorClass: 'bg-[#86efac]' }, // Green 300
  { id: 14, label: 'C2', type: GuardType.CONSULTATION, site: Site.COU, timeRange: '08h-12h', colorClass: 'bg-[#86efac]' }, // Green 300
  { id: 15, label: 'C1', type: GuardType.CONSULTATION, site: Site.BOU, timeRange: '08h-12h', colorClass: 'bg-[#93c5fd]' }, // Blue 300
  { id: 16, label: 'C2', type: GuardType.CONSULTATION, site: Site.BOU, timeRange: '08h-12h', colorClass: 'bg-[#93c5fd]' }, // Blue 300
  { id: 17, label: 'PFG', type: GuardType.CONSULTATION, site: Site.BOU, timeRange: '08h-12h', colorClass: 'bg-[#93c5fd]' }, // Blue 300
  { id: 18, label: 'C1', type: GuardType.CONSULTATION, site: Site.ANT, timeRange: '08h-12h', colorClass: 'bg-[#fdba74]' }, // Orange 300
  { id: 19, label: 'C2', type: GuardType.CONSULTATION, site: Site.ANT, timeRange: '08h-12h', colorClass: 'bg-[#fdba74]' }, // Orange 300
  { id: 20, label: 'Tc', type: GuardType.TELECONSULTATION, site: Site.NONE, timeRange: '12h-16h', colorClass: 'bg-[#fca5a5]' }, // Red 300

  // 13h-19h : VISITES APREM (21-26) - Rose/Violet
  ...[
    { label: '1N' }, { label: '2N' }, { label: '3N' }, { label: '4C' }, { label: '5S' }, { label: '6S' }
  ].map((d, i) => ({
    id: 21 + i,
    label: d.label,
    type: GuardType.VISIT,
    site: Site.NONE,
    timeRange: '13h-19h',
    colorClass: 'bg-[#f0abfc]', // Fuchsia 300
  })),

  // APRES-MIDI : CONSULTATIONS (27-35)
  { id: 27, label: 'C1', type: GuardType.CONSULTATION, site: Site.COU, timeRange: '12h-20h', colorClass: 'bg-[#86efac]' }, // Green 300
  { id: 28, label: 'C2', type: GuardType.CONSULTATION, site: Site.COU, timeRange: '12h-20h', colorClass: 'bg-[#86efac]' }, // Green 300
  { id: 29, label: 'PFG', type: GuardType.CONSULTATION, site: Site.BOU, timeRange: '12h-20h', colorClass: 'bg-[#93c5fd]' }, // Blue 300
  { id: 30, label: 'C1', type: GuardType.CONSULTATION, site: Site.BOU, timeRange: '12h-20h', colorClass: 'bg-[#93c5fd]' }, // Blue 300
  { id: 31, label: 'C2', type: GuardType.CONSULTATION, site: Site.BOU, timeRange: '12h-20h', colorClass: 'bg-[#93c5fd]' }, // Blue 300
  { id: 32, label: 'PFG', type: GuardType.CONSULTATION, site: Site.BOU, timeRange: '12h-20h', colorClass: 'bg-[#93c5fd]' }, // Blue 300
  { id: 33, label: 'C1', type: GuardType.CONSULTATION, site: Site.ANT, timeRange: '12h-20h', colorClass: 'bg-[#fdba74]' }, // Orange 300
  { id: 34, label: 'C2', type: GuardType.CONSULTATION, site: Site.ANT, timeRange: '12h-20h', colorClass: 'bg-[#fdba74]' }, // Orange 300
  { id: 35, label: 'Tc', type: GuardType.TELECONSULTATION, site: Site.ANT, timeRange: '16h-20h', colorClass: 'bg-[#fca5a5]' }, // Red 300

  // SOIR : 19h-01h (36-43)
  { id: 36, label: '23h', type: GuardType.OTHER, site: Site.BOU, timeRange: '17h-23h', colorClass: 'bg-[#fcd34d]' }, // Amber 300
  { id: 37, label: 'PFG', type: GuardType.VISIT, site: Site.NONE, timeRange: '19h-01h', colorClass: 'bg-[#67e8f9]' }, // Cyan 300
  ...[{label:'S'},{label:'N'},{label:'C'},{label:'41'},{label:'42'},{label:'43'}].map((d, i) => ({
    id: 38 + i,
    label: d.label,
    type: GuardType.VISIT,
    site: Site.NONE,
    timeRange: '19h-01h',
    colorClass: 'bg-white',
  })),

  // NUIT (44-47)
  { id: 44, label: 'TcN', type: GuardType.TELECONSULTATION, site: Site.NONE, timeRange: '20h-01h', colorClass: 'bg-[#fca5a5]' }, // Red 300
  { id: 45, label: 'N/C', type: GuardType.VISIT, site: Site.NONE, timeRange: '20h-08h', colorClass: 'bg-[#d8b4fe]' }, // Purple 300
  { id: 46, label: 'S/C', type: GuardType.VISIT, site: Site.NONE, timeRange: '21h-03h', colorClass: 'bg-[#d8b4fe]' }, // Purple 300
  { id: 47, label: '47', type: GuardType.OTHER, site: Site.NONE, timeRange: '01h-06h', colorClass: 'bg-white' },
];
