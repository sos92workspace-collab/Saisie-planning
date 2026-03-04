
export enum GuardType {
  VISIT = 'Visite',
  CONSULTATION = 'Consultation',
  TELECONSULTATION = 'Téléconsultation',
  OTHER = 'Autre'
}

export enum Site {
  COU = 'Courbevoie',
  BOU = 'Boulogne',
  ANT = 'Antony',
  NONE = 'N/A'
}

export interface ColumnDefinition {
  id: number;
  label: string;
  type: GuardType;
  site: Site;
  timeRange: string;
  colorClass: string;
  headerLabel?: string;
  customColor?: string | null;
}

export type ChoiceCategory = 'normal' | 'good_bonus' | 'bad_bonus';
export type ChoiceStatus = 'PENDING' | 'ASSIGNED' | 'REFUSED' | 'REFUSED_ALTERNATIVE' | 'ARCHIVED';

export interface Choice {
  id: string;
  row: number; 
  col: number; 
  month: number;
  year: number;
  groupIndex: number; 
  subRank: number; 
  category: ChoiceCategory;
  userTrigram: string;
  userRole: UserRole; 
  status: ChoiceStatus;
  submittedAt: string;
  roundId: number;
  adminComment?: string;
  colLabel?: string;
  colType?: string;
  colTimeRange?: string;
}

export interface Unavailability {
  id: string;
  userTrigram: string;
  day: number;
  month: number;
  year: number;
  period: string; // 'FULL', '06-13', '07-13', 'MATIN', '13-19', 'APREM', 'SOIR', 'NUIT'
}

export enum AppStep {
  NORMAL_SELECTION = 1,
  GOOD_BONUS_SELECTION = 2, // Inversion : Bonnes Gardes passe en 2
  BAD_BONUS_SELECTION = 3,  // Inversion : Gardes Normales passe en 3
  RECAP_ORDERING = 4
}

export type UserRole = 'ADMIN' | 'DOCTOR' | 'SUBSTITUTE';

export interface UserProfile {
  trigram: string;
  role: UserRole;
  password?: string;
}

export enum ViewMode {
  LOGIN = 'LOGIN',
  APP = 'APP',
  ADMIN = 'ADMIN'
}

export enum AdminTab {
  USERS = 'MÉDECINS',
  CONFIG = 'PARAMÉTRAGE',
  SHIFTS = 'GARDES',
  PLANNING = 'PLANNING',
  WISHES = 'CHOIX MÉDECIN'
}

export interface Round {
  id: number;
  title: string;
  instructions: string;
  isActive: boolean;
  isActiveDoctors: boolean;      
  isActiveSubstitutes: boolean;  
  isLocked: boolean;             
  monthStart: number;
  yearStart: number;
  numMonths: number;
  step_normal_active: boolean;
  instructions_normal: string;
  step_bad_bonus_active: boolean;
  instructions_bad_bonus: string;
  step_good_bonus_active: boolean;
  instructions_good_bonus: string;
}

export interface ColumnConfig {
  round_id: number;
  column_id: number;
  custom_label: string;
  custom_header_label: string;
  custom_type: string;
  custom_site: string;
  custom_time_range: string;
  custom_color: string;
  open_normal_w: boolean;
  open_normal_s: boolean;
  open_normal_d: boolean;
  open_bad_w: boolean;
  open_bad_s: boolean;
  open_bad_d: boolean;
  open_good_w: boolean;
  open_good_s: boolean;
  open_good_d: boolean;
}

export interface HeaderConfig {
  id?: number;
  round_id: number;
  label: string;
  start_col: number;
  end_col: number;
  color: string;
}

export interface ShiftDefinition {
  id?: number;
  title: string;
  start_col: number;
  end_col: number;
}

export interface ShiftGlobalSettings {
  id: number;
  target_substitute_active: boolean;
  target_substitute_max: number;
  target_doctor_active: boolean;
  target_doctor_max: number;
}
