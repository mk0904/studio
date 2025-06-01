
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Visit } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarDays, Loader2, UserCheck, Eye, Calendar, ArrowUpRight } from 'lucide-react';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { format, parseISO, isSameMonth, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ZHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalVisitsThisMonth, setTotalVisitsThisMonth] = useState(0);
  const [activeBHRsCount, setActiveBHRsCount] = useState(0);
  const [recentVisits, setRecentVisits] = useState<EnrichedVisitForModal[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [bhrUsersInZone, setBhrUsersInZone] = useState<User[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);


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


  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { data: bhrUsersData, error: bhrError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'BHR')
            .eq('reports_to', user.id);

          if (bhrError) throw bhrError;
          setBhrCount(bhrUsersData?.length || 0);
          setBhrUsersInZone(bhrUsersData || []);

          let currentMonthVisitsCount = 0;
          let activeBHRsThisMonth = 0;
          let latestSubmittedVisits: Visit[] = [];

          const bhrIds = (bhrUsersData || []).map(bhr => bhr.id);

          if (bhrIds.length > 0) {
            const { data: submittedVisitsData, error: visitsError } = await supabase
              .from('visits')
              .select('*')
              .in('bhr_id', bhrIds)
              .eq('status', 'submitted')
              .order('visit_date', { ascending: false });

            if (visitsError) throw visitsError;

            const today = new Date();
            const currentMonthStart = startOfMonth(today);

            const visitsThisMonth = (submittedVisitsData || []).filter(visit =>
              isSameMonth(parseISO(visit.visit_date), currentMonthStart)
            );
            currentMonthVisitsCount = visitsThisMonth.length;

            const uniqueBHRsThisMonth = new Set(visitsThisMonth.map(visit => visit.bhr_id));
            activeBHRsThisMonth = uniqueBHRsThisMonth.size;

            latestSubmittedVisits = (submittedVisitsData || []).slice(0, 5) as Visit[];

            const { data: branchesData, error: branchesErr } = await supabase
                .from('branches')
                .select('*');
            if (branchesErr) throw branchesErr;
            setAllBranches(branchesData as Branch[] || []);

            const enrichedRecentVisits = latestSubmittedVisits.map(v => {
                const branch = (branchesData || []).find(b => b.id === v.branch_id);
                const bhr = (bhrUsersData || []).find(u => u.id === v.bhr_id);
                return {
                    ...v,
                    branch_name_display: branch?.name || v.branch_id,
                    branch_category_display: branch?.category,
                    branch_code_display: branch?.code,
                    bhr_name_display: bhr?.name || v.bhr_id,
                };
            });
            setRecentVisits(enrichedRecentVisits);

          } else {
            setAllBranches([]);
            setRecentVisits([]);
          }

          setTotalVisitsThisMonth(currentMonthVisitsCount);
          setActiveBHRsCount(activeBHRsThisMonth);

        } catch (error: any) {
          console.error("Error fetching ZHR dashboard data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setBhrCount(0);
          setTotalVisitsThisMonth(0);
          setActiveBHRsCount(0);
          setRecentVisits([]);
          setAllBranches([]);
          setBhrUsersInZone([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
        setIsLoading(false);
    }
  }, [user, toast]);

  if (!user) return null;

  if (isLoading && user.role === 'ZHR') {
    return (
      <div className="flex min-h-full w-full flex-col items-center bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
          <div className="flex flex-col space-y-4 sm:space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#004C8F] to-[#0070CC]">
                Welcome back, {user.name ? user.name.split(' ')[0] : 'ZHR'}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground/90 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#004C8F]/70" />
                Loading your Zonal overview for {format(new Date(), 'MMMM yyyy')}...
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#004C8F] to-[#0070CC]">
                 Welcome back, {user.name ? user.name.split(' ')[0] : 'ZHR'}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground/90 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#004C8F]/70" />
                Zone overview for {format(new Date(), 'MMMM yyyy')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 w-full">
          <Card className="relative overflow-hidden border border-indigo-500/10 bg-gradient-to-br from-white to-indigo-500/5 transition-all duration-200 hover:border-indigo-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="p-3 sm:p-4 pb-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-indigo-600">BHRs in Zone</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/70">Total BHRs reporting to you</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-2 flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-start flex-1">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{bhrCount}</div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-xs text-muted-foreground/70">team members</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-[#004C8F]/10 bg-gradient-to-br from-white to-[#004C8F]/5 transition-all duration-200 hover:border-[#004C8F]/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="p-3 sm:p-4 pb-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-[#004C8F]">Total Visits This Month</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/70">Submitted visits in current month</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-2 flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-start flex-1">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{totalVisitsThisMonth}</div>
               <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#004C8F]" />
                <span className="text-xs sm:text-sm text-muted-foreground/70">visits</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-emerald-500/10 bg-gradient-to-br from-white to-emerald-500/5 transition-all duration-200 hover:border-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-2 sm:col-span-1 group">
            <CardHeader className="p-3 sm:p-4 pb-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-emerald-600">Active BHRs</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/70">BHRs with visits this month</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-2 flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-start flex-1">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{activeBHRsCount}</div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs text-muted-foreground/70">active BHRs</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full">
          <Card className="border border-slate-200/50 bg-white/95 backdrop-blur-sm transition-all duration-200 hover:border-slate-300/50 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
            <div className="flex flex-col min-h-[300px]">
              <CardHeader className="items-start p-6 sm:p-8 pb-4">
                <CardTitle className="text-base font-semibold text-slate-800">Recent Submitted Visits in Your Zone (Top 5)</CardTitle>
                <CardDescription className="text-xs text-slate-600">Quick overview of the latest visit reports from your BHRs.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow p-0 sm:p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-[#004C8F]" />
                  </div>
                ) : recentVisits.length > 0 ? (
                  <DataTable
                    columns={recentVisitsColumns}
                    data={recentVisits}
                    tableClassName="[&_thead_th]:bg-slate-50/80 [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:text-slate-600 [&_thead_th]:h-14 [&_thead_th]:px-6 [&_thead]:border-b [&_thead]:border-slate-200/60 [&_tbody_td]:px-6 [&_tbody_td]:py-4 [&_tbody_td]:text-sm [&_tbody_tr:hover]:bg-blue-50/30 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100/60 [&_tr]:transition-colors [&_td]:align-middle [&_tbody_tr:last-child]:border-0"
                  />
                ) : (
                  <div className="text-center py-10 px-6">
                    <Eye className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="font-medium text-muted-foreground">No Recent Submitted Visits</p>
                    <p className="text-sm text-muted-foreground/80 max-w-xs mx-auto mt-1.5">
                      No BHRs in your zone have submitted any visits yet, or there are no visits matching current filters.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t border-slate-100 bg-gradient-to-b from-slate-50/50 to-white p-4 sm:p-6">
                <div className="flex justify-end w-full">
                  <Button variant="ghost" size="sm" asChild className="text-[#004C8F] hover:text-[#004C8F]/90 hover:bg-[#004C8F]/10">
                    <Link href="/zhr/visits-made" className="inline-flex items-center gap-1.5">
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

