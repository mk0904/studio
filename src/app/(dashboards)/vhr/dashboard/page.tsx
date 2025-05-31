
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarCheck, BarChart3, Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Visit, User, Branch } from '@/types';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { format, parseISO } from 'date-fns';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import { useVhrFilter } from '@/contexts/vhr-filter-context';

export default function VHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    selectedZhrIds, 
    zhrOptions, 
    isLoadingZhrOptions,
    allBhrsInVhrVertical,
    isLoadingBhrsInVhrVertical
  } = useVhrFilter();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [allSubmittedVisitsInVertical, setAllSubmittedVisitsInVertical] = useState<Visit[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]); // For branch name lookups in modal

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  useEffect(() => {
    if (user && user.role === 'VHR') {
      const fetchData = async () => {
        if (isLoadingBhrsInVhrVertical) return; // Wait for BHRs to be loaded by context

        setIsLoadingPageData(true);
        try {
          // Fetch all branches once for modal name lookups
          const { data: branchesData, error: branchesErr } = await supabase
            .from('branches')
            .select('id, name, category, code');
          if (branchesErr) throw branchesErr;
          setAllBranches(branchesData || []);

          // Fetch submitted visits by BHRs in the entire VHR vertical
          const bhrIdsInEntireVertical = allBhrsInVhrVertical.map(b => b.id);
          if (bhrIdsInEntireVertical.length > 0) {
            const { data: visits, error: visitsError } = await supabase
              .from('visits')
              .select('*')
              .in('bhr_id', bhrIdsInEntireVertical)
              .eq('status', 'submitted')
              .order('visit_date', { ascending: false });
            if (visitsError) throw visitsError;
            setAllSubmittedVisitsInVertical((visits as Visit[]) || []);
          } else {
            setAllSubmittedVisitsInVertical([]);
          }
        } catch (error: any) {
          console.error("VHRDashboard: Error fetching page data (visits/branches):", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setAllSubmittedVisitsInVertical([]);
          setAllBranches([]);
        } finally {
          setIsLoadingPageData(false);
        }
      };
      fetchData();
    } else {
      setIsLoadingPageData(false);
    }
  }, [user, toast, allBhrsInVhrVertical, isLoadingBhrsInVhrVertical]);

  const filteredBhrs = useMemo(() => {
    if (selectedZhrIds.length === 0) {
      return allBhrsInVhrVertical; // All BHRs under this VHR
    }
    return allBhrsInVhrVertical.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
  }, [selectedZhrIds, allBhrsInVhrVertical]);

  const filteredSubmittedVisits = useMemo(() => {
    const bhrIdsInScope = filteredBhrs.map(b => b.id);
    if (bhrIdsInScope.length === 0 && (selectedZhrIds.length > 0 || allBhrsInVhrVertical.length > 0)) {
        // If a ZHR filter is active but results in no BHRs, or if there are BHRs in vertical but none match current ZHR filter
        return [];
    }
    return allSubmittedVisitsInVertical.filter(visit => bhrIdsInScope.includes(visit.bhr_id));
  }, [allSubmittedVisitsInVertical, filteredBhrs, selectedZhrIds, allBhrsInVhrVertical]);

  const dashboardStats = useMemo(() => {
    const zhrCountDisplay = selectedZhrIds.length > 0 ? selectedZhrIds.length : zhrOptions.length;
    const bhrCountDisplay = filteredBhrs.length;
    const totalVisitsDisplay = filteredSubmittedVisits.length;
    
    return {
      zhrCount: zhrCountDisplay,
      bhrCount: bhrCountDisplay,
      totalSubmittedVisits: totalVisitsDisplay,
    };
  }, [selectedZhrIds, zhrOptions.length, filteredBhrs, filteredSubmittedVisits]);

  const recentVisitsForTable = useMemo(() => {
    return filteredSubmittedVisits.slice(0, 5).map(v => {
      const branch = allBranches.find(b => b.id === v.branch_id);
      const bhr = allBhrsInVhrVertical.find(u => u.id === v.bhr_id); // Use allBhrs for BHR name lookup
      return {
          ...v,
          branch_name_display: branch?.name || v.branch_id,
          branch_category_display: branch?.category,
          branch_code_display: branch?.code,
          bhr_name_display: bhr?.name || v.bhr_id,
      };
    });
  }, [filteredSubmittedVisits, allBranches, allBhrsInVhrVertical]);
  
  const recentVisitsColumns: ColumnConfig<EnrichedVisitForModal>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id',
      header: 'BHR Name',
      cell: (visit) => visit.bhr_name_display || 'N/A',
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch',
      cell: (visit) => visit.branch_name_display || 'N/A',
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP')
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (visit) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedVisitForView(visit);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="mr-2 h-4 w-4" /> View
        </Button>
      ),
    }
  ], []);
  
  const isLoading = isLoadingZhrOptions || isLoadingBhrsInVhrVertical || isLoadingPageData;

  const pageTitleText = useMemo(() => {
    let title = "VHR Dashboard";
    if (selectedZhrIds.length > 0) {
      if (selectedZhrIds.length === 1) {
        const zhr = zhrOptions.find(z => z.value === selectedZhrIds[0]);
        title += ` (${zhr?.label || 'Selected ZHR'})`;
      } else {
        title += ` (${selectedZhrIds.length} ZHRs)`;
      }
    } else {
      title += ` (${user?.name || 'Vertical Overview'})`;
    }
    return title;
  }, [selectedZhrIds, zhrOptions, user?.name]);


  if (!user) return null;

  if (isLoading && user.role === 'VHR') {
    return (
      <div className="space-y-8">
        <PageTitle title={pageTitleText} description={`Loading data...`} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title={pageTitleText} description={`Submitted Data Overview. ${selectedZhrIds.length === 0 ? "Showing all ZHRs in your vertical." : ""}`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="ZHRs in Scope" value={dashboardStats.zhrCount} icon={Users} description={selectedZhrIds.length > 0 ? "Selected ZHRs" : "Total ZHRs in your vertical."} />
        <StatCard title="BHRs in Scope" value={dashboardStats.bhrCount} icon={Users} description="BHRs under selected ZHR(s) or all in vertical." />
        <StatCard title="Total Submitted Visits" value={dashboardStats.totalSubmittedVisits} icon={CalendarCheck} description="Submitted visits by BHRs in scope." />
        <Link href="/vhr/analytics" className="lg:col-span-1 md:col-span-2">
          <Button className="w-full h-full text-lg py-6 md:py-8" variant="outline">
            <BarChart3 className="mr-2 h-6 w-6" /> View Detailed Analytics
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
         <DataTable
          columns={recentVisitsColumns}
          data={recentVisitsForTable}
          title="Recent Submitted Visits in Scope (Top 5)"
          emptyStateMessage={isLoading ? "Loading..." : "No recent submitted visits for the current filter."}
        />
      </div>

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
