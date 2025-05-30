
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, VisitStatus } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { VisitForm, type VisitFormValues } from '@/components/bhr/visit-form';
import { useSearchParams, useRouter } from 'next/navigation'; // useRouter for redirect

export default function ManageVisitPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter(); // For redirecting after submission
  const searchParams = useSearchParams();
  const visitIdToLoad = searchParams.get('visit_id');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [initialVisitData, setInitialVisitData] = useState<Partial<VisitFormValues> | undefined>(undefined);
  const [isLoadingVisitData, setIsLoadingVisitData] = useState(false);


  const fetchAssignedBranches = useCallback(async () => {
    if (user && user.role === 'BHR') {
      setIsLoadingBranches(true);
      setFetchError(null);
      console.log("ManageVisitPage: Fetching assigned branches for BHR:", user.id);
      try {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('assignments')
          .select('branch_id')
          .eq('bhr_id', user.id);

        console.log("ManageVisitPage: Fetched assignments:", assignments, "Error:", assignmentsError);
        if (assignmentsError) throw assignmentsError;
        if (!assignments || assignments.length === 0) {
          setAssignedBranches([]);
          console.log("ManageVisitPage: No assignments found for BHR.");
          setIsLoadingBranches(false);
          return;
        }

        const branchIds = assignments.map(a => a.branch_id);
        console.log("ManageVisitPage: Branch IDs from assignments:", branchIds);
        const { data: branches, error: branchesError } = await supabase
          .from('branches')
          .select('*')
          .in('id', branchIds);
        
        console.log("ManageVisitPage: Fetched branches:", branches, "Error:", branchesError);
        if (branchesError) throw branchesError;
        setAssignedBranches(branches as Branch[] || []);
      } catch (error: any) {
        console.error("Error fetching assigned branches:", error);
        toast({ title: "Error", description: `Failed to fetch assigned branches: ${error.message}`, variant: "destructive" });
        setFetchError(`Failed to fetch assigned branches: ${error.message}`);
        setAssignedBranches([]);
      } finally {
        setIsLoadingBranches(false);
        console.log("ManageVisitPage: Finished fetching branches. Loading state:", false);
      }
    } else {
      setIsLoadingBranches(false);
      setAssignedBranches([]);
      console.log("ManageVisitPage: No user or user is not BHR, skipping branch fetch.");
    }
  }, [user, toast]);

  useEffect(() => {
    fetchAssignedBranches();
  }, [fetchAssignedBranches]);


  useEffect(() => {
    const fetchVisitToLoad = async () => {
      if (visitIdToLoad && user) {
        setIsLoadingVisitData(true);
        setFetchError(null);
        try {
          const { data: visitData, error } = await supabase
            .from('visits')
            .select('*')
            .eq('id', visitIdToLoad)
            .eq('bhr_id', user.id) // Ensure BHR can only load their own visits
            .single();

          if (error) {
             if (error.code === 'PGRST116') { // Single row not found
                toast({ title: "Not Found", description: "Visit not found or you don't have permission to view it.", variant: "destructive" });
                router.push('/bhr/my-visits'); // Redirect if not found
             } else {
                throw error;
             }
          }
          if (visitData) {
            // Transform data for the form
            const formData: Partial<VisitFormValues> = {
              ...visitData,
              visit_date: visitData.visit_date ? new Date(visitData.visit_date) : new Date(),
              // Ensure all optional numeric fields are numbers or undefined
              hr_connect_employees_invited: visitData.hr_connect_employees_invited ?? undefined,
              hr_connect_participants: visitData.hr_connect_participants ?? undefined,
              manning_percentage: visitData.manning_percentage ?? undefined,
              attrition_percentage: visitData.attrition_percentage ?? undefined,
              non_vendor_percentage: visitData.non_vendor_percentage ?? undefined,
              er_percentage: visitData.er_percentage ?? undefined,
              cwt_cases: visitData.cwt_cases ?? undefined,
              new_employees_total: visitData.new_employees_total ?? undefined,
              new_employees_covered: visitData.new_employees_covered ?? undefined,
              star_employees_total: visitData.star_employees_total ?? undefined,
              star_employees_covered: visitData.star_employees_covered ?? undefined,
            };
            setInitialVisitData(formData);
          }
        } catch (error: any) {
          console.error("Error fetching visit to load:", error);
          toast({ title: "Error", description: `Failed to load visit data: ${error.message}`, variant: "destructive" });
          setFetchError(`Failed to load visit data: ${error.message}`);
        } finally {
          setIsLoadingVisitData(false);
        }
      }
    };

    if (visitIdToLoad) {
      fetchVisitToLoad();
    }
  }, [visitIdToLoad, user, toast, router]);


  const handleFormSubmit = async (data: VisitFormValues, statusToSet: VisitStatus) => {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const currentSelectedBranchInfo = assignedBranches.find(b => b.id === data.branch_id);
    if (!currentSelectedBranchInfo) {
      toast({ title: "Error", description: "Selected branch details not found. Please re-select the branch.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    // Remove undefined fields before sending to Supabase to avoid issues with optional fields
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));


    const visitPayload = {
      ...cleanData, // Use cleaned data
      bhr_id: user.id,
      branch_id: data.branch_id, // branch_id must be present from form
      bhr_name: user.name,
      branch_name: currentSelectedBranchInfo.name,
      visit_date: format(data.visit_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"), // Ensure ISO 8601
      status: statusToSet,
      // Explicitly set hr_connect fields to null if not conducted
      hr_connect_conducted: data.hr_connect_conducted ?? false,
      hr_connect_employees_invited: data.hr_connect_conducted ? data.hr_connect_employees_invited : null,
      hr_connect_participants: data.hr_connect_conducted ? data.hr_connect_participants : null,
    };
    
    // Remove id from payload if it's an update, as it's used in .eq('id', visitIdToLoad)
    const { id: formId, ...payloadForUpsert } = visitPayload as any;


    try {
      let responseError;
      if (visitIdToLoad && initialVisitData) { // This is an update
        const { error } = await supabase
            .from('visits')
            .update(payloadForUpsert)
            .eq('id', visitIdToLoad)
            .eq('bhr_id', user.id); // Ensure BHR can only update their own visits
        responseError = error;
      } else { // This is an insert
        const { error } = await supabase.from('visits').insert(payloadForUpsert);
        responseError = error;
      }

      if (responseError) throw responseError;

      toast({
        title: visitIdToLoad ? "Visit Updated!" : (statusToSet === 'draft' ? "Visit Saved as Draft!" : "Visit Submitted Successfully!"),
        description: `${visitIdToLoad ? 'Changes to visit' : (statusToSet === 'draft' ? 'Draft for' : 'Visit to')} ${currentSelectedBranchInfo?.name} on ${format(data.visit_date, "PPP")} has been recorded.`,
      });
      if (statusToSet !== 'draft' || visitIdToLoad) { // Redirect if submitted or if it was an update
        router.push('/bhr/my-visits');
      }
      // Form reset is handled within VisitForm for new entries
    } catch (error: any) {
      console.error("Error submitting/updating visit object:", error); // Log the full error object
      const errorMessage = error?.message || "An unexpected error occurred.";
      toast({ 
        title: "Error", 
        description: `Failed to ${visitIdToLoad ? 'update' : 'submit'} visit: ${errorMessage}`, 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const pageTitle = visitIdToLoad ? (initialVisitData?.status === 'draft' ? "Edit Draft Visit" : "View/Edit Visit") : "Log New Branch Visit";
  const pageDescription = visitIdToLoad ? `Viewing/Editing visit for ${initialVisitData?.branch_id ? assignedBranches.find(b=>b.id===initialVisitData.branch_id)?.name : '...'}` : "Record the details of your recent branch visit.";


  if (!user) return <PageTitle title="Loading user..." />;
  if (isLoadingVisitData && visitIdToLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading visit details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageTitle title={pageTitle} description={pageDescription} />
      
      {fetchError && (
         <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {(!visitIdToLoad || initialVisitData) && ( // Render form if new or if initial data for edit has loaded
         <VisitForm
            initialData={initialVisitData}
            onSubmitForm={handleFormSubmit}
            isSubmitting={isSubmitting}
            assignedBranches={assignedBranches}
            isLoadingBranches={isLoadingBranches}
            onFormReset={() => setInitialVisitData(undefined)} // For new entries after submission
         />
      )}
    </div>
  );
}
