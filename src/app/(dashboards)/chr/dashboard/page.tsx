
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarDays, BarChartBig, TrendingUp, Loader2 } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { useChrFilter } from '@/contexts/chr-filter-context'; 

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { 
    selectedVhrIds, vhrOptions, 
    selectedZhrIds, zhrOptions,
    allUsersForContext, isLoadingAllUsers 
  } = useChrFilter();

  const [isLoadingDashboardData, setIsLoadingDashboardData] = useState(true);
  const [allBranchesGlobal, setAllBranchesGlobal] = useState<Branch[]>([]);
  const [allSubmittedVisitsGlobal, setAllSubmittedVisitsGlobal] = useState<Visit[]>([]);

  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchData = async () => {
        setIsLoadingDashboardData(true);
        try {
          // allUsersForContext is already fetched by ChrFilterProvider
          // Fetch branches and visits
          const [branchesRes, visitsRes] = await Promise.all([
            supabase.from('branches').select('*'),
            supabase.from('visits').select('*').eq('status', 'submitted')
          ]);

          if (branchesRes.error) throw branchesRes.error;
          setAllBranchesGlobal(branchesRes.data || []);

          if (visitsRes.error) throw visitsRes.error;
          setAllSubmittedVisitsGlobal(visitsRes.data || []);

        } catch (error: any) {
          console.error("CHR Dashboard: Error fetching branches/visits:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setAllBranchesGlobal([]);
          setAllSubmittedVisitsGlobal([]);
        } finally {
          setIsLoadingDashboardData(false);
        }
      };
      fetchData();
    } else {
      setIsLoadingDashboardData(false);
    }
  }, [user, toast]); 

  const filteredUsers = useMemo(() => {
    if (isLoadingAllUsers) return [];
    let usersToFilter = allUsersForContext;

    if (selectedVhrIds.length > 0) {
      const zhrsInSelectedVhrs = new Set<string>(
        usersToFilter
          .filter(u => u.role === 'ZHR' && u.reports_to && selectedVhrIds.includes(u.reports_to))
          .map(z => z.id)
      );
      const bhrsUnderSelectedVhrs = new Set<string>(
        usersToFilter
          .filter(u => u.role === 'BHR' && u.reports_to && zhrsInSelectedVhrs.has(u.reports_to))
          .map(b => b.id)
      );
      usersToFilter = usersToFilter.filter(u =>
        selectedVhrIds.includes(u.id) || // The VHRs themselves
        zhrsInSelectedVhrs.has(u.id) ||   // ZHRs under them
        bhrsUnderSelectedVhrs.has(u.id)   // BHRs under those ZHRs
      );
    }

    if (selectedZhrIds.length > 0) {
      const bhrsInSelectedZhrs = new Set<string>(
        usersToFilter
          .filter(u => u.role === 'BHR' && u.reports_to && selectedZhrIds.includes(u.reports_to))
          .map(b => b.id)
      );
      usersToFilter = usersToFilter.filter(u =>
        selectedZhrIds.includes(u.id) || // The ZHRs themselves
        bhrsInSelectedZhrs.has(u.id)      // BHRs under them
        || (selectedVhrIds.length > 0 && selectedVhrIds.includes(u.id) && u.role === 'VHR') // Keep selected VHRs
        || (u.role === 'CHR') // Always keep CHR
      );
    }
    return usersToFilter;
  }, [allUsersForContext, selectedVhrIds, selectedZhrIds, isLoadingAllUsers]);

  const filteredSubmittedVisits = useMemo(() => {
    const bhrIdsInScope = filteredUsers.filter(u => u.role === 'BHR').map(b => b.id);
    if (selectedVhrIds.length === 0 && selectedZhrIds.length === 0) return allSubmittedVisitsGlobal; // No filter, show all
    if (bhrIdsInScope.length === 0 && (selectedVhrIds.length > 0 || selectedZhrIds.length > 0) ) return []; // Filters active but no BHRs match
    return allSubmittedVisitsGlobal.filter(visit => bhrIdsInScope.includes(visit.bhr_id));
  }, [allSubmittedVisitsGlobal, filteredUsers, selectedVhrIds, selectedZhrIds]);

  const {
    vhrCount,
    zhrCount,
    bhrCount,
    totalSubmittedVisits,
    avgSubmittedVisitsPerBranch,
  } = useMemo(() => {
    const currentVhrCount = filteredUsers.filter(u => u.role === 'VHR').length;
    const currentZhrCount = filteredUsers.filter(u => u.role === 'ZHR').length;
    const currentBhrCount = filteredUsers.filter(u => u.role === 'BHR').length;
    const currentTotalSubmittedVisits = filteredSubmittedVisits.length;
    
    const uniqueBranchesVisitedCount = new Set(filteredSubmittedVisits.map(visit => visit.branch_id)).size;
    const currentAvgVisits = uniqueBranchesVisitedCount > 0 ? (currentTotalSubmittedVisits / uniqueBranchesVisitedCount).toFixed(1) : "0.0";
    
    return {
      vhrCount: selectedVhrIds.length > 0 ? currentVhrCount : allUsersForContext.filter(u => u.role === 'VHR').length, // Show total if "All VHRs"
      zhrCount: currentZhrCount,
      bhrCount: currentBhrCount,
      totalSubmittedVisits: currentTotalSubmittedVisits,
      avgSubmittedVisitsPerBranch: currentAvgVisits,
    };
  }, [filteredUsers, filteredSubmittedVisits, selectedVhrIds, allUsersForContext]);

  const visitsByEntityChartData = useMemo(() => {
    if (isLoadingAllUsers || !allSubmittedVisitsGlobal.length) return [];

    const visitsPerEntity: Record<string, number> = {};
    const entityNameMap = new Map<string, string>();
    const bhrToZhrMap = new Map(allUsersForContext.filter(u => u.role === 'BHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const zhrToVhrMap = new Map(allUsersForContext.filter(u => u.role === 'ZHR' && u.reports_to).map(u => [u.id, u.reports_to!]));

    let targetVisits = filteredSubmittedVisits; // Use already filtered visits

    // Determine what entities to show on the chart
    if (selectedZhrIds.length > 0) { // If ZHRs are selected, show BHRs under them
        filteredUsers.filter(u => u.role === 'BHR' && selectedZhrIds.includes(u.reports_to || '')).forEach(bhr => entityNameMap.set(bhr.id, bhr.name));
        targetVisits.forEach(visit => {
            if (entityNameMap.has(visit.bhr_id)) {
                const entityName = entityNameMap.get(visit.bhr_id) || `BHR ID: ${visit.bhr_id.substring(0,6)}`;
                visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
            }
        });
    } else if (selectedVhrIds.length > 0) { // If VHRs selected (but no ZHRs), show ZHRs under them
        filteredUsers.filter(u => u.role === 'ZHR' && selectedVhrIds.includes(u.reports_to || '')).forEach(zhr => entityNameMap.set(zhr.id, zhr.name));
        targetVisits.forEach(visit => {
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId && entityNameMap.has(zhrId)) {
                 const entityName = entityNameMap.get(zhrId) || `ZHR ID: ${zhrId.substring(0,6)}`;
                 visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
            }
        });
    } else { // No VHRs or ZHRs selected, show VHRs
        allUsersForContext.filter(u => u.role === 'VHR').forEach(vhr => entityNameMap.set(vhr.id, vhr.name));
        targetVisits.forEach(visit => {
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId) {
                const vhrId = zhrToVhrMap.get(zhrId);
                if (vhrId && entityNameMap.has(vhrId)) {
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
    })).sort((a,b) => b.value - a.value);
  }, [allUsersForContext, filteredSubmittedVisits, selectedVhrIds, selectedZhrIds, isLoadingAllUsers, allSubmittedVisitsGlobal, filteredUsers]);
  
  const selectedHierarchyDetailsText = useMemo(() => {
    let name = "Global";
    let descriptionSuffix = "across all verticals and zones";

    if (selectedZhrIds.length > 0) {
        if (selectedZhrIds.length === 1) {
            const zhr = zhrOptions.find(opt => opt.value === selectedZhrIds[0]);
            name = zhr ? zhr.label : "Selected Zone";
        } else {
            name = `${selectedZhrIds.length} Zones`;
        }
        descriptionSuffix = `for the selected zone(s)`;
        if (selectedVhrIds.length > 0) {
            const vhrPart = selectedVhrIds.length === 1 
                ? (vhrOptions.find(opt => opt.value === selectedVhrIds[0])?.label || "Selected VHR")
                : `${selectedVhrIds.length} VHRs`;
            descriptionSuffix += ` within ${vhrPart}`;
        }
    } else if (selectedVhrIds.length > 0) {
        if (selectedVhrIds.length === 1) {
            const vhr = vhrOptions.find(opt => opt.value === selectedVhrIds[0]);
            name = vhr ? vhr.label : "Selected Vertical";
        } else {
            name = `${selectedVhrIds.length} Verticals`;
        }
        descriptionSuffix = `for the selected vertical(s)`;
    }
    return { name, descriptionSuffix };
  }, [selectedVhrIds, vhrOptions, selectedZhrIds, zhrOptions]);

  const isLoading = isLoadingAllUsers || isLoadingDashboardData;

  if (isLoading && user?.role === 'CHR') {
    return (
      <div className="space-y-8">
        <PageTitle title="CHR Dashboard" description={`Loading ${selectedHierarchyDetailsText.name} Overview...`} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'CHR') return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;

  const barChartTitle = 
    selectedZhrIds.length > 0 ? `Submitted Visits per BHR (${selectedHierarchyDetailsText.name})` :
    selectedVhrIds.length > 0 ? `Submitted Visits per ZHR (${selectedHierarchyDetailsText.name})` :
    `Submitted Visits per VHR Vertical`;
  const barChartXAxisKey = 'name';

  return (
    <div className="space-y-8">
      <PageTitle title={`CHR Dashboard (${selectedHierarchyDetailsText.name})`} description={`Human Resources Overview ${selectedHierarchyDetailsText.descriptionSuffix}.`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total VHRs" value={vhrCount} icon={Users} description={`Monitored VHRs`}/>
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} description={`In ${selectedHierarchyDetailsText.name}`}/>
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} description={`In ${selectedHierarchyDetailsText.name}`}/>
        <StatCard 
            title="Avg Visits / Visited Branch" 
            value={avgSubmittedVisitsPerBranch} 
            icon={TrendingUp} 
            description={`Avg visits per unique branch with activity in ${selectedHierarchyDetailsText.name}`}
        />
      </div>
       <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
         <StatCard title="Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} description={`In ${selectedHierarchyDetailsText.name}`}/>
         <Link href="/chr/analytics" className="w-full">
            <Button className="w-full h-full text-lg py-8" variant="outline">
                <BarChartBig className="mr-2 h-8 w-8" /> View Deep Analytics
            </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {visitsByEntityChartData.length > 0 ? (
            <PlaceholderBarChart
            data={visitsByEntityChartData}
            title={barChartTitle}
            description={`Total submitted visits, reflecting current VHR/ZHR filters.`}
            xAxisKey={barChartXAxisKey}
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                    <p>No visit data to display for {selectedHierarchyDetailsText.name}.</p>
                     {(selectedVhrIds.length > 0 || selectedZhrIds.length > 0) && <p className="text-xs">Try adjusting VHR/ZHR filters.</p>}
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
