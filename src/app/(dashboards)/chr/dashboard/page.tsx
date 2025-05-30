
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, Building, CalendarDays, Globe2, BarChartBig, TrendingUp, Loader2, Filter } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useChrFilter } from '@/contexts/chr-filter-context'; // Import the context hook

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Global data stores
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);

  // Consume the global filter from context
  const { selectedVhrId } = useChrFilter();
  console.log('CHR Dashboard - Selected VHR ID from context:', selectedVhrId);


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

  const selectedVhrName = useMemo(() => {
    if (selectedVhrId === 'all' || !allUsers.length) return "Global View";
    const vhr = allUsers.find(u => u.id === selectedVhrId && u.role === 'VHR');
    return vhr ? `${vhr.name}'s Vertical` : "Selected Vertical";
  }, [selectedVhrId, allUsers]);


  const filteredUsers = useMemo(() => {
    if (selectedVhrId === 'all') return allUsers;
    if (!allUsers.length) return [];

    const vhrZhrs = allUsers.filter(u => u.role === 'ZHR' && u.reports_to === selectedVhrId);
    const vhrZhrIds = vhrZhrs.map(z => z.id);
    const vhrBhrs = allUsers.filter(u => u.role === 'BHR' && u.reports_to && vhrZhrIds.includes(u.reports_to));
    
    return [
      ...allUsers.filter(u => u.id === selectedVhrId), // The VHR themselves
      ...vhrZhrs,
      ...vhrBhrs
    ];
  }, [allUsers, selectedVhrId]);

  const filteredSubmittedVisits = useMemo(() => {
    if (selectedVhrId === 'all') return allSubmittedVisits;
    if (!filteredUsers.length || !allSubmittedVisits.length) return [];

    const bhrIdsInFilteredVertical = filteredUsers.filter(u => u.role === 'BHR').map(b => b.id);
    return allSubmittedVisits.filter(v => bhrIdsInFilteredVertical.includes(v.bhr_id));
  }, [allSubmittedVisits, filteredUsers, selectedVhrId]);


  const {
    zhrCount,
    bhrCount,
    totalSubmittedVisits,
    avgSubmittedVisitsPerBranch,
  } = useMemo(() => {
    const currentZhrCount = filteredUsers.filter(u => u.role === 'ZHR').length;
    const currentBhrCount = filteredUsers.filter(u => u.role === 'BHR').length;
    const currentTotalSubmittedVisits = filteredSubmittedVisits.length;
    // Avg visits per branch should consider *all* branches if global, or branches assignable to the vertical
    // For simplicity, using allBranches.length for now. Could be refined if needed.
    const currentAvgVisits = allBranches.length > 0 ? (currentTotalSubmittedVisits / allBranches.length).toFixed(1) : "0.0";

    return {
      zhrCount: currentZhrCount,
      bhrCount: currentBhrCount,
      totalSubmittedVisits: currentTotalSubmittedVisits,
      avgSubmittedVisitsPerBranch: currentAvgVisits,
    };
  }, [filteredUsers, filteredSubmittedVisits, allBranches, selectedVhrId]);

  const {
    visitsByVerticalChartData,
    verticalChartTitle,
    verticalChartXAxisKey
  } = useMemo(() => {
    let vhrChartTitle = "Submitted Visits per VHR Vertical";
    let vhrChartXAxisKey = "vhrName"; // VHR Name

    const visitsPerVerticalAgg: Record<string, number> = {};

    if (selectedVhrId === 'all') { // Aggregate by VHR
      const vhrMap = new Map<string, string>();
      const zhrToVhrMap = new Map<string, string>();
      const bhrToZhrMap = new Map<string, string>();
      allUsers.forEach(u => {
          if (u.role === 'VHR') vhrMap.set(u.id, u.name);
          if (u.role === 'ZHR' && u.reports_to) zhrToVhrMap.set(u.id, u.reports_to);
          if (u.role === 'BHR' && u.reports_to) bhrToZhrMap.set(u.id, u.reports_to);
      });
      filteredSubmittedVisits.forEach(visit => { // Use filteredSubmittedVisits
          const zhrId = bhrToZhrMap.get(visit.bhr_id);
          if (zhrId) {
              const vhrId = zhrToVhrMap.get(zhrId);
              if (vhrId) {
                  const vhrName = vhrMap.get(vhrId) || 'Unknown VHR';
                  visitsPerVerticalAgg[vhrName] = (visitsPerVerticalAgg[vhrName] || 0) + 1;
              }
          }
      });
    } else { // Aggregate by ZHR under the selected VHR
      const selectedVhr = allUsers.find(u => u.id === selectedVhrId);
      vhrChartTitle = `Visits by ZHR in ${selectedVhr?.name || 'Selected'}'s Vertical`;
      vhrChartXAxisKey = "zhrName";

      const zhrNameMap = new Map<string, string>();
      const bhrToZhrMap = new Map<string, string>();
      // ZHRs reporting to the selected VHR
      filteredUsers.filter(u => u.role === 'ZHR' && u.reports_to === selectedVhrId).forEach(z => zhrNameMap.set(z.id, z.name));
      // BHRs reporting to those ZHRs
      const zhrIdsInSelectedVertical = Array.from(zhrNameMap.keys());
      filteredUsers.filter(u => u.role === 'BHR' && u.reports_to && zhrIdsInSelectedVertical.includes(u.reports_to)).forEach(b => bhrToZhrMap.set(b.id, b.reports_to || ''));

      filteredSubmittedVisits.forEach(visit => {
          const zhrId = bhrToZhrMap.get(visit.bhr_id);
          if (zhrId) {
              const zhrName = zhrNameMap.get(zhrId) || 'Unknown ZHR';
              visitsPerVerticalAgg[zhrName] = (visitsPerVerticalAgg[zhrName] || 0) + 1;
          }
      });
    }
    const verticalData = Object.entries(visitsPerVerticalAgg).map(([name, value], index) => ({
        [vhrChartXAxisKey]: name,
        value,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));
    return { visitsByVerticalChartData: verticalData, verticalChartTitle: vhrChartTitle, verticalChartXAxisKey: vhrChartXAxisKey };
  }, [allUsers, filteredSubmittedVisits, selectedVhrId]);


  const visitsByBranchLocationData = useMemo(() => {
    const branchLocationMap = new Map<string, string>();
    allBranches.forEach(b => branchLocationMap.set(b.id, b.location));
    const visitsPerLocationAgg: Record<string, number> = {};
    filteredSubmittedVisits.forEach(visit => {
        const location = branchLocationMap.get(visit.branch_id);
        if (location) {
            visitsPerLocationAgg[location] = (visitsPerLocationAgg[location] || 0) + 1;
        }
    });
    return Object.entries(visitsPerLocationAgg)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value], index) => ({
            name,
            value,
            fill: `hsl(var(--chart-${(index % 5) + 1}))`,
        }));
  }, [allBranches, filteredSubmittedVisits, selectedVhrId]);


  if (isLoading && user?.role === 'CHR') {
    return (
      <div className="space-y-8">
        <PageTitle title="CHR Dashboard" description={`Loading ${selectedVhrName} Overview...`} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'CHR') return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;


  const statCardDescription = selectedVhrId !== 'all' ? `In ${selectedVhrName}` : "Across all verticals";

  return (
    <div className="space-y-8">
      <PageTitle title={`CHR Dashboard (${selectedVhrName})`} description="Global Human Resources Overview (Filtered by selection in header)." />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} description={statCardDescription}/>
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} description={statCardDescription}/>
        <StatCard title="Total Branches" value={allBranches.length} icon={Building} description="Nationwide (unfiltered by VHR)"/>
        <StatCard title="Total Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} description={statCardDescription}/>
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
        <StatCard title="Avg Submitted Visits/Branch" value={avgSubmittedVisitsPerBranch} icon={TrendingUp} description={`Based on ${statCardDescription.toLowerCase()} visits / total branches`}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visitsByVerticalChartData.length > 0 ? (
            <PlaceholderBarChart
            data={visitsByVerticalChartData}
            title={verticalChartTitle}
            description={selectedVhrId === 'all' ? "Total submitted visits across different VHR-led verticals." : `Total submitted visits across ZHRs in ${selectedVhrName}.`}
            xAxisKey={verticalChartXAxisKey}
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                    <p>No vertical visit data to display for {selectedVhrName}.</p>
                </div>
            </Card>
        )}
        {visitsByBranchLocationData.length > 0 ? (
            <PlaceholderPieChart
            data={visitsByBranchLocationData}
            title={`Submitted Visits by Branch Location (Top 5 for ${selectedVhrName})`}
            description={selectedVhrId !== 'all' ? `For ${selectedVhrName}.` : "Across all verticals."}
            dataKey="value"
            nameKey="name"
            />
        ) : (
             <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-2" />
                    <p>No branch location visit data to display for {selectedVhrName}.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
