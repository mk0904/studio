
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal'; // Reusing ZHR modal

export default function VHRBranchVisitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);
  const [bhrUsersInVertical, setBhrUsersInVertical] = useState<User[]>([]);
  const [allBranchesInVertical, setAllBranchesInVertical] = useState<Branch[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  const columns: ColumnConfig<Visit>[] = useMemo(() => [
    { 
      accessorKey: 'bhr_id', 
      header: 'BHR Name',
      cell: (visit) => {
          const bhr = bhrUsersInVertical.find(u => u.id === visit.bhr_id);
          return bhr ? bhr.name : 'N/A';
      }
    },
    { 
      accessorKey: 'branch_id', 
      header: 'Branch Name',
      cell: (visit) => {
          const branch = allBranchesInVertical.find(b => b.id === visit.branch_id);
          return branch ? branch.name : 'N/A';
      }
    },
    { 
      accessorKey: 'visit_date', 
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP') 
    },
    { 
      accessorKey: 'additional_remarks', 
      header: 'Remarks', 
      cell: (visit) => <p className="max-w-md whitespace-pre-wrap break-words">{visit.additional_remarks}</p>
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (visit) => {
        const handleViewClick = () => {
          const branch = allBranchesInVertical.find(b => b.id === visit.branch_id);
          const bhr = bhrUsersInVertical.find(u => u.id === visit.bhr_id);
          const enrichedVisit: EnrichedVisitForModal = {
            ...(visit as Visit), // Cast to Visit
            branch_name_display: branch?.name || visit.branch_id,
            branch_category_display: branch?.category,
            branch_code_display: branch?.code,
            bhr_name_display: bhr?.name || visit.bhr_id,
          };
          setSelectedVisitForView(enrichedVisit);
          setIsViewModalOpen(true);
        };
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewClick}
          >
            <Eye className="mr-2 h-4 w-4" /> View
          </Button>
        );
      }
    }
  ], [bhrUsersInVertical, allBranchesInVertical]);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'VHR') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // 1. Fetch ZHRs reporting to this VHR
      const { data: zhrUsersData, error: zhrError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'ZHR')
        .eq('reports_to', user.id);
      if (zhrError) throw zhrError;
      const zhrIds = (zhrUsersData || []).map(z => z.id);

      if (zhrIds.length === 0) {
        setBhrUsersInVertical([]);
        setAllBranchesInVertical([]);
        setAllSubmittedVisits([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch BHRs reporting to these ZHRs
      const { data: bhrsData, error: bhrError } = await supabase
        .from('users')
        .select('id, name, e_code')
        .eq('role', 'BHR')
        .in('reports_to', zhrIds);
      if (bhrError) throw bhrError;
      setBhrUsersInVertical(bhrsData || []);
      const bhrIds = (bhrsData || []).map(b => b.id);

      if (bhrIds.length === 0) {
        setAllBranchesInVertical([]);
        setAllSubmittedVisits([]);
        setIsLoading(false);
        return;
      }

      // 3. Fetch all branches (for name lookup)
      // In a real app, might only fetch branches relevant to these BHRs if performance is a concern
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, category, code, location'); // Fetch all needed fields
      if (branchesError) throw branchesError;
      setAllBranchesInVertical(branchesData || []);

      // 4. Fetch submitted visits by these BHRs, ordered by date
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .in('bhr_id', bhrIds)
        .eq('status', 'submitted')
        .order('visit_date', { ascending: false });
      if (visitsError) throw visitsError;
      setAllSubmittedVisits((visitsData as Visit[]) || []);

    } catch (error: any) {
      console.error("VHRBranchVisitsPage: Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load branch visits: ${error.message}`, variant: "destructive" });
      setAllSubmittedVisits([]);
      setBhrUsersInVertical([]);
      setAllBranchesInVertical([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  if (!user) return null;

  if (isLoading && user.role === 'VHR') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading submitted branch visits...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="All Submitted Branch Visits in Vertical" description="A comprehensive log of all submitted visits within your vertical, sorted by most recent." />
      <DataTable
        columns={columns}
        data={allSubmittedVisits}
        emptyStateMessage="No submitted visits recorded in your vertical yet."
      />
      {selectedVisitForView && (
        <ViewVisitDetailsModal
            visit={selectedVisitForView}
            isOpen={isViewModalOpen}
            onClose={() => {
                setIsViewModalOpen(false);
                setSelectedVisitForView(null);
            }}
        />
      )}
    </div>
  );
}
