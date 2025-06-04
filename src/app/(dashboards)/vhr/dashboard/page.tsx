
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, User, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarCheck, BarChart3, Loader2, Eye, Calendar, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { PageTitle } from '@/components/shared/page-title';
import { ZhrFilterDropdown } from '@/components/shared/ZhrFilterDropdown';
import { format, parseISO } from 'date-fns';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import { useVhrFilter } from '@/contexts/vhr-filter-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  useEffect(() => {
    if (user && user.role === 'VHR') {
      const fetchData = async () => {
        if (isLoadingBhrsInVhrVertical) return;

        setIsLoadingPageData(true);
        try {
          const { data: branchesData, error: branchesErr } = await supabase
            .from('branches')
            .select('id, name, category, code');
          if (branchesErr) throw branchesErr;
          setAllBranches(branchesData || []);

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
      return allBhrsInVhrVertical;
    }
    return allBhrsInVhrVertical.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
  }, [selectedZhrIds, allBhrsInVhrVertical]);

  const filteredSubmittedVisits = useMemo(() => {
    const bhrIdsInScope = filteredBhrs.map(b => b.id);
    if (bhrIdsInScope.length === 0 && (selectedZhrIds.length > 0 || allBhrsInVhrVertical.length > 0)) {
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
      const bhr = allBhrsInVhrVertical.find(u => u.id === v.bhr_id);
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
          className="h-9 px-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-colors duration-150"
        >
          <Eye className="mr-1.5 h-4 w-4 text-slate-500" /> View
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
      <div className="flex min-h-full w-full flex-col items-center bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
          <div className="flex flex-col space-y-4 sm:space-y-6">
            <PageTitle
  title={pageTitleText}
  description={`Loading data for ${format(new Date(), 'MMMM yyyy')}...`}
  action={<ZhrFilterDropdown />}
/>
          </div>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-[#004C8F]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col items-center bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">

        <div className="flex flex-col space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-4">
            <PageTitle
  title={pageTitleText}
  description={`Submitted Data Overview for ${format(new Date(), 'MMMM yyyy')}. ${selectedZhrIds.length === 0 ? "Showing all ZHRs in your vertical." : ""}`}
  action={<ZhrFilterDropdown />}
/>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          <Card className="relative overflow-hidden border border-indigo-500/10 bg-gradient-to-br from-white to-indigo-500/5 transition-all duration-200 hover:border-indigo-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-indigo-700">ZHRs in Scope</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                {selectedZhrIds.length > 0 ? "Selected ZHRs" : "Total ZHRs in your vertical"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.zhrCount}</div>
              <div className="text-xs text-indigo-600/90 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>ZHRs</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-[#004C8F]/10 bg-gradient-to-br from-white to-[#004C8F]/5 transition-all duration-200 hover:border-[#004C8F]/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-sky-700">BHRs in Scope</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                 BHRs under current ZHR selection
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.bhrCount}</div>
              <div className="text-xs text-sky-600/90 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>BHRs</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden border border-emerald-500/10 bg-gradient-to-br from-white to-emerald-500/5 transition-all duration-200 hover:border-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-2 sm:col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700">Total Submitted Visits</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                By BHRs in current scope
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.totalSubmittedVisits}</div>
              <div className="text-xs text-emerald-600/90 flex items-center gap-1">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span>Visits</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-orange-500/10 bg-gradient-to-br from-white to-orange-500/5 transition-all duration-200 hover:border-orange-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-2 sm:col-span-1 group">
            <Link href="/vhr/analytics" className="flex flex-col flex-1 justify-center items-center p-4 text-center hover:bg-orange-500/5 rounded-lg">
                <BarChart3 className="h-7 w-7 text-orange-600 mb-2" />
                <p className="text-sm font-semibold text-orange-700">View Detailed Analytics</p>
                <p className="text-xs text-orange-500/90 mt-0.5">Dive deeper into trends</p>
            </Link>
          </Card>
        </div>

        <div className="w-full">
          <Card className="border border-slate-200/50 bg-white/95 backdrop-blur-sm transition-all duration-200 hover:border-slate-300/50 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
            <div className="flex flex-col min-h-[300px]">
              <CardHeader className="items-start p-6 sm:p-8 pb-4">
                <CardTitle className="text-base font-semibold text-slate-800">Recent Submitted Visits in Scope (Top 5)</CardTitle>
                <CardDescription className="text-xs text-slate-600">Quick overview of the latest visit reports from BHRs under the current filter.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow p-0 sm:p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-[#004C8F]" />
                  </div>
                ) : recentVisitsForTable.length > 0 ? (
                  <DataTable
                    columns={recentVisitsColumns}
                    data={recentVisitsForTable}
                    tableClassName="[&_thead_th]:bg-slate-50/80 [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:text-slate-600 [&_thead_th]:h-14 [&_thead_th]:px-6 [&_thead]:border-b [&_thead]:border-slate-200/60 [&_tbody_td]:px-6 [&_tbody_td]:py-4 [&_tbody_td]:text-sm [&_tbody_tr:hover]:bg-blue-50/30 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100/60 [&_tr]:transition-colors [&_td]:align-middle [&_tbody_tr:last-child]:border-0"
                  />
                ) : (
                  <div className="text-center py-10 px-6">
                    <Eye className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="font-medium text-muted-foreground">No Recent Submitted Visits</p>
                    <p className="text-sm text-muted-foreground/80 max-w-xs mx-auto mt-1.5">
                      No BHRs in the current scope have submitted any visits recently, or there are no visits matching filters.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-slate-100 bg-gradient-to-b from-slate-50/50 to-white p-4 sm:p-6">
                <div className="flex justify-end w-full">
                  <Button variant="ghost" size="sm" asChild className="text-[#004C8F] hover:text-[#004C8F]/90 hover:bg-[#004C8F]/10">
                    <Link href="/vhr/branch-visits" className="inline-flex items-center gap-1.5">
                      View All Submitted Visits
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardFooter>
            </div>
          </Card>
        </div>

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

    