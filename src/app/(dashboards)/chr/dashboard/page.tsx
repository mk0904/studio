
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarDays, Globe2, BarChartBig, TrendingUp, Loader2 } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
// import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart'; // Removed
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { useChrFilter } from '@/contexts/chr-filter-context'; 

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const chrFilterHook = user?.role === 'CHR' ? useChrFilter : () => ({
    selectedVhrIds: [], 
    vhrOptions: [],
    isLoadingVhrOptions: false,
  });
  const { selectedVhrIds, vhrOptions } = chrFilterHook();

  const [isLoading, setIsLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]); // Still needed for unique branch count in avg visits
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
    if (selectedVhrIds.length === 0) return allUsers; // "All" VHRs selected
    
    const directVhrTargets = new Set(selectedVhrIds);
    const zhrsInSelectedVerticals = new Set<string>();
    allUsers.forEach(u => {
      if (u.role === 'ZHR' && u.reports_to && directVhrTargets.has(u.reports_to)) {
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
        (u.role === 'CHR') || 
        (u.role === 'VHR' && directVhrTargets.has(u.id)) || 
        (u.role === 'ZHR' && zhrsInSelectedVerticals.has(u.id)) || 
        (u.role === 'BHR' && bhrsInSelectedVerticals.has(u.id)) 
    );
  }, [allUsers, selectedVhrIds]);

  const filteredSubmittedVisits = useMemo(() => {
    if (selectedVhrIds.length === 0) return allSubmittedVisits; 
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
    
    const uniqueBranchesVisitedCount = new Set(filteredSubmittedVisits.map(visit => visit.branch_id)).size;
    const currentAvgVisits = uniqueBranchesVisitedCount > 0 ? (currentTotalSubmittedVisits / uniqueBranchesVisitedCount).toFixed(1) : "0.0";
    
    return {
      zhrCount: currentZhrCount,
      bhrCount: currentBhrCount,
      totalSubmittedVisits: currentTotalSubmittedVisits,
      avgSubmittedVisitsPerBranch: currentAvgVisits,
    };
  }, [filteredUsers, filteredSubmittedVisits]);

  const visitsByVerticalChartData = useMemo(() => {
    if (!allUsers.length || !filteredSubmittedVisits.length) return [];

    const visitsPerEntity: Record<string, number> = {};
    const entityNameMap = new Map<string, string>();
    const bhrToZhrMap = new Map(allUsers.filter(u => u.role === 'BHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const zhrToVhrMap = new Map(allUsers.filter(u => u.role === 'ZHR' && u.reports_to).map(u => [u.id, u.reports_to!]));

    if (selectedVhrIds.length === 0) { 
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
    } else if (selectedVhrIds.length === 1) { 
        const singleVhrId = selectedVhrIds[0];
        allUsers.filter(u => u.role === 'ZHR' && u.reports_to === singleVhrId).forEach(zhr => entityNameMap.set(zhr.id, zhr.name));
        filteredSubmittedVisits.forEach(visit => { 
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId && entityNameMap.has(zhrId)) { 
                 const entityName = entityNameMap.get(zhrId) || `ZHR ID: ${zhrId.substring(0,6)}`;
                 visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
            }
        });
    } else { // Multiple VHRs selected
        selectedVhrIds.forEach(vhrId => {
            const vhrUser = allUsers.find(u => u.id === vhrId && u.role === 'VHR');
            if (vhrUser) entityNameMap.set(vhrUser.id, vhrUser.name);
        });
        filteredSubmittedVisits.forEach(visit => {
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId) {
                const vhrId = zhrToVhrMap.get(zhrId);
                if (vhrId && selectedVhrIds.includes(vhrId)) { 
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
  }, [allUsers, filteredSubmittedVisits, selectedVhrIds]);
  
  const selectedVhrDetailsText = useMemo(() => {
    if (selectedVhrIds.length === 0) return { name: 'Global', descriptionSuffix: 'across all verticals' };
    if (selectedVhrIds.length === 1) {
      const vhr = vhrOptions.find(opt => opt.value === selectedVhrIds[0]);
      return vhr ? { name: vhr.label, descriptionSuffix: `for ${vhr.label}'s vertical` } : { name: 'Selected Vertical', descriptionSuffix: 'for the selected vertical'};
    }
    const selectedNames = selectedVhrIds.map(id => vhrOptions.find(opt => opt.value === id)?.label || `ID: ${id.substring(0,4)}`).join(', ');
    return { name: `${selectedVhrIds.length} Verticals`, descriptionSuffix: `for ${selectedNames}` };
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} description={`In ${selectedVhrDetailsText.name}`}/>
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} description={`In ${selectedVhrDetailsText.name}`}/>
      {/* </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2"> */}
        <StatCard title="Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} description={`In ${selectedVhrDetailsText.name}`}/>
        <StatCard 
            title="Avg Visits / Visited Branch" 
            value={avgSubmittedVisitsPerBranch} 
            icon={TrendingUp} 
            description={`Avg visits per unique branch with activity in ${selectedVhrDetailsText.name}`}
        />
      </div>
       <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
         <Link href="/chr/analytics" className="w-full">
            <Button className="w-full h-full text-lg py-8" variant="outline">
                <BarChartBig className="mr-2 h-8 w-8" /> View Deep Analytics
            </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6"> {/* Changed to lg:grid-cols-1 */}
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
        {/* PlaceholderPieChart for branch locations removed */}
      </div>
    </div>
  );
}
