
import type { LucideIcon } from 'lucide-react';

export type UserRole = 'BHR' | 'ZHR' | 'VHR' | 'CHR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  reports_to?: string; // UUID of manager
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
  category: string; // Added
  code: string;     // Added
}

export interface Assignment {
  id: string;
  bhr_id: string;
  branch_id: string;
}

export interface Visit {
  id: string;
  bhr_id: string;
  bhr_name: string; 
  branch_id: string;
  branch_name: string; 
  visit_date: string; // ISO string
  
  // New Basic Info
  branch_category?: string;
  branch_code?: string;
  hr_connect_conducted?: boolean;

  // Branch Metrics
  manning_percentage?: number;
  attrition_percentage?: number;
  non_vendor_percentage?: number;
  er_percentage?: number;
  cwt_cases?: number;
  performance_level?: string; // e.g., "Excellent", "Good"

  // Employee Coverage
  new_employees_total?: number;
  new_employees_covered?: number;
  star_employees_total?: number;
  star_employees_covered?: number;

  // Qualitative Assessment (storing as 'yes'/'no'/undefined)
  qual_aligned_conduct?: 'yes' | 'no';
  qual_safe_secure?: 'yes' | 'no';
  qual_motivated?: 'yes' | 'no';
  qual_abusive_language?: 'yes' | 'no'; // Note: Question is "Do leaders USE abusive lang", so 'yes' is bad.
  qual_comfortable_escalate?: 'yes' | 'no';
  qual_inclusive_culture?: 'yes' | 'no';
  
  additional_remarks?: string; // Renamed from 'notes'
  notes?: string; // Keep for backward compatibility if needed, or remove if new visits always use additional_remarks
}

export interface VisitReportInput {
  branch: string;
  visitDate: string;
  notes: string; // This is for the AI summary, might need adjustment if AI needs all fields
  bhr: string;
}

// Props for chart components
export interface ChartData {
  name: string;
  value: number;
  fill?: string;
}
