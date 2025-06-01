'use client';

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageTitle } from "@/components/shared/page-title";
import { VisitForm, type VisitFormValues } from "@/components/bhr/visit-form";
import type { Branch, VisitStatus } from "@/types";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

export default function ManageVisitPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter(); 
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
            .eq('bhr_id', user.id) 
            .single();

          if (error) {
             if (error.code === 'PGRST116') { 
                toast({ title: "Not Found", description: "Visit not found or you don't have permission to view it.", variant: "destructive" });
                router.push('/bhr/my-visits'); 
             } else {
                throw error;
             }
          }
          if (visitData) {
            const formData: Partial<VisitFormValues> = {
              ...visitData,
              visit_date: visitData.visit_date ? new Date(visitData.visit_date) : new Date(),
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

    const cleanData = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

    const visitPayload = {
      ...cleanData, 
      bhr_id: user.id,
      branch_id: data.branch_id, 
      // bhr_name: user.name, // Removed
      // branch_name: currentSelectedBranchInfo.name, // Removed
      visit_date: format(data.visit_date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"), 
      status: statusToSet,
      hr_connect_conducted: data.hr_connect_conducted ?? false,
      hr_connect_employees_invited: data.hr_connect_conducted ? data.hr_connect_employees_invited : null,
      hr_connect_participants: data.hr_connect_conducted ? data.hr_connect_participants : null,
    };
    
    const { id: formId, ...payloadForUpsert } = visitPayload as any;

    try {
      let responseError;
      if (visitIdToLoad && initialVisitData) { 
        const { error } = await supabase
            .from('visits')
            .update(payloadForUpsert)
            .eq('id', visitIdToLoad)
            .eq('bhr_id', user.id); 
        responseError = error;
      } else { 
        const { error } = await supabase.from('visits').insert(payloadForUpsert);
        responseError = error;
      }

      if (responseError) throw responseError;
      
      const currentSelectedBranchInfo = assignedBranches.find(b => b.id === data.branch_id); // Get branch info for toast

      toast({
        title: visitIdToLoad ? "Visit Updated!" : (statusToSet === 'draft' ? "Visit Saved as Draft!" : "Visit Submitted Successfully!"),
        description: `${visitIdToLoad ? 'Changes to visit' : (statusToSet === 'draft' ? 'Draft for' : 'Visit to')} ${currentSelectedBranchInfo?.name || 'the branch'} on ${format(data.visit_date, "PPP")} has been recorded.`,
      });
      if (statusToSet !== 'draft' || visitIdToLoad) { 
        router.push('/bhr/my-visits');
      }
    } catch (error: any) {
      console.error("Error submitting/updating visit object:", error); 
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
  
  if (!user) return <PageTitle title="Loading user..." />;

  if (isLoadingVisitData && visitIdToLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading visit details...</p>
      </div>
    );
  }

  if (isLoadingBranches) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading branches...</p>
      </div>
    );
  }

  const pageTitle = visitIdToLoad ? (initialVisitData?.status === 'draft' ? "Edit Draft Visit" : "View/Edit Visit") : "Log New Branch Visit";
  const pageDescription = visitIdToLoad ? 
    `Viewing/Editing visit for ${initialVisitData?.branch_id ? assignedBranches.find((b: Branch) => b.id === initialVisitData.branch_id)?.name : '...'}` : 
    "Please fill in the details of your recent branch visit. All fields marked with * are required.";

  return (
    <div className="min-h-screen flex justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50/80">
      <div className="w-full max-w-6xl py-8 px-4">
        <div className="mb-8">
          <PageTitle 
            title={pageTitle} 
            description={pageDescription}
          />
        </div>

        {fetchError ? (
          <Alert variant="destructive" className="mt-4 border-2 border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-base font-semibold">Error Loading Form</AlertTitle>
            <AlertDescription className="text-sm">{fetchError}</AlertDescription>
          </Alert>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-white/40 backdrop-blur-sm shadow-sm hover:shadow transition-all duration-200 border border-slate-200/50">
            <div className="absolute inset-0 bg-gradient-to-br from-[#004C8F]/5 via-transparent to-[#004C8F]/5" />
            <div className="relative p-6">
              <VisitForm
                initialData={initialVisitData}
                onSubmitForm={handleFormSubmit}
                isSubmitting={isSubmitting}
                assignedBranches={assignedBranches}
                isLoadingBranches={isLoadingBranches}
                submitButtonText={visitIdToLoad ? "Update Visit" : "Submit Visit"}
                draftButtonText={visitIdToLoad ? "Save Changes" : "Save as Draft"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
