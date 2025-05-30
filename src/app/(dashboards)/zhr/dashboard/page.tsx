
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Visit } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, Building, CalendarDays, Loader2 } from 'lucide-react';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { format, parseISO, isSameMonth, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ZHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalVisitsThisMonth, setTotalVisitsThisMonth] = useState(0);
  const [assignedBranchesCount, setAssignedBranchesCount] = useState(0);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  const recentVisitsColumns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id', // Will lookup bhr_name from users table if needed, or use BHR name if added to visits
      header: 'BHR Name',
      cell: (visit) => {
        // Assuming BHR name might not be directly on visit, you'd fetch/map users if needed
        // For now, if your visit object gets bhr_name populated, use that.
        // Otherwise, this would require another lookup or data join.
        // For this iteration, we'll assume visit might have bhr_name or we display ID.
        // If bhr_name was added to visits table as discussed for BHR pages:
        // return visit.bhr_name || visit.bhr_id; 
        // For now, let's fetch BHR users separately or just show ID.
        // Let's simplify and assume bhr_name is not on visit for now.
        // This column might be better if it was 'Branch Visited by BHR' and then BHR name elsewhere.
        // For simplicity, if we fetched BHRs and mapped, we could do it here.
        // We will rely on having bhr_name directly on visit if schema was updated.
        // If not, we need to fetch BHR users.
        // As we removed bhr_name from Visit type, we'd need a join or separate fetch.
        // Let's keep it simple and assume we fetch bhr_name from a users list if required,
        // or use a placeholder if not readily available for recentVisits.
        return visit.bhr_id; // Placeholder: Needs BHR user data for name.
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
      accessorKey: 'additional_remarks', // Assuming notes are in additional_remarks
      header: 'Summary',
      cell: (visit) => <p className="truncate max-w-xs">{visit.additional_remarks || 'N/A'}</p>
    },
  ], [allBranches]);


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

          const bhrIds = (bhrUsers || []).map(bhr => bhr.id);

          let currentMonthVisitsCount = 0;
          let recentVisitsData: Visit[] = [];
          let branchesForRecentVisits: Branch[] = [];

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

            currentMonthVisitsCount = (submittedVisits || []).filter(visit =>
              isSameMonth(parseISO(visit.visit_date), currentMonthStart)
            ).length;
            
            recentVisitsData = (submittedVisits || []).slice(0, 5);
            
            // Fetch all branches for name lookup for recent visits and other purposes
            const { data: branchesData, error: branchesErr } = await supabase
                .from('branches')
                .select('*');
            if (branchesErr) throw branchesErr;
            setAllBranches(branchesData || []); 
            branchesForRecentVisits = branchesData || [];


            // 3. Fetch assigned branches count for these BHRs
            const { data: assignments, error: assignmentsError } = await supabase
              .from('assignments')
              .select('branch_id', { count: 'exact' }) // Using count: 'exact' might not work for unique branch_id count
              .in('bhr_id', bhrIds);

            if (assignmentsError) throw assignmentsError;
            
            // To get unique branch count, we process assignments data
            const uniqueBranchIds = new Set((assignments || []).map(a => a.branch_id));
            setAssignedBranchesCount(uniqueBranchIds.size);
          } else {
            setAllBranches([]); // No BHRs, no branches to show via this path
            setAssignedBranchesCount(0);
          }
          
          setTotalVisitsThisMonth(currentMonthVisitsCount);
          setRecentVisits(recentVisitsData);

        } catch (error: any) {
          console.error("Error fetching ZHR dashboard data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setBhrCount(0);
          setTotalVisitsThisMonth(0);
          setAssignedBranchesCount(0);
          setRecentVisits([]);
          setAllBranches([]);
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
        <StatCard title="Branches in Zone" value={assignedBranchesCount} icon={Building} description="Unique branches managed by your BHRs." />
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
