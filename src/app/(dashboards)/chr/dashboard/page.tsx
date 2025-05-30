
'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Global data stores
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);

  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { data: usersData, error: usersError } = await supabase.from('users').select('*');
          if (usersError) throw usersError;
          setAllUsers(usersData || []);

          const { data: branchesData, error: branchesError } = await supabase.from('branches').select('*');
          if (branchesError) throw branchesError;
          setAllBranches(branchesData || []);

          const { data: visitsData, error: visitsError } = await supabase.from('visits').select('*').eq('status', 'submitted');
          if (visitsError) throw visitsError;
          setAllSubmittedVisits(visitsData || []);

        } catch (error: any) {
          console.error("CHR Dashboard: Error fetching global data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setAllUsers([]);
          setAllBranches([]);
          setAllSubmittedVisits([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  const {
    zhrCount,
    bhrCount,
    vhrCount, // Added VHR count
    totalSubmittedVisits,
    avgSubmittedVisitsPerBranch,
  } = useMemo(() => {
    const currentVhrCount = allUsers.filter(u => u.role === 'VHR').length;
    const currentZhrCount = allUsers.filter(u => u.role === 'ZHR').length;
    const currentBhrCount = allUsers.filter(u => u.role === 'BHR').length;
    const currentTotalSubmittedVisits = allSubmittedVisits.length;
    const currentAvgVisits = allBranches.length > 0 ? (currentTotalSubmittedVisits / allBranches.length).toFixed(1) : "0.0";

    return {
      vhrCount: currentVhrCount,
      zhrCount: currentZhrCount,
      bhrCount: currentBhrCount,
      totalSubmittedVisits: currentTotalSubmittedVisits,
      avgSubmittedVisitsPerBranch: currentAvgVisits,
    };
  }, [allUsers, allSubmittedVisits, allBranches]);

  const visitsByVHRData = useMemo(() => {
    if (!allUsers.length || !allSubmittedVisits.length) return [];

    const visitsPerVHR: Record<string, number> = {};
    const bhrToZhrMap = new Map(allUsers.filter(u => u.role === 'BHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const zhrToVhrMap = new Map(allUsers.filter(u => u.role === 'ZHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const vhrNameMap = new Map(allUsers.filter(u => u.role === 'VHR').map(u => [u.id, u.name]));

    allSubmittedVisits.forEach(visit => {
      const zhrId = bhrToZhrMap.get(visit.bhr_id);
      if (zhrId) {
        const vhrId = zhrToVhrMap.get(zhrId);
        if (vhrId) {
          const vhrName = vhrNameMap.get(vhrId) || 'Unknown VHR';
          visitsPerVHR[vhrName] = (visitsPerVHR[vhrName] || 0) + 1;
        }
      }
    });

    return Object.entries(visitsPerVHR).map(([name, value], index) => ({
      vhrName: name, // Ensure correct key for bar chart
      value,
      fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));
  }, [allUsers, allSubmittedVisits]);

  const visitsByBranchLocationData = useMemo(() => {
    if (!allBranches.length || !allSubmittedVisits.length) return [];

    const visitsPerLocation: Record<string, number> = {};
    const branchLocationMap = new Map(allBranches.map(b => [b.id, b.location]));

    allSubmittedVisits.forEach(visit => {
      const location = branchLocationMap.get(visit.branch_id);
      if (location) {
        visitsPerLocation[location] = (visitsPerLocation[location] || 0) + 1;
      }
    });

    return Object.entries(visitsPerLocation)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Top 5
      .map(([name, value], index) => ({
        name,
        value,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`,
      }));
  }, [allBranches, allSubmittedVisits]);


  if (isLoading && user?.role === 'CHR') {
    return (
      <div className="space-y-8">
        <PageTitle title="CHR Dashboard" description="Loading Global Overview..." />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'CHR') return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;

  return (
    <div className="space-y-8">
      <PageTitle title="CHR Global Dashboard" description="Global Human Resources Overview." />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5"> {/* Adjusted to 5 cols */}
        <StatCard title="Total VHRs" value={vhrCount} icon={Users} description="Across all verticals"/>
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} description="Across all verticals"/>
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} description="Across all verticals"/>
        <StatCard title="Total Branches" value={allBranches.length} icon={Building} description="Nationwide"/>
        <StatCard title="Total Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} description="Across all branches"/>
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
        <StatCard title="Avg Submitted Visits/Branch" value={avgSubmittedVisitsPerBranch} icon={TrendingUp} description="Nationwide average"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visitsByVHRData.length > 0 ? (
            <PlaceholderBarChart
            data={visitsByVHRData}
            title="Submitted Visits per VHR Vertical"
            description="Total submitted visits across different VHR-led verticals."
            xAxisKey="vhrName"
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
            description="Top 5 branch locations by number of submitted visits."
            dataKey="value"
            nameKey="name"
            />
        ) : (
             <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-2" />
                    <p>No branch location visit data to display.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
