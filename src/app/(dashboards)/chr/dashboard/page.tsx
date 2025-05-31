
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
import { Card } from '@/components/ui/card';
import { useChrFilter } from '@/contexts/chr-filter-context'; 

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const chrFilterHook = user?.role === 'CHR' ? useChrFilter : () => ({
    selectedVhrIds: [], // Default for non-CHR or if context not ready
    vhrOptions: [],
    isLoadingVhrOptions: false,
  });
  // Ensure setSelectedVhrIds is destructured if it's ever needed, though not for this page typically.
  const { selectedVhrIds, vhrOptions } = chrFilterHook();

  const [isLoading, setIsLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);

  useEffect(() => {
    console.log('CHR Dashboard - Selected VHR IDs from context:', selectedVhrIds);
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

  const filteredUsers = useMemo(() => {
    if (selectedVhrIds.length === 0) return allUsers; // If no VHRs selected, effectively "All"
    
    const zhrsInSelectedVerticals = new Set<string>();
    allUsers.forEach(u => {
      if (u.role === 'ZHR' && u.reports_to && selectedVhrIds.includes(u.reports_to)) {
        zhrsInSelectedVerticals.add(u.id);
      }
    });

    const bhrsInSelectedVerticals = new Set<string>();
    allUsers.forEach(u => {
      if (u.role === 'BHR' && u.reports_to && zhrsInSelectedVerticals.has(u.reports_to)) {
        bhrsInSelectedVerticals.add(u.id);
      }
    });
    
    return allUsers.filter(u => 
        (u.role === 'CHR') || // Always include CHR
        (u.role === 'VHR' && selectedVhrIds.includes(u.id)) || // Selected VHRs
        (u.role === 'ZHR' && zhrsInSelectedVerticals.has(u.id)) || // ZHRs under selected VHRs
        (u.role === 'BHR' && bhrsInSelectedVerticals.has(u.id)) // BHRs under those ZHRs
    );
  }, [allUsers, selectedVhrIds]);

  const filteredSubmittedVisits = useMemo(() => {
    if (selectedVhrIds.length === 0) return allSubmittedVisits; // All if no filter
    const bhrIdsInSelectedVerticals = filteredUsers.filter(u => u.role === 'BHR').map(b => b.id);
    return allSubmittedVisits.filter(visit => bhrIdsInSelectedVerticals.includes(visit.bhr_id));
  }, [allSubmittedVisits, filteredUsers, selectedVhrIds]);

  const {
    zhrCount,
    bhrCount,
    totalSubmittedVisits,
    avgSubmittedVisitsPerBranch,
  } = useMemo(() => {
    const currentZhrCount = filteredUsers.filter(u => u.role === 'ZHR').length;
    const currentBhrCount = filteredUsers.filter(u => u.role === 'BHR').length;
    const currentTotalSubmittedVisits = filteredSubmittedVisits.length;
    
    let relevantBranchesCount = allBranches.length;
    if (selectedVhrIds.length > 0) {
        // If specific VHRs are selected, count branches associated with visits from those VHRs' BHRs
        const branchIdsFromFilteredVisits = new Set(filteredSubmittedVisits.map(v => v.branch_id));
        relevantBranchesCount = branchIdsFromFilteredVisits.size > 0 ? branchIdsFromFilteredVisits.size : 0;
    }
    
    const currentAvgVisits = relevantBranchesCount > 0 ? (currentTotalSubmittedVisits / relevantBranchesCount).toFixed(1) : "0.0";
    
    return {
      zhrCount: currentZhrCount,
      bhrCount: currentBhrCount,
      totalSubmittedVisits: currentTotalSubmittedVisits,
      avgSubmittedVisitsPerBranch: currentAvgVisits,
    };
  }, [filteredUsers, filteredSubmittedVisits, allBranches, selectedVhrIds]);

  const visitsByVerticalChartData = useMemo(() => {
    if (!allUsers.length || !filteredSubmittedVisits.length) return [];

    const visitsPerEntity: Record<string, number> = {};
    const entityNameMap = new Map<string, string>();
    const bhrToZhrMap = new Map(allUsers.filter(u => u.role === 'BHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const zhrToVhrMap = new Map(allUsers.filter(u => u.role === 'ZHR' && u.reports_to).map(u => [u.id, u.reports_to!]));

    if (selectedVhrIds.length === 0) { // "All VHRs" selected or no filter
        allUsers.filter(u => u.role === 'VHR').forEach(vhr => entityNameMap.set(vhr.id, vhr.name));
        filteredSubmittedVisits.forEach(visit => {
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId) {
                const vhrId = zhrToVhrMap.get(zhrId);
                if (vhrId) {
                    const entityName = entityNameMap.get(vhrId) || `VHR ID: ${vhrId.substring(0,6)}`;
                    visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
                }
            }
        });
    } else if (selectedVhrIds.length === 1) { // Single VHR selected, show ZHRs under it
        const singleVhrId = selectedVhrIds[0];
        allUsers.filter(u => u.role === 'ZHR' && u.reports_to === singleVhrId).forEach(zhr => entityNameMap.set(zhr.id, zhr.name));
        filteredSubmittedVisits.forEach(visit => { // These are already filtered for the selected VHR's BHRs
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId && entityNameMap.has(zhrId)) { 
                 const entityName = entityNameMap.get(zhrId) || `ZHR ID: ${zhrId.substring(0,6)}`;
                 visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
            }
        });
    } else { // Multiple VHRs selected, show data for each selected VHR
        selectedVhrIds.forEach(vhrId => {
            const vhrUser = allUsers.find(u => u.id === vhrId && u.role === 'VHR');
            if (vhrUser) entityNameMap.set(vhrUser.id, vhrUser.name);
        });
        filteredSubmittedVisits.forEach(visit => {
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId) {
                const vhrId = zhrToVhrMap.get(zhrId);
                if (vhrId && selectedVhrIds.includes(vhrId)) { // Ensure visit belongs to one of the selected VHRs
                    const entityName = entityNameMap.get(vhrId) || `VHR ID: ${vhrId.substring(0,6)}`;
                    visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
                }
            }
        });
    }

    return Object.entries(visitsPerEntity).map(([name, value], index) => ({
      name, 
      value,
      fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));
  }, [allUsers, filteredSubmittedVisits, selectedVhrIds]);

  const visitsByBranchLocationData = useMemo(() => {
    if (!allBranches.length || !filteredSubmittedVisits.length) return [];
    const visitsPerLocation: Record<string, number> = {};
    const branchLocationMap = new Map(allBranches.map(b => [b.id, b.location]));

    filteredSubmittedVisits.forEach(visit => {
      const location = branchLocationMap.get(visit.branch_id);
      if (location) {
        visitsPerLocation[location] = (visitsPerLocation[location] || 0) + 1;
      }
    });
    return Object.entries(visitsPerLocation)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value], index) => ({
        name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))`,
      }));
  }, [allBranches, filteredSubmittedVisits, selectedVhrIds]);
  
  const selectedVhrDetailsText = useMemo(() => {
    if (selectedVhrIds.length === 0) return { name: 'Global', descriptionSuffix: 'across all verticals' };
    if (selectedVhrIds.length === 1) {
      const vhr = vhrOptions.find(opt => opt.value === selectedVhrIds[0]);
      return vhr ? { name: vhr.label, descriptionSuffix: `for ${vhr.label}'s vertical` } : { name: 'Selected Vertical', descriptionSuffix: 'for the selected vertical'};
    }
    return { name: `${selectedVhrIds.length} Verticals`, descriptionSuffix: `for ${selectedVhrIds.length} selected verticals` };
  }, [selectedVhrIds, vhrOptions]);


  if (isLoading && user?.role === 'CHR') {
    return (
      <div className="space-y-8">
        <PageTitle title="CHR Dashboard" description={`Loading ${selectedVhrDetailsText.name} Overview...`} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'CHR') return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;

  const barChartTitle = 
    selectedVhrIds.length === 0 ? "Submitted Visits per VHR Vertical" :
    selectedVhrIds.length === 1 ? `Submitted Visits per ZHR (${selectedVhrDetailsText.name})` :
    `Submitted Visits for Selected VHRs`;
  const barChartXAxisKey = 'name';

  return (
    <div className="space-y-8">
      <PageTitle title={`CHR Dashboard (${selectedVhrDetailsText.name})`} description={`Human Resources Overview ${selectedVhrDetailsText.descriptionSuffix}.`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"> {/* Adjusted grid to 3 cols for remaining stats */}
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} description={`In ${selectedVhrDetailsText.name}`}/>
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} description={`In ${selectedVhrDetailsText.name}`}/>
        <StatCard title="Total Branches (Global)" value={allBranches.length} icon={Building} description="Nationwide"/>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} description={`In ${selectedVhrDetailsText.name}`}/>
        <StatCard title="Avg Submitted Visits/Branch" value={avgSubmittedVisitsPerBranch} icon={TrendingUp} description={`For ${selectedVhrDetailsText.name} (relevant branches)`}/>
         <Link href="/chr/analytics" className="w-full">
            <Button className="w-full h-full text-lg py-8" variant="outline">
                <BarChartBig className="mr-2 h-8 w-8" /> View Deep Analytics
            </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visitsByVerticalChartData.length > 0 ? (
            <PlaceholderBarChart
            data={visitsByVerticalChartData}
            title={barChartTitle}
            description={`Total submitted visits for ${selectedVhrDetailsText.name}.`}
            xAxisKey={barChartXAxisKey}
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                    <p>No vertical/zonal visit data for {selectedVhrDetailsText.name}.</p>
                </div>
            </Card>
        )}
        {visitsByBranchLocationData.length > 0 ? (
            <PlaceholderPieChart
            data={visitsByBranchLocationData}
            title={`Submitted Visits by Branch Location (Top 5 for ${selectedVhrDetailsText.name})`}
            description={`Top 5 branch locations by submitted visits for ${selectedVhrDetailsText.name}.`}
            dataKey="value"
            nameKey="name"
            />
        ) : (
             <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-2" />
                    <p>No branch location visit data for {selectedVhrDetailsText.name}.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
