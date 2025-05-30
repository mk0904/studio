
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Store all global data
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);

  // Filter state
  const [selectedVhrId, setSelectedVhrId] = useState<string>('all');
  const [vhrFilterOptions, setVhrFilterOptions] = useState<{ value: string; label: string }[]>([]);


  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { data: usersData, error: usersError } = await supabase.from('users').select('*');
          if (usersError) throw usersError;
          setAllUsers(usersData || []);
          const vhrs = (usersData || []).filter(u => u.role === 'VHR').map(vhr => ({ value: vhr.id, label: vhr.name }));
          setVhrFilterOptions([{ value: 'all', label: 'All VHR Verticals' }, ...vhrs]);

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
    totalSubmittedVisits,
    avgSubmittedVisitsPerBranch,
    visitsByVerticalChartData,
    visitsByBranchLocationData,
    verticalChartTitle,
    verticalChartXAxisKey
  } = useMemo(() => {
    if (!allUsers.length || !allBranches.length) {
      return {
        zhrCount: 0, bhrCount: 0, totalSubmittedVisits: 0, avgSubmittedVisitsPerBranch: "0.0",
        visitsByVerticalChartData: [], visitsByBranchLocationData: [],
        verticalChartTitle: "Submitted Visits per VHR Vertical", verticalChartXAxisKey: "name"
      };
    }

    let relevantBhrIds: string[] = [];
    let relevantZhrIds: string[] = [];
    let relevantUsers = allUsers;
    let relevantVisits = allSubmittedVisits;
    let vhrChartTitle = "Submitted Visits per VHR Vertical";
    let vhrChartXAxisKey = "name"; // Corresponds to VHR Name

    if (selectedVhrId !== 'all') {
      const zhrsInSelectedVertical = allUsers.filter(u => u.role === 'ZHR' && u.reports_to === selectedVhrId);
      relevantZhrIds = zhrsInSelectedVertical.map(z => z.id);
      const bhrsInSelectedZhrs = allUsers.filter(u => u.role === 'BHR' && u.reports_to && relevantZhrIds.includes(u.reports_to));
      relevantBhrIds = bhrsInSelectedZhrs.map(b => b.id);
      
      relevantUsers = [
        ...allUsers.filter(u => u.id === selectedVhrId),
        ...zhrsInSelectedVertical,
        ...bhrsInSelectedZhrs
      ];
      relevantVisits = allSubmittedVisits.filter(v => relevantBhrIds.includes(v.bhr_id));
      
      const selectedVhrName = allUsers.find(u => u.id === selectedVhrId)?.name || "Selected VHR";
      vhrChartTitle = `Visits by ZHR in ${selectedVhrName}'s Vertical`;
      vhrChartXAxisKey = "zhrName"; // Will map to ZHR Name
    } else {
      // For "All VHRs", get all BHR IDs
      relevantBhrIds = allUsers.filter(u => u.role === 'BHR').map(b => b.id);
    }

    const currentZhrCount = relevantUsers.filter(u => u.role === 'ZHR').length;
    const currentBhrCount = relevantUsers.filter(u => u.role === 'BHR').length;
    const currentTotalSubmittedVisits = relevantVisits.length;
    const currentAvgVisits = allBranches.length > 0 ? (currentTotalSubmittedVisits / allBranches.length).toFixed(1) : "0.0";

    // Process data for Visits per Vertical chart (VHR or ZHR)
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
        relevantVisits.forEach(visit => {
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
        const zhrNameMap = new Map<string, string>();
        const bhrToZhrMap = new Map<string, string>();
        allUsers.filter(u => u.role === 'ZHR' && u.reports_to === selectedVhrId).forEach(z => zhrNameMap.set(z.id, z.name));
        allUsers.filter(u => u.role === 'BHR' && relevantZhrIds.includes(u.reports_to || '')).forEach(b => bhrToZhrMap.set(b.id, b.reports_to || ''));

        relevantVisits.forEach(visit => {
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId) {
                const zhrName = zhrNameMap.get(zhrId) || 'Unknown ZHR';
                visitsPerVerticalAgg[zhrName] = (visitsPerVerticalAgg[zhrName] || 0) + 1;
            }
        });
    }
    const verticalData = Object.entries(visitsPerVerticalAgg).map(([name, value], index) => ({
        [vhrChartXAxisKey]: name, // Dynamic key for X-axis
        value,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));


    // Process data for Visits by Branch Location chart
    const branchLocationMap = new Map<string, string>();
    allBranches.forEach(b => branchLocationMap.set(b.id, b.location));
    const visitsPerLocationAgg: Record<string, number> = {};
    relevantVisits.forEach(visit => {
        const location = branchLocationMap.get(visit.branch_id);
        if (location) {
            visitsPerLocationAgg[location] = (visitsPerLocationAgg[location] || 0) + 1;
        }
    });
    const locationData = Object.entries(visitsPerLocationAgg)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value], index) => ({
            name,
            value,
            fill: `hsl(var(--chart-${(index % 5) + 1}))`,
        }));

    return {
        zhrCount: currentZhrCount,
        bhrCount: currentBhrCount,
        totalSubmittedVisits: currentTotalSubmittedVisits,
        avgSubmittedVisitsPerBranch: currentAvgVisits,
        visitsByVerticalChartData: verticalData,
        visitsByBranchLocationData: locationData,
        verticalChartTitle: vhrChartTitle,
        verticalChartXAxisKey: vhrChartXAxisKey
    };

  }, [allUsers, allBranches, allSubmittedVisits, selectedVhrId]);


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

  return (
    <div className="space-y-8">
      <PageTitle title="CHR Dashboard" description="Global Human Resources Overview (Filtered, Submitted Data)." />

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" />Filter by VHR Vertical</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedVhrId} onValueChange={setSelectedVhrId}>
            <SelectTrigger className="w-full md:w-1/3">
              <SelectValue placeholder="Select VHR Vertical..." />
            </SelectTrigger>
            <SelectContent>
              {vhrFilterOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"> {/* Adjusted to 4 columns */}
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} description={selectedVhrId !== 'all' ? "In selected vertical" : "Across all verticals"}/>
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} description={selectedVhrId !== 'all' ? "In selected vertical" : "Across all verticals"}/>
        <StatCard title="Total Branches" value={allBranches.length} icon={Building} description="Nationwide (unfiltered by VHR)"/>
        <StatCard title="Total Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} description={selectedVhrId !== 'all' ? "In selected vertical" : "Across all verticals"}/>
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
        <StatCard title="Avg Submitted Visits/Branch" value={avgSubmittedVisitsPerBranch} icon={TrendingUp} description="Calculated on filtered visits / total branches"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visitsByVerticalChartData.length > 0 ? (
            <PlaceholderBarChart
            data={visitsByVerticalChartData}
            title={verticalChartTitle}
            description={selectedVhrId === 'all' ? "Total submitted visits across different VHR-led verticals." : "Total submitted visits across ZHRs in the selected VHR's vertical."}
            xAxisKey={verticalChartXAxisKey}
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                    <p>No vertical visit data to display for current filter.</p>
                </div>
            </Card>
        )}
        {visitsByBranchLocationData.length > 0 ? (
            <PlaceholderPieChart
            data={visitsByBranchLocationData}
            title="Submitted Visits by Branch Location (Top 5)"
            description={selectedVhrId !== 'all' ? "For selected VHR vertical." : "Across all verticals."}
            dataKey="value"
            nameKey="name"
            />
        ) : (
             <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-2" />
                    <p>No branch location visit data to display for current filter.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
