'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VisitForm, type VisitFormValues } from './visit-form';
import type { Visit, VisitStatus, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditVisitModalProps {
  visitToEdit: Visit | null;
  isOpen: boolean;
  onClose: () => void;
  onVisitUpdated: () => void; 
}

export function EditVisitModal({ visitToEdit, isOpen, onClose, onVisitUpdated }: EditVisitModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  
  const fetchAssignedBranches = useCallback(async () => {
    if (user && user.role === 'BHR') {
      setIsLoadingBranches(true);
      try {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('assignments')
          .select('branch_id')
          .eq('bhr_id', user.id);

        if (assignmentsError) throw assignmentsError;
        if (!assignments || assignments.length === 0) {
          setAssignedBranches([]);
          return;
        }
        const branchIds = assignments.map(a => a.branch_id);
        const { data: branches, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .in('id', branchIds);
        if (branchesError) throw branchesError;
        setAssignedBranches(branches as Branch[] || []);
      } catch (error: any) {
        toast({ title: "Error", description: `Failed to fetch branches for modal: ${error.message}`, variant: "destructive" });
        setAssignedBranches([]);
      } finally {
        setIsLoadingBranches(false);
      }
    }
  }, [user, toast]);

  useEffect(() => {
    if (isOpen) { 
      fetchAssignedBranches();
    }
  }, [isOpen, fetchAssignedBranches]);

  const initialDataForForm = visitToEdit ? {
    ...visitToEdit,
    visit_date: visitToEdit.visit_date ? new Date(visitToEdit.visit_date) : new Date(),
    hr_connect_employees_invited: visitToEdit.hr_connect_employees_invited ?? undefined,
    hr_connect_participants: visitToEdit.hr_connect_participants ?? undefined,
    manning_percentage: visitToEdit.manning_percentage ?? undefined,
    attrition_percentage: visitToEdit.attrition_percentage ?? undefined,
    non_vendor_percentage: visitToEdit.non_vendor_percentage ?? undefined,
    er_percentage: visitToEdit.er_percentage ?? undefined,
    cwt_cases: visitToEdit.cwt_cases ?? undefined,
    new_employees_total: visitToEdit.new_employees_total ?? undefined,
    new_employees_covered: visitToEdit.new_employees_covered ?? undefined,
    star_employees_total: visitToEdit.star_employees_total ?? undefined,
    star_employees_covered: visitToEdit.star_employees_covered ?? undefined,
    additional_remarks: visitToEdit.additional_remarks ?? '',
  } : undefined;


  const handleFormSubmitInModal = async (data: VisitFormValues, statusToSet: VisitStatus) => {
    if (!visitToEdit || !user) {
      toast({ title: "Error", description: "No visit selected or user not authenticated.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    console.log("handleFormSubmitInModal: Submitting visit with data:", data);
    console.log("handleFormSubmitInModal: Status to set:", statusToSet);
    console.log("handleFormSubmitInModal: visitToEdit:", visitToEdit);
    console.log("handleFormSubmitInModal: user:", user);
    console.log("handleFormSubmitInModal: assignedBranches:", assignedBranches);

    // Ensure branches are loaded before proceeding
    if (isLoadingBranches) {
      toast({ title: "Loading Data", description: "Branch data is still loading. Please wait a moment and try again.", variant: "default" });
      setIsSubmitting(false);
      return;
    }
    
    const currentSelectedBranchInfo = assignedBranches.find(b => b.id === data.branch_id);
    
    // Explicitly check if the branch was found
    if (!currentSelectedBranchInfo) {
      toast({ title: "Error", description: "Could not find details for the selected branch. It may not be assigned to you or there was a loading issue.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const visitPayload = {
      ...data,
      bhr_id: user.id, 
      visit_date: format(data.visit_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      status: statusToSet, 
      hr_connect_conducted: data.hr_connect_conducted,
      hr_connect_employees_invited: data.hr_connect_conducted ? data.hr_connect_employees_invited : null,
      hr_connect_participants: data.hr_connect_conducted ? data.hr_connect_participants : null,
    };
    
    const { id: visitId, ...payloadWithoutId } = visitPayload as any;

    console.log("handleFormSubmitInModal: Payload for update:", payloadWithoutId);
    console.log("handleFormSubmitInModal: Updating visit with ID:", visitToEdit.id, "and BHR ID:", user.id);

    try {
      const { error } = await supabase
        .from('visits')
        .update(payloadWithoutId)
        .eq('id', visitToEdit.id)
        .eq('bhr_id', user.id); 

      if (error) throw error;

      toast({
        title: "Visit Updated!",
        description: `Visit to ${currentSelectedBranchInfo.name} on ${format(data.visit_date, "PPP")} has been updated and ${statusToSet === 'submitted' ? 'submitted' : 'saved as draft'}.`,
      });
      onVisitUpdated(); 
      onClose(); 
    } catch (error: any) {
      toast({ title: "Error Updating Visit", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!visitToEdit) return null;

  const getModalTitle = () => {
    if (!visitToEdit) return '';
    if (isLoadingBranches) return 'Loading branch...';
    const branch = assignedBranches.find(b => b.id === visitToEdit.branch_id);
    const branchName = branch?.name || 'Unknown Branch';
    const visitDate = visitToEdit.visit_date ? format(new Date(visitToEdit.visit_date), 'MMMM do, yyyy') : '';
    return `${branchName} - ${visitDate}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <div className="max-w-4xl mx-auto">
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-y-auto bg-gradient-to-b from-white to-slate-50/80 border-slate-200/60 shadow-lg">
        <DialogHeader className="space-y-3 pb-6 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-[#004C8F] to-[#0066BD]" />
            <div>
              <DialogTitle className="text-2xl font-semibold bg-gradient-to-br from-[#004C8F] to-[#0066BD] bg-clip-text text-transparent">
                {visitToEdit?.status === 'draft' ? 'Edit Draft Visit' : 'View Visit Details'}
              </DialogTitle>
              <DialogDescription className="text-base text-slate-600 mt-1">
                {visitToEdit?.status === 'draft' ? 'Update the details of your draft visit' : 'Details for the visit'} to <span className="font-medium text-slate-700">{getModalTitle()}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-140px)] pr-4 -mr-4 px-6 py-4">
        <VisitForm
          initialData={initialDataForForm}
          onSubmitForm={handleFormSubmitInModal}
          isSubmitting={isSubmitting}
          assignedBranches={assignedBranches}
          isLoadingBranches={isLoadingBranches}
          submitButtonText="Update & Submit"
          draftButtonText="Save Changes as Draft"
          isViewMode={visitToEdit?.status === 'submitted'}
        />
        </ScrollArea>
        <DialogFooter>
        </DialogFooter>
      </DialogContent>
      </div>
    </Dialog>
  );
}
