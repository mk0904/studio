
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Visit } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarDays, Loader2, UserCheck } from 'lucide-react'; // Added UserCheck
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { format, parseISO, isSameMonth, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ZHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalVisitsThisMonth, setTotalVisitsThisMonth] = useState(0);
  const [activeBHRsCount, setActiveBHRsCount] = useState(0); // Changed from assignedBranchesCount
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [bhrUsersInZone, setBhrUsersInZone] = useState<User[]>([]);


  const recentVisitsColumns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id',
      header: 'BHR Name',
      cell: (visit) => {
        const bhr = bhrUsersInZone.find(b => b.id === visit.bhr_id);
        return bhr ? bhr.name : visit.bhr_id;
      }
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch',
      cell: (visit) => {
        const branch = allBranches.find(b => b.id === visit.branch_id);
        return branch ? branch.name : 'Unknown Branch';
      }
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP')
    },
    {
      accessorKey: 'additional_remarks', 
      header: 'Summary',
      cell: (visit) => <p className="truncate max-w-xs">{visit.additional_remarks || 'N/A'}</p>
    },
  ], [allBranches, bhrUsersInZone]);


  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // 1. Fetch BHRs reporting to this ZHR
          const { data: bhrUsers, error: bhrError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'BHR')
            .eq('reports_to', user.id);

          if (bhrError) throw bhrError;
          setBhrCount(bhrUsers?.length || 0);
          setBhrUsersInZone(bhrUsers || []);


          let currentMonthVisitsCount = 0;
          let activeBHRsThisMonth = 0;
          let recentVisitsData: Visit[] = [];
          
          const bhrIds = (bhrUsers || []).map(bhr => bhr.id);

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
            
            recentVisitsData = (submittedVisits || []).slice(0, 5);
            
            // Fetch all branches for name lookup for recent visits
            // This could be optimized to only fetch branches relevant to recentVisitsData if needed
            const { data: branchesData, error: branchesErr } = await supabase
                .from('branches')
                .select('*');
            if (branchesErr) throw branchesErr;
            setAllBranches(branchesData || []); 
          } else {
            setAllBranches([]); 
          }
          
          setTotalVisitsThisMonth(currentMonthVisitsCount);
          setActiveBHRsCount(activeBHRsThisMonth); // Set active BHRs count
          setRecentVisits(recentVisitsData);

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
    </div>
  );
}
