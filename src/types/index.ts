
import type { LucideIcon } from 'lucide-react';

export type UserRole = 'BHR' | 'ZHR' | 'VHR' | 'CHR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  reports_to?: string; // UUID of manager
  e_code?: string;
  location?: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavItem[];
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  category: string; 
  code: string;     
}

export interface Assignment {
  id: string;
  bhr_id: string;
  branch_id: string;
}

export type VisitStatus = 'draft' | 'submitted'; // Simplified

export interface Visit {
  id: string;
  bhr_id: string;
  bhr_name: string;
  branch_id: string;
  branch_name: string;
  visit_date: string; // ISO string
  status?: VisitStatus;

  // Basic Info
  branch_category?: string;
  branch_code?: string;
  hr_connect_conducted?: boolean;
  hr_connect_employees_invited?: number;
  hr_connect_participants?: number;

  // Branch Metrics
  manning_percentage?: number;
  attrition_percentage?: number;
  non_vendor_percentage?: number;
  er_percentage?: number;
  cwt_cases?: number;
  performance_level?: string;

  // Employee Coverage
  new_employees_total?: number;
  new_employees_covered?: number;
  star_employees_total?: number;
  star_employees_covered?: number;

  // Qualitative Assessment
  qual_aligned_conduct?: 'yes' | 'no';
  qual_safe_secure?: 'yes' | 'no';
  qual_motivated?: 'yes' | 'no';
  qual_abusive_language?: 'yes' | 'no';
  qual_comfortable_escalate?: 'yes' | 'no';
  qual_inclusive_culture?: 'yes' | 'no';

  additional_remarks?: string;
  notes?: string; // Kept for potential legacy data, but new forms use additional_remarks
}

export interface VisitReportInput {
  branch: string;
  visitDate: string;
  notes: string;
  bhr: string;
}

// Props for chart components
export interface ChartData {
  name: string;
  value: number;
  fill?: string;
}
