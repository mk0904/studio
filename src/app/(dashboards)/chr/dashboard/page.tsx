
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, Building, CalendarDays, Globe2, BarChartBig, TrendingUp, Loader2 } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [vhrCount, setVhrCount] = useState(0);
  const [zhrCount, setZhrCount] = useState(0);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalBranches, setTotalBranches] = useState(0);
  const [totalSubmittedVisits, setTotalSubmittedVisits] = useState(0);
  
  const [visitsByVHRData, setVisitsByVHRData] = useState<{ name: string; value: number; fill: string; }[]>([]);
  const [visitsByBranchLocationData, setVisitsByBranchLocationData] = useState<{ name: string; value: number; fill: string; }[]>([]);

  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // Fetch all users
          const { data: allUsersData, error: usersError } = await supabase
            .from('users')
            .select('id, name, role, reports_to');
          if (usersError) throw usersError;
          const allUsers = allUsersData as User[] || [];

          setVhrCount(allUsers.filter(u => u.role === 'VHR').length);
          setZhrCount(allUsers.filter(u => u.role === 'ZHR').length);
          setBhrCount(allUsers.filter(u => u.role === 'BHR').length);

          // Fetch all branches
          const { data: branchesData, error: branchesError } = await supabase
            .from('branches')
            .select('id, name, location');
          if (branchesError) throw branchesError;
          const allBranches = branchesData as Branch[] || [];
          setTotalBranches(allBranches.length);

          // Fetch all submitted visits
          const { data: submittedVisitsData, error: visitsError } = await supabase
            .from('visits')
            .select('id, bhr_id, branch_id')
            .eq('status', 'submitted');
          if (visitsError) throw visitsError;
          const submittedVisits = submittedVisitsData as Pick<Visit, 'id' | 'bhr_id' | 'branch_id'>[] || [];
          setTotalSubmittedVisits(submittedVisits.length);

          // Process data for Visits per VHR Vertical chart
          const vhrMap = new Map<string, string>(); // vhrId -> vhrName
          const zhrToVhrMap = new Map<string, string>(); // zhrId -> vhrId
          const bhrToZhrMap = new Map<string, string>(); // bhrId -> zhrId

          allUsers.forEach(u => {
            if (u.role === 'VHR') vhrMap.set(u.id, u.name);
            if (u.role === 'ZHR' && u.reports_to) zhrToVhrMap.set(u.id, u.reports_to);
            if (u.role === 'BHR' && u.reports_to) bhrToZhrMap.set(u.id, u.reports_to);
          });

          const visitsPerVhrAgg: Record<string, number> = {};
          submittedVisits.forEach(visit => {
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId) {
              const vhrId = zhrToVhrMap.get(zhrId);
              if (vhrId) {
                const vhrName = vhrMap.get(vhrId) || 'Unknown VHR';
                visitsPerVhrAgg[vhrName] = (visitsPerVhrAgg[vhrName] || 0) + 1;
              }
            }
          });
          setVisitsByVHRData(
            Object.entries(visitsPerVhrAgg).map(([name, value], index) => ({
              name,
              value,
              fill: `hsl(var(--chart-${(index % 5) + 1}))`,
            }))
          );

          // Process data for Visits by Branch Location chart
          const branchLocationMap = new Map<string, string>(); // branchId -> location
          allBranches.forEach(b => branchLocationMap.set(b.id, b.location));

          const visitsPerLocationAgg: Record<string, number> = {};
          submittedVisits.forEach(visit => {
            const location = branchLocationMap.get(visit.branch_id);
            if (location) {
              visitsPerLocationAgg[location] = (visitsPerLocationAgg[location] || 0) + 1;
            }
          });
          
          setVisitsByBranchLocationData(
            Object.entries(visitsPerLocationAgg)
              .sort(([, a], [, b]) => b - a) // Sort by value descending
              .slice(0, 5) // Take top 5
              .map(([name, value], index) => ({
                name,
                value,
                fill: `hsl(var(--chart-${(index % 5) + 1}))`,
              }))
          );

        } catch (error: any) {
          console.error("CHR Dashboard: Error fetching data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setVhrCount(0);
          setZhrCount(0);
          setBhrCount(0);
          setTotalBranches(0);
          setTotalSubmittedVisits(0);
          setVisitsByVHRData([]);
          setVisitsByBranchLocationData([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  if (isLoading && user?.role === 'CHR') {
    return (
      <div className="space-y-8">
        <PageTitle title="CHR Dashboard" description="Loading Global Human Resources Overview..." />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) return null;
  
  const avgSubmittedVisitsPerBranch = totalBranches > 0 ? (totalSubmittedVisits / totalBranches).toFixed(1) : "0.0";


  return (
    <div className="space-y-8">
      <PageTitle title="CHR Dashboard" description="Global Human Resources Overview (Submitted Data)." />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total VHRs" value={vhrCount} icon={Users} />
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} />
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} />
        <StatCard title="Total Branches" value={totalBranches} icon={Building} />
        <StatCard title="Total Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/chr/analytics" className="md:col-span-1">
          <Button className="w-full h-full text-lg py-8" variant="outline">
            <BarChartBig className="mr-2 h-8 w-8" /> View Deep Analytics
          </Button>
        </Link>
        <Link href="/chr/global-overview" className="md:col-span-1">
          <Button className="w-full h-full text-lg py-8" variant="outline">
            <Globe2 className="mr-2 h-8 w-8" /> AI Summary & Overview
          </Button>
        </Link>
        <StatCard title="Avg Submitted Visits/Branch" value={avgSubmittedVisitsPerBranch} icon={TrendingUp} description="Average submitted visits per branch"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visitsByVHRData.length > 0 ? (
            <PlaceholderBarChart
            data={visitsByVHRData}
            title="Submitted Visits per VHR Vertical"
            description="Total submitted visits across different VHR-led verticals."
            xAxisKey="name"
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                    <p>No VHR visit data to display.</p>
                </div>
            </Card>
        )}
        {visitsByBranchLocationData.length > 0 ? (
            <PlaceholderPieChart
            data={visitsByBranchLocationData}
            title="Submitted Visits by Branch Location (Top 5)"
            description="Distribution of submitted visits across main branch locations."
            dataKey="value"
            nameKey="name"
            />
        ) : (
             <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-2" /> {/* Changed icon for variety */}
                    <p>No branch location visit data to display.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
