
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
import { useChrFilter } from '@/contexts/chr-filter-context'; // Import the context hook

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const chrFilterHook = user?.role === 'CHR' ? useChrFilter : () => ({
    selectedVhrId: 'all',
    vhrOptions: [{ value: 'all', label: 'All VHR Verticals' }],
    isLoadingVhrOptions: false,
  });
  const { selectedVhrId, vhrOptions } = chrFilterHook();

  const [isLoading, setIsLoading] = useState(true);

  // Global data stores (fetch all initially)
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);

  useEffect(() => {
    console.log('CHR Dashboard - Selected VHR ID from context:', selectedVhrId);
    // Fetching data globally, filtering will happen in useMemo
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
    if (selectedVhrId === 'all') return allUsers;
    
    const zhrsInSelectedVertical = allUsers.filter(u => u.role === 'ZHR' && u.reports_to === selectedVhrId);
    const zhrIdsInSelectedVertical = zhrsInSelectedVertical.map(z => z.id);
    const bhrsInSelectedVertical = allUsers.filter(u => u.role === 'BHR' && u.reports_to && zhrIdsInSelectedVertical.includes(u.reports_to));
    const vhrUser = allUsers.find(u => u.id === selectedVhrId);
    
    return [
        ...(vhrUser ? [vhrUser] : []),
        ...zhrsInSelectedVertical,
        ...bhrsInSelectedVertical,
        ...allUsers.filter(u => u.role === 'CHR') 
    ];
  }, [allUsers, selectedVhrId]);

  const filteredSubmittedVisits = useMemo(() => {
    if (selectedVhrId === 'all') return allSubmittedVisits;
    const bhrIdsInSelectedVertical = filteredUsers.filter(u => u.role === 'BHR').map(b => b.id);
    return allSubmittedVisits.filter(visit => bhrIdsInSelectedVertical.includes(visit.bhr_id));
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
    
    const relevantBranchIds = selectedVhrId === 'all' 
        ? new Set(allBranches.map(b => b.id))
        : new Set(filteredSubmittedVisits.map(v => v.branch_id));
    const relevantBranchesCount = relevantBranchIds.size > 0 ? relevantBranchIds.size : (selectedVhrId === 'all' ? allBranches.length : 0);

    const currentAvgVisits = relevantBranchesCount > 0 ? (currentTotalSubmittedVisits / relevantBranchesCount).toFixed(1) : "0.0";
    
    return {
      zhrCount: currentZhrCount,
      bhrCount: currentBhrCount,
      totalSubmittedVisits: currentTotalSubmittedVisits,
      avgSubmittedVisitsPerBranch: currentAvgVisits,
    };
  }, [filteredUsers, filteredSubmittedVisits, allBranches, selectedVhrId]);

  const visitsByVerticalChartData = useMemo(() => {
    if (!allUsers.length || !filteredSubmittedVisits.length) return [];

    const visitsPerEntity: Record<string, number> = {};
    const entityNameMap = new Map<string, string>();
    const bhrToZhrMap = new Map(allUsers.filter(u => u.role === 'BHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const zhrToVhrMap = new Map(allUsers.filter(u => u.role === 'ZHR' && u.reports_to).map(u => [u.id, u.reports_to!]));

    if (selectedVhrId === 'all') { 
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
    } else { 
        allUsers.filter(u => u.role === 'ZHR' && u.reports_to === selectedVhrId).forEach(zhr => entityNameMap.set(zhr.id, zhr.name));
        filteredSubmittedVisits.forEach(visit => { // These are already filtered for the selected VHR
            const zhrId = bhrToZhrMap.get(visit.bhr_id);
            if (zhrId && entityNameMap.has(zhrId)) { 
                 const entityName = entityNameMap.get(zhrId) || `ZHR ID: ${zhrId.substring(0,6)}`;
                 visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
            }
        });
    }
    return Object.entries(visitsPerEntity).map(([name, value], index) => ({
      name, 
      value,
      fill: `hsl(var(--chart-${(index % 5) + 1}))`,
    }));
  }, [allUsers, filteredSubmittedVisits, selectedVhrId]);

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
  }, [allBranches, filteredSubmittedVisits, selectedVhrId]);
  
  const selectedVhrDetails = useMemo(() => {
    if (selectedVhrId === 'all') return { name: 'Global', descriptionSuffix: 'across all verticals' };
    const vhr = vhrOptions.find(opt => opt.value === selectedVhrId);
    return vhr ? { name: vhr.label, descriptionSuffix: `for ${vhr.label}'s vertical` } : { name: 'Selected Vertical', descriptionSuffix: 'for the selected vertical'};
  }, [selectedVhrId, vhrOptions]);


  if (isLoading && user?.role === 'CHR') {
    return (
      <div className="space-y-8">
        <PageTitle title="CHR Dashboard" description={`Loading ${selectedVhrDetails.name} Overview...`} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'CHR') return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;

  const barChartTitle = selectedVhrId === 'all' ? "Submitted Visits per VHR Vertical" : `Submitted Visits per ZHR (${selectedVhrDetails.name})`;
  const barChartXAxisKey = 'name';

  return (
    <div className="space-y-8">
      <PageTitle title={`CHR Dashboard (${selectedVhrDetails.name})`} description={`Human Resources Overview ${selectedVhrDetails.descriptionSuffix}.`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} description={`In ${selectedVhrDetails.name}`}/>
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} description={`In ${selectedVhrDetails.name}`}/>
        <StatCard title="Total Branches" value={allBranches.length} icon={Building} description="Nationwide (Global)"/>
        <StatCard title="Submitted Visits" value={totalSubmittedVisits} icon={CalendarDays} description={`In ${selectedVhrDetails.name}`}/>
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
        <StatCard title="Avg Submitted Visits/Relevant Branch" value={avgSubmittedVisitsPerBranch} icon={TrendingUp} description={`For ${selectedVhrDetails.name}`}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visitsByVerticalChartData.length > 0 ? (
            <PlaceholderBarChart
            data={visitsByVerticalChartData}
            title={barChartTitle}
            description={`Total submitted visits for ${selectedVhrDetails.name}.`}
            xAxisKey={barChartXAxisKey}
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                    <p>No vertical/zonal visit data for {selectedVhrDetails.name}.</p>
                </div>
            </Card>
        )}
        {visitsByBranchLocationData.length > 0 ? (
            <PlaceholderPieChart
            data={visitsByBranchLocationData}
            title={`Submitted Visits by Branch Location (Top 5 for ${selectedVhrDetails.name})`}
            description={`Top 5 branch locations by submitted visits for ${selectedVhrDetails.name}.`}
            dataKey="value"
            nameKey="name"
            />
        ) : (
             <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-2" />
                    <p>No branch location visit data for {selectedVhrDetails.name}.</p>
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}
