'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Visit, Branch } from '@/types'; // Assuming Visit type is comprehensive
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

// Define a type for the enriched visit object the modal expects
export interface EnrichedVisitForModal extends Visit {
  branch_name_display?: string;
  branch_category_display?: string;
  branch_code_display?: string;
  bhr_name_display?: string;
}

interface ViewVisitDetailsModalProps {
  visit: EnrichedVisitForModal | null;
  isOpen: boolean;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value?: string | number | null | boolean; isBoolean?: boolean }> = ({ label, value, isBoolean }) => {
  let displayValue: React.ReactNode = 'N/A';
  if (value !== undefined && value !== null) {
    if (isBoolean) {
      displayValue = value ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>;
    } else if (typeof value === 'string' && (value.toLowerCase() === 'yes' || value.toLowerCase() === 'no')) {
      displayValue = value.toLowerCase() === 'yes' ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>;
    } else if (typeof value === 'number') {
      displayValue = value.toString();
    } else {
      displayValue = value;
    }
  }

  return (
    <div className="mb-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{displayValue}</div>
    </div>
  );
};


export function ViewVisitDetailsModal({ visit, isOpen, onClose }: ViewVisitDetailsModalProps) {
  if (!visit) return null;

  const coveragePercentage = (visit.hr_connect_conducted && visit.hr_connect_employees_invited && visit.hr_connect_employees_invited > 0 && visit.hr_connect_participants !== undefined)
    ? Math.round((visit.hr_connect_participants / visit.hr_connect_employees_invited) * 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] md:max-h-[90vh] bg-white shadow-2xl border border-slate-200 rounded-2xl p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-4 border-b border-slate-100">
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-[#004C8F]">Branch Visit Details</DialogTitle>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
            <div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-800 leading-tight">{visit.branch_name_display || 'N/A'}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground/80 mt-0.5">
                    {visit.branch_name_display || 'N/A'} • {visit.branch_code_display || 'N/A'} • {visit.branch_category_display || 'N/A'}
                </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {visit.status && <Badge variant={visit.status === 'submitted' ? 'secondary' : 'outline'} className="capitalize text-xs px-3 py-1 rounded-full shadow-sm bg-green-100/80 text-green-800 border-0">{visit.status}</Badge>}
                {visit.branch_category_display && <Badge variant="outline" className="bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 border-0 text-xs px-3 py-1 rounded-full shadow-sm">{visit.branch_category_display}</Badge>}
            </div>
          </div>
        </DialogHeader>
        <Separator className="mb-0" />
        <ScrollArea className="max-h-[calc(80vh-100px)] pr-4 -mr-2 px-8 py-6">
          <div className="space-y-8 pr-2">
            {/* Visit Information & HR Connect Coverage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white shadow-sm rounded-xl border border-slate-100 p-6">
              <div>
                <h3 className="font-semibold text-slate-700 mb-3 text-base sm:text-lg">Visit Information</h3>
                <DetailItem label="Visit Date" value={visit.visit_date ? format(parseISO(visit.visit_date), 'MMM dd, yyyy') : 'N/A'} />
                <DetailItem label="HR Connect Session" value={visit.hr_connect_conducted} isBoolean />
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-3 text-base sm:text-lg">HR Connect Coverage</h3>
                <DetailItem label="Total Employees Invited" value={visit.hr_connect_employees_invited} />
                <DetailItem label="Total Participants" value={visit.hr_connect_participants} />
                <DetailItem label="Coverage" value={`${coveragePercentage}%`} />
              </div>
            </div>

            {/* Branch Metrics */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 text-slate-700">Branch Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 bg-white shadow-sm rounded-xl border border-slate-100 p-6">
                <DetailItem label="Manning %" value={visit.manning_percentage !== null && visit.manning_percentage !== undefined ? `${visit.manning_percentage}%` : 'N/A'} />
                <DetailItem label="Attrition %" value={visit.attrition_percentage !== null && visit.attrition_percentage !== undefined ? `${visit.attrition_percentage}%` : 'N/A'} />
                <DetailItem label="Non-Vendor %" value={visit.non_vendor_percentage !== null && visit.non_vendor_percentage !== undefined ? `${visit.non_vendor_percentage}%` : 'N/A'} />
                <DetailItem label="ER %" value={visit.er_percentage !== null && visit.er_percentage !== undefined ? `${visit.er_percentage}%` : 'N/A'} />
                <DetailItem label="CWT Cases" value={visit.cwt_cases} />
                <DetailItem label="Performance Level" value={visit.performance_level} />
              </div>
            </div>

            {/* Employee Coverage */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 text-slate-700">Employee Coverage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white shadow-sm rounded-xl border border-slate-100 p-6">
                <div>
                  <h4 className="font-medium text-slate-700 mb-1.5 text-base">New Employees (0-6 months)</h4>
                  <DetailItem label="Total" value={visit.new_employees_total} />
                  <DetailItem label="Covered" value={visit.new_employees_covered} />
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 mb-1.5 text-base">STAR Employees</h4>
                  <DetailItem label="Total" value={visit.star_employees_total} />
                  <DetailItem label="Covered" value={visit.star_employees_covered} />
                </div>
              </div>
            </div>
            
            {/* Qualitative Assessment */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 text-slate-700">Qualitative Assessment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 bg-white shadow-sm rounded-xl border border-slate-100 p-6">
                <DetailItem label="Leaders Aligned with Code of Conduct" value={visit.qual_aligned_conduct} />
                <DetailItem label="Employees Feel Safe & Secure" value={visit.qual_safe_secure} />
                <DetailItem label="Employees Feel Motivated" value={visit.qual_motivated} />
                <DetailItem label="Leaders Use Abusive Language" value={visit.qual_abusive_language} />
                <DetailItem label="Employees Comfortable with Escalation" value={visit.qual_comfortable_escalate} />
                <DetailItem label="Inclusive Workplace Culture" value={visit.qual_inclusive_culture} />
              </div>
            </div>

            {/* Additional Remarks */}
            {visit.additional_remarks && (
              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-slate-700">Additional Remarks</h3>
                <div className="p-6 border rounded-xl bg-slate-50/50 shadow-sm">
                    <p className="text-sm sm:text-base whitespace-pre-wrap text-slate-700">{visit.additional_remarks}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="flex-shrink-0 mt-auto px-6 py-4 sm:px-8 sm:py-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="rounded-lg px-6 py-2 text-sm sm:text-base font-semibold shadow-sm transition border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
