
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
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import { useVhrFilter } from '@/contexts/vhr-filter-context'; // Import VHR filter hook

export default function VHRBranchVisitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    selectedZhrIds, 
    allBhrsInVhrVertical, 
    isLoadingBhrsInVhrVertical 
  } = useVhrFilter();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [allVisitsForVhr, setAllVisitsForVhr] = useState<Visit[]>([]);
  const [allBranchesForLookup, setAllBranchesForLookup] = useState<Branch[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'VHR' || isLoadingBhrsInVhrVertical) {
      setIsLoadingPageData(false);
      return;
    }
    setIsLoadingPageData(true);
    try {
      // BHRs are already available from VhrFilterContext (allBhrsInVhrVertical)
      const bhrIdsInEntireVertical = allBhrsInVhrVertical.map(b => b.id);

      if (bhrIdsInEntireVertical.length === 0) {
        setAllVisitsForVhr([]);
        setIsLoadingPageData(false);
        return;
      }

      // Fetch all branches for name lookup and modal
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, category, code, location');
      if (branchesError) throw branchesError;
      setAllBranchesForLookup(branchesData || []);

      // Fetch submitted visits by BHRs in the entire VHR vertical
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .in('bhr_id', bhrIdsInEntireVertical)
        .eq('status', 'submitted')
        .order('visit_date', { ascending: false });
      if (visitsError) throw visitsError;
      setAllVisitsForVhr((visitsData as Visit[]) || []);

    } catch (error: any) {
      console.error("VHRBranchVisitsPage: Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load branch visits: ${error.message}`, variant: "destructive" });
      setAllVisitsForVhr([]);
      setAllBranchesForLookup([]);
    } finally {
      setIsLoadingPageData(false);
    }
  }, [user, toast, allBhrsInVhrVertical, isLoadingBhrsInVhrVertical]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredVisits = useMemo(() => {
    if (selectedZhrIds.length === 0) {
      return allVisitsForVhr; // Show all visits in vertical if no ZHR is selected
    }
    // Filter BHRs based on selected ZHRs
    const bhrIdsInSelectedZhrs = allBhrsInVhrVertical
      .filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to))
      .map(bhr => bhr.id);
    
    return allVisitsForVhr.filter(visit => bhrIdsInSelectedZhrs.includes(visit.bhr_id));
  }, [allVisitsForVhr, selectedZhrIds, allBhrsInVhrVertical]);

  const columns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id',
      header: 'BHR Name',
      cell: (visit) => {
          const bhr = allBhrsInVhrVertical.find(u => u.id === visit.bhr_id);
          return bhr ? bhr.name : 'N/A';
      }
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch Name',
      cell: (visit) => {
          const branch = allBranchesForLookup.find(b => b.id === visit.branch_id);
          return branch ? branch.name : 'N/A';
      }
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP')
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (visit) => {
        const handleViewClick = () => {
          const branch = allBranchesForLookup.find(b => b.id === visit.branch_id);
          const bhr = allBhrsInVhrVertical.find(u => u.id === visit.bhr_id);
          const enrichedVisit: EnrichedVisitForModal = {
            ...(visit as Visit),
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
  ], [allBhrsInVhrVertical, allBranchesForLookup]);


  const isLoading = isLoadingBhrsInVhrVertical || isLoadingPageData;
  
  const pageTitleText = useMemo(() => {
    let title = "All Submitted Branch Visits";
    if (selectedZhrIds.length > 0 && !isLoadingBhrsInVhrVertical) { // Check isLoadingZhrOptions from context if needed
        if (selectedZhrIds.length === 1) {
            // Assuming zhrOptions are available from context to get name
            // For now, just count. If context provided zhrOptions:
            // const zhr = zhrOptions.find(z => z.value === selectedZhrIds[0]);
            // title += ` (for ${zhr?.label || 'Selected ZHR'})`;
            title += ` (Filtered by 1 ZHR)`;
        } else {
            title += ` (Filtered by ${selectedZhrIds.length} ZHRs)`;
        }
    } else {
        title += " (Entire Vertical)";
    }
    return title;
  }, [selectedZhrIds, isLoadingBhrsInVhrVertical]);


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
      <PageTitle title={pageTitleText} description="A comprehensive log of all submitted visits, sortable by most recent, filterable by ZHRs in header." />
      <DataTable
        columns={columns}
        data={filteredVisits}
        emptyStateMessage={isLoading ? "Loading..." : "No submitted visits recorded for the current filter."}
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
