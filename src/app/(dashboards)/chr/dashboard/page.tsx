
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarDays, BarChartBig, TrendingUp, Loader2, Briefcase, Percent, ShieldAlert, Building2 } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChrFilter } from '@/contexts/chr-filter-context'; 
import { isSameMonth, parseISO, startOfMonth } from 'date-fns';

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { 
    selectedVhrIds, vhrOptions, 
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
          const [branchesRes, visitsRes] = await Promise.all([
            supabase.from('branches').select('*'),
            supabase.from('visits').select('bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, cwt_cases').eq('status', 'submitted')
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
        selectedVhrIds.includes(u.id) || 
        zhrsInSelectedVhrs.has(u.id) ||   
        bhrsUnderSelectedVhrs.has(u.id)   
      );
    }
    return usersToFilter;
  }, [allUsersForContext, selectedVhrIds, isLoadingAllUsers]);

  const filteredSubmittedVisits = useMemo(() => {
    const bhrIdsInScope = filteredUsers.filter(u => u.role === 'BHR').map(b => b.id);
    
    if (selectedVhrIds.length === 0) return allSubmittedVisitsGlobal; 
    
    if (bhrIdsInScope.length === 0 && selectedVhrIds.length > 0) return []; 
    
    return allSubmittedVisitsGlobal.filter(visit => bhrIdsInScope.includes(visit.bhr_id));
  }, [allSubmittedVisitsGlobal, filteredUsers, selectedVhrIds]);

  const dashboardStats = useMemo(() => {
    const vhrUsers = selectedVhrIds.length > 0 
      ? filteredUsers.filter(u => u.role === 'VHR' && selectedVhrIds.includes(u.id))
      : allUsersForContext.filter(u => u.role === 'VHR');
    
    const zhrUsers = selectedVhrIds.length > 0
      ? filteredUsers.filter(u => u.role === 'ZHR') 
      : allUsersForContext.filter(u => u.role === 'ZHR');

    const bhrUsers = selectedVhrIds.length > 0
      ? filteredUsers.filter(u => u.role === 'BHR') 
      : allUsersForContext.filter(u => u.role === 'BHR');

    const currentTotalSubmittedVisits = filteredSubmittedVisits.length;
    
    const uniqueBranchesVisitedCount = new Set(filteredSubmittedVisits.map(visit => visit.branch_id)).size;
    const currentAvgVisits = uniqueBranchesVisitedCount > 0 ? (currentTotalSubmittedVisits / uniqueBranchesVisitedCount).toFixed(1) : "0.0";

    // Calculate metrics for the current month
    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const visitsThisMonth = filteredSubmittedVisits.filter(visit => 
      isSameMonth(parseISO(visit.visit_date), currentMonthStart)
    );

    let totalManning = 0;
    let manningCount = 0;
    visitsThisMonth.forEach(visit => {
      if (typeof visit.manning_percentage === 'number') {
        totalManning += visit.manning_percentage;
        manningCount++;
      }
    });
    const avgManningPercentageThisMonth = manningCount > 0 ? Math.round(totalManning / manningCount) : 0;

    let totalAttrition = 0;
    let attritionCount = 0;
    visitsThisMonth.forEach(visit => {
      if (typeof visit.attrition_percentage === 'number') {
        totalAttrition += visit.attrition_percentage;
        attritionCount++;
      }
    });
    const avgAttritionPercentageThisMonth = attritionCount > 0 ? Math.round(totalAttrition / attritionCount) : 0;

    let totalNonVendor = 0;
    let nonVendorCount = 0;
    visitsThisMonth.forEach(visit => {
        if (typeof visit.non_vendor_percentage === 'number') {
            totalNonVendor += visit.non_vendor_percentage;
            nonVendorCount++;
        }
    });
    const avgNonVendorPercentageThisMonth = nonVendorCount > 0 ? Math.round(totalNonVendor / nonVendorCount) : 0;

    let totalCWTCases = 0;
    visitsThisMonth.forEach(visit => {
        if (typeof visit.cwt_cases === 'number') {
            totalCWTCases += visit.cwt_cases;
        }
    });

    // Branch Coverage (Overall)
    const uniqueBranchesVisitedOverall = new Set(allSubmittedVisitsGlobal.map(visit => visit.branch_id)).size;
    const totalBranchesCount = allBranchesGlobal.length;
    const branchCoveragePercentage = totalBranchesCount > 0 ? Math.round((uniqueBranchesVisitedOverall / totalBranchesCount) * 100) : 0;
    
    return {
      vhrCount: vhrUsers.length,
      zhrCount: zhrUsers.length,
      bhrCount: bhrUsers.length,
      totalSubmittedVisits: currentTotalSubmittedVisits,
      avgSubmittedVisitsPerBranch: currentAvgVisits,
      avgManningPercentageThisMonth,
      avgAttritionPercentageThisMonth,
      avgNonVendorPercentageThisMonth,
      totalCWTCasesThisMonth: totalCWTCases,
      branchCoveragePercentage,
    };
  }, [filteredUsers, filteredSubmittedVisits, selectedVhrIds, allUsersForContext, allSubmittedVisitsGlobal, allBranchesGlobal]);

  const visitsByEntityChartData = useMemo(() => {
    if (isLoadingAllUsers || !allSubmittedVisitsGlobal.length) return [];

    let targetVisits = filteredSubmittedVisits;
    let entityNameMap = new Map<string, string>();
    let chartTitle = "Submitted Visits per VHR Vertical";
    let xAxisKey = 'name';

    const bhrToZhrMap = new Map(allUsersForContext.filter(u => u.role === 'BHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const zhrToVhrMap = new Map(allUsersForContext.filter(u => u.role === 'ZHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    
    const visitsPerEntity: Record<string, number> = {};

    if (selectedVhrIds.length > 0) {
      chartTitle = `Submitted Visits per ZHR`;
      if (selectedVhrIds.length === 1) chartTitle += ` (in ${vhrOptions.find(v=>v.value === selectedVhrIds[0])?.label || 'Selected VHR'})`;
      else chartTitle += ` (in ${selectedVhrIds.length} VHRs)`;
      
      allUsersForContext
        .filter(u => u.role === 'ZHR' && u.reports_to && selectedVhrIds.includes(u.reports_to))
        .forEach(zhr => entityNameMap.set(zhr.id, zhr.name));

      targetVisits.forEach(visit => {
        const zhrId = bhrToZhrMap.get(visit.bhr_id);
        if (zhrId && entityNameMap.has(zhrId)) {
          const entityName = entityNameMap.get(zhrId) || `ZHR ID: ${zhrId.substring(0,6)}`;
          visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
        }
      });
    } else { 
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
  }, [allUsersForContext, filteredSubmittedVisits, selectedVhrIds, isLoadingAllUsers, allSubmittedVisitsGlobal, vhrOptions]);
  
  const selectedHierarchyDetailsText = useMemo(() => {
    let name = "Global";
    let descriptionSuffix = "across all verticals";

    if (selectedVhrIds.length > 0) {
        if (selectedVhrIds.length === 1) {
            const vhr = vhrOptions.find(opt => opt.value === selectedVhrIds[0]);
            name = vhr ? vhr.label : "Selected Vertical";
        } else {
            name = `${selectedVhrIds.length} Verticals`;
        }
        descriptionSuffix = `for the selected vertical(s)`;
    }
    return { name, descriptionSuffix };
  }, [selectedVhrIds, vhrOptions]);

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
    selectedVhrIds.length > 0 ? `Submitted Visits per ZHR (${selectedHierarchyDetailsText.name})` :
    `Submitted Visits per VHR Vertical`;
  const barChartXAxisKey = 'name';

  return (
    <div className="space-y-8">
      <PageTitle title={`CHR Dashboard (${selectedHierarchyDetailsText.name})`} description={`Human Resources Overview ${selectedHierarchyDetailsText.descriptionSuffix}.`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        <Card className="shadow-lg bg-yellow-50 dark:bg-yellow-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg">
                <TrendingUp className="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">Avg Manning</p>
                <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-200">
                  {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : `${dashboardStats.avgManningPercentageThisMonth}%`}
                </p>
              </div>
            </div>
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-700/50 dark:text-yellow-300 border-yellow-300/50 dark:border-yellow-600/50 text-xs px-2 py-1">
              this month
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-lg bg-red-50 dark:bg-red-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 dark:bg-red-800/30 rounded-lg">
                <Briefcase className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-red-700 dark:text-red-300">Avg Attrition</p>
                <p className="text-3xl font-bold text-red-800 dark:text-red-200">
                  {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : `${dashboardStats.avgAttritionPercentageThisMonth}%`}
                </p>
              </div>
            </div>
            <Badge className="bg-red-100 text-red-700 dark:bg-red-700/50 dark:text-red-300 border-red-300/50 dark:border-red-600/50 text-xs px-2 py-1">
              this month
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-lg bg-cyan-50 dark:bg-cyan-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-800/30 rounded-lg">
                <Users className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-cyan-700 dark:text-cyan-300">Avg Non-Vendor</p>
                <p className="text-3xl font-bold text-cyan-800 dark:text-cyan-200">
                  {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : `${dashboardStats.avgNonVendorPercentageThisMonth}%`}
                </p>
              </div>
            </div>
            <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-700/50 dark:text-cyan-300 border-cyan-300/50 dark:border-cyan-600/50 text-xs px-2 py-1">
              this month
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-lg bg-orange-50 dark:bg-orange-900/40">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-800/30 rounded-lg">
                <ShieldAlert className="h-7 w-7 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-300">Total CWT Cases</p>
                <p className="text-3xl font-bold text-orange-800 dark:text-orange-200">
                  {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : `${dashboardStats.totalCWTCasesThisMonth}`}
                </p>
              </div>
            </div>
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-700/50 dark:text-orange-300 border-orange-300/50 dark:border-orange-600/50 text-xs px-2 py-1">
              this month
            </Badge>
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total VHRs" value={dashboardStats.vhrCount} icon={Users} description={`Monitored VHRs`}/>
        <StatCard title="Total ZHRs" value={dashboardStats.zhrCount} icon={Users} description={`In ${selectedHierarchyDetailsText.name}`}/>
        <StatCard title="Total BHRs" value={dashboardStats.bhrCount} icon={Users} description={`In ${selectedHierarchyDetailsText.name}`}/>
        <StatCard 
            title="Branch Coverage" 
            value={`${dashboardStats.branchCoveragePercentage}%`} 
            icon={Building2} 
            description={`Overall branch visit coverage`}
        />
      </div>
       <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
         <StatCard title="Submitted Visits" value={dashboardStats.totalSubmittedVisits} icon={CalendarDays} description={`Total submitted visits in ${selectedHierarchyDetailsText.name}`}/>
         <StatCard 
            title="Avg Visits / Visited Branch" 
            value={dashboardStats.avgSubmittedVisitsPerBranch} 
            icon={TrendingUp} 
            description={`Avg visits per unique branch with activity in ${selectedHierarchyDetailsText.name}`}
        />
      </div>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
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
            description={`Total submitted visits, reflecting current VHR filters.`}
            xAxisKey={barChartXAxisKey}
            dataKey="value"
            />
        ) : (
            <Card className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                    <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                    <p>No visit data to display for {selectedHierarchyDetailsText.name}.</p>
                     {selectedVhrIds.length > 0 && <p className="text-xs">Try adjusting VHR filters.</p>}
                </div>
            </Card>
        )}
      </div>
    </div>
  );
}

