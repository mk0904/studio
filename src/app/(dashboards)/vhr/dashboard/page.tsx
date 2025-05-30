
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarCheck, BarChart3, Loader2 } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function VHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [zhrCount, setZhrCount] = useState(0);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalSubmittedVisitsInVertical, setTotalSubmittedVisitsInVertical] = useState(0);
  const [topPerformingBranches, setTopPerformingBranches] = useState<{ name: string; value: number; fill: string; }[]>([]);
  const [visitsByZHRData, setVisitsByZHRData] = useState<{name: string; value: number; fill: string;}[]>([]);


  useEffect(() => {
    if (user && user.role === 'VHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // 1. Fetch ZHRs reporting to this VHR
          const { data: zhrUsersData, error: zhrError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'ZHR')
            .eq('reports_to', user.id);

          if (zhrError) throw zhrError;
          setZhrCount(zhrUsersData?.length || 0);
          const zhrIds = (zhrUsersData || []).map(z => z.id);
          const zhrNameMap = new Map((zhrUsersData || []).map(z => [z.id, z.name]));

          let bhrUsersInVerticalCount = 0;
          let submittedVisitsData: Visit[] = [];

          if (zhrIds.length > 0) {
            // 2. Fetch BHRs reporting to these ZHRs
            const { data: bhrUsersData, error: bhrError } = await supabase
              .from('users')
              .select('id, reports_to') // reports_to is zhr_id here
              .eq('role', 'BHR')
              .in('reports_to', zhrIds);

            if (bhrError) throw bhrError;
            bhrUsersInVerticalCount = bhrUsersData?.length || 0;
            const bhrIds = (bhrUsersData || []).map(b => b.id);
            const bhrToZhrMap = new Map((bhrUsersData || []).map(b => [b.id, b.reports_to]));


            if (bhrIds.length > 0) {
              // 3. Fetch submitted visits by these BHRs
              const { data: visitsData, error: visitsError } = await supabase
                .from('visits')
                .select('*')
                .in('bhr_id', bhrIds)
                .eq('status', 'submitted');
              
              if (visitsError) throw visitsError;
              submittedVisitsData = (visitsData as Visit[]) || [];
              setTotalSubmittedVisitsInVertical(submittedVisitsData.length);

              // 4. Fetch all branches for name lookup
              const { data: allBranchesData, error: branchesError } = await supabase
                .from('branches')
                .select('id, name');
              if (branchesError) throw branchesError;
              const branchNameMap = new Map((allBranchesData || []).map(b => [b.id, b.name]));

              // Process for Top Performing Branches (Bar Chart)
              const visitsPerBranch: Record<string, number> = {};
              submittedVisitsData.forEach(visit => {
                const branchName = branchNameMap.get(visit.branch_id) || 'Unknown Branch';
                visitsPerBranch[branchName] = (visitsPerBranch[branchName] || 0) + 1;
              });
              const sortedBranches = Object.entries(visitsPerBranch)
                .map(([name, value], index) => ({ name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))` }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
              setTopPerformingBranches(sortedBranches);

              // Process for Visits by ZHR (Pie Chart)
              const visitsPerZHR: Record<string, number> = {};
              submittedVisitsData.forEach(visit => {
                const zhrId = bhrToZhrMap.get(visit.bhr_id);
                if (zhrId) {
                  const zhrName = zhrNameMap.get(zhrId) || 'Unknown ZHR';
                  visitsPerZHR[zhrName] = (visitsPerZHR[zhrName] || 0) + 1;
                }
              });
              setVisitsByZHRData(
                Object.entries(visitsPerZHR).map(([name, value], index) => ({ name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))` }))
              );
            } else {
                setTopPerformingBranches([]);
                setVisitsByZHRData([]);
            }
          } else {
            setTotalSubmittedVisitsInVertical(0);
            setTopPerformingBranches([]);
            setVisitsByZHRData([]);
          }
          setBhrCount(bhrUsersInVerticalCount);

        } catch (error: any) {
          console.error("Error fetching VHR dashboard data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setZhrCount(0);
          setBhrCount(0);
          setTotalSubmittedVisitsInVertical(0);
          setTopPerformingBranches([]);
          setVisitsByZHRData([]);
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

  if (isLoading && user.role === 'VHR') {
    return (
      <div className="space-y-8">
        <PageTitle title={`VHR Dashboard`} description={`Loading vertical overview for ${user.name}...`} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="VHR Dashboard" description={`Vertical overview for ${user.name} (Submitted Data).`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="ZHRs in Vertical" value={zhrCount} icon={Users} description="Total ZHRs reporting to you." />
        <StatCard title="BHRs in Vertical" value={bhrCount} icon={Users} description="Total BHRs under your ZHRs." />
        <StatCard title="Total Submitted Visits in Vertical" value={totalSubmittedVisitsInVertical} icon={CalendarCheck} description="All submitted visits across your vertical." />
        <Link href="/vhr/analytics">
          <Button className="w-full h-full text-lg" variant="outline">
            <BarChart3 className="mr-2 h-6 w-6" /> View Detailed Analytics
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {topPerformingBranches.length > 0 ? (
            <PlaceholderBarChart
            data={topPerformingBranches}
            title="Top Branches by Submitted Visit Count"
            description="Branches with the most HR submitted visits in your vertical."
            xAxisKey="name"
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <p className="text-muted-foreground">No branch visit data to display.</p>
            </Card>
        )}
        {visitsByZHRData.length > 0 ? (
            <PlaceholderPieChart
            data={visitsByZHRData}
            title="Submitted Visits Distribution by ZHR"
            description="Breakdown of submitted visits by ZHRs in your vertical."
            dataKey="value"
            nameKey="name"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                 <p className="text-muted-foreground">No ZHR visit data to display.</p>
            </Card>
        )}
      </div>
    </div>
  );
}
