
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Visit } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarDays, Loader2, UserCheck, Eye } from 'lucide-react';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { format, parseISO, isSameMonth, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';


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


  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // 1. Fetch BHRs reporting to this ZHR
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
          let recentVisitsData: Visit[] = [];
          
          const bhrIds = (bhrUsersData || []).map(bhr => bhr.id);

          if (bhrIds.length > 0) {
            // 2. Fetch submitted visits for these BHRs
            const { data: submittedVisits, error: visitsError } = await supabase
              .from('visits')
              .select('*') 
              .in('bhr_id', bhrIds)
              .eq('status', 'submitted')
              .order('visit_date', { ascending: false });

            if (visitsError) throw visitsError;

            const today = new Date();
            const currentMonthStart = startOfMonth(today);

            const visitsThisMonth = (submittedVisits || []).filter(visit =>
              isSameMonth(parseISO(visit.visit_date), currentMonthStart)
            );
            currentMonthVisitsCount = visitsThisMonth.length;
            
            const uniqueBHRsThisMonth = new Set(visitsThisMonth.map(visit => visit.bhr_id));
            activeBHRsThisMonth = uniqueBHRsThisMonth.size;
            
            recentVisitsData = (submittedVisits || []).slice(0, 5) as Visit[];
            
            // Fetch all branches for name lookup for recent visits
            const { data: branchesData, error: branchesErr } = await supabase
                .from('branches')
                .select('*'); 
            if (branchesErr) throw branchesErr;
            setAllBranches(branchesData as Branch[] || []);

            // Enrich recent visits with branch and BHR names
            const enrichedRecentVisits = recentVisitsData.map(v => {
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
      <div className="space-y-8">
        <PageTitle title={`Welcome, ${user.name}!`} description="Loading your Zonal overview..." />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title={`ZHR Dashboard`} description={`Zone overview for ${user.name}.`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="BHRs in Zone" value={bhrCount} icon={Users} description="Total BHRs reporting to you." />
        <StatCard title="Total Visits This Month" value={totalVisitsThisMonth} icon={CalendarDays} description="Submitted visits in current month." />
        <StatCard title="Active BHRs" value={activeBHRsCount} icon={UserCheck} description="BHRs with submitted visits this month." />
      </div>

      <div className="grid grid-cols-1 gap-6">
         <DataTable
          columns={recentVisitsColumns}
          data={recentVisits}
          title="Recent Submitted Visits in Your Zone"
          emptyStateMessage={isLoading ? "Loading..." : "No recent submitted visits in your zone."}
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
