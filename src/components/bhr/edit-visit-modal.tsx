
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

    const currentSelectedBranchInfo = assignedBranches.find(b => b.id === data.branch_id);
    if (!currentSelectedBranchInfo) {
      toast({ title: "Error", description: "Selected branch details not found. Please re-select the branch.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const visitPayload = {
      ...data,
      bhr_id: user.id, 
      bhr_name: user.name,
      branch_name: currentSelectedBranchInfo.name,
      visit_date: format(data.visit_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      status: statusToSet, 
      hr_connect_conducted: data.hr_connect_conducted,
      hr_connect_employees_invited: data.hr_connect_conducted ? data.hr_connect_employees_invited : null,
      hr_connect_participants: data.hr_connect_conducted ? data.hr_connect_participants : null,
    };
    
    const { id: visitId, ...payloadWithoutId } = visitPayload as any;


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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Draft Visit</DialogTitle>
          <DialogDescription>
            Update the details of your draft visit to {visitToEdit.branch_name}. You can save changes as a draft or submit the report.
          </DialogDescription>
        </DialogHeader>
        
        <VisitForm
          initialData={initialDataForForm}
          onSubmitForm={handleFormSubmitInModal}
          isSubmitting={isSubmitting}
          assignedBranches={assignedBranches}
          isLoadingBranches={isLoadingBranches}
          submitButtonText="Update & Submit"
          draftButtonText="Save Changes as Draft"
        />
        
      </DialogContent>
    </Dialog>
  );
}
