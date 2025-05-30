
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
}

export interface Assignment {
  id: string;
  bhr_id: string;
  branch_id: string;
}

export interface Visit {
  id: string;
  bhr_id: string;
  bhr_name: string; // Denormalized for display
  branch_id: string;
  branch_name: string; // Denormalized for display
  visit_date: string; // ISO string
  notes: string;
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
