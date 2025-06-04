'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarDays, BarChartBig, TrendingUp, Loader2, Briefcase, Percent, ShieldAlert, Building2, ChevronsUpDown, XCircle } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChrFilter } from '@/contexts/chr-filter-context'; 
import { isSameMonth, parseISO, startOfMonth } from 'date-fns';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js/auto';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { 
    selectedVhrIds, vhrOptions, 
    allUsersForContext, isLoadingAllUsers,
    setSelectedVhrIds
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
            supabase.from('visits').select('id, bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, cwt_cases').eq('status', 'submitted')
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
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageTitle title={`CHR Dashboard (${selectedHierarchyDetailsText.name})`} description={`Human Resources Overview ${selectedHierarchyDetailsText.descriptionSuffix}.`} />
        {/* VHR Filter - top right, matching analytics page */}
        <div className="w-full sm:w-auto relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[200px] h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                <span className="truncate">
                  {vhrOptions.length > 0 ? selectedVhrIds.length === 0 ? "All VHRs" : selectedVhrIds.length === 1 ? vhrOptions.find(opt => opt.value === selectedVhrIds[0])?.label : `${selectedVhrIds.length} VHRs Selected` : isLoadingAllUsers ? "Loading VHRs..." : "No VHRs found"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
              {vhrOptions.length === 0 && !isLoadingAllUsers && <DropdownMenuLabel>No VHRs found</DropdownMenuLabel>}
              {isLoadingAllUsers && <DropdownMenuLabel className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading VHRs...</DropdownMenuLabel>}
              {vhrOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={selectedVhrIds.includes(option.value)}
                  onCheckedChange={() => {
                    if (selectedVhrIds.includes(option.value)) {
                      setSelectedVhrIds(selectedVhrIds.filter(id => id !== option.value));
                    } else {
                      setSelectedVhrIds([...selectedVhrIds, option.value]);
                    }
                  }}
                  className="capitalize"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedVhrIds.length > 0 && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedVhrIds([]); }} aria-label="Clear VHR filter">
              <XCircle className="h-4 w-4 text-red-600 hover:text-red-700" />
            </Button>
          )}
        </div>
      </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
          {/* Avg Manning */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-yellow-500/10 bg-gradient-to-br from-white to-yellow-500/5 transition-all duration-200 hover:border-yellow-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-yellow-700">Avg Manning</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Average manning percentage
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : `${dashboardStats.avgManningPercentageThisMonth}%`}
              </div>
              <div className="text-xs text-yellow-600/90 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>This Month</span>
              </div>
            </CardContent>
          </Card>

          {/* Avg Attrition */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-red-500/10 bg-gradient-to-br from-white to-red-500/5 transition-all duration-200 hover:border-red-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-red-700">Avg Attrition</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Average attrition percentage
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : `${dashboardStats.avgAttritionPercentageThisMonth}%`}
              </div>
              <div className="text-xs text-red-600/90 flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                <span>This Month</span>
              </div>
            </CardContent>
          </Card>

          {/* Avg Non-Vendor */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-cyan-500/10 bg-gradient-to-br from-white to-cyan-500/5 transition-all duration-200 hover:border-cyan-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-cyan-700">Avg Non-Vendor</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Average non-vendor percentage
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : `${dashboardStats.avgNonVendorPercentageThisMonth}%`}
              </div>
              <div className="text-xs text-cyan-600/90 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>This Month</span>
              </div>
            </CardContent>
          </Card>

          {/* Total CWT Cases */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-orange-500/10 bg-gradient-to-br from-white to-orange-500/5 transition-all duration-200 hover:border-orange-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-orange-700">Total CWT Cases</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Total CWT cases this month
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">
                {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : dashboardStats.totalCWTCasesThisMonth}
              </div>
              <div className="text-xs text-orange-600/90 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>This Month</span>
              </div>
            </CardContent>
          </Card>

          {/* Total VHRs */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-indigo-500/10 bg-gradient-to-br from-white to-indigo-500/5 transition-all duration-200 hover:border-indigo-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-indigo-700">Total VHRs</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Monitored VHRs
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.vhrCount}</div>
              <div className="text-xs text-indigo-600/90 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>VHRs</span>
              </div>
            </CardContent>
          </Card>

          {/* Total ZHRs */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-emerald-500/10 bg-gradient-to-br from-white to-emerald-500/5 transition-all duration-200 hover:border-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700">Total ZHRs</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                In {selectedHierarchyDetailsText.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.zhrCount}</div>
              <div className="text-xs text-emerald-600/90 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>ZHRs</span>
              </div>
            </CardContent>
          </Card>

          {/* Total BHRs */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-sky-500/10 bg-gradient-to-br from-white to-sky-500/5 transition-all duration-200 hover:border-sky-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-sky-700">Total BHRs</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                In {selectedHierarchyDetailsText.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.bhrCount}</div>
              <div className="text-xs text-sky-600/90 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span>BHRs</span>
              </div>
            </CardContent>
          </Card>

          {/* Branch Coverage */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-amber-500/10 bg-gradient-to-br from-white to-amber-500/5 transition-all duration-200 hover:border-amber-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-amber-700">Branch Coverage</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Overall branch visit coverage
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.branchCoveragePercentage}%</div>
              <div className="text-xs text-amber-600/90 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span>Coverage</span>
              </div>
            </CardContent>
          </Card>

          {/* Submitted Visits */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-emerald-500/10 bg-gradient-to-br from-white to-emerald-500/5 transition-all duration-200 hover:border-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700">Submitted Visits</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Total submitted visits in {selectedHierarchyDetailsText.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.totalSubmittedVisits}</div>
              <div className="text-xs text-emerald-600/90 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Total</span>
              </div>
            </CardContent>
          </Card>

          {/* Avg Visits / Branch */}
          <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-blue-500/10 bg-gradient-to-br from-white to-blue-500/5 transition-all duration-200 hover:border-blue-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-blue-700">Avg Visits / Branch</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Avg visits per unique branch with activity in {selectedHierarchyDetailsText.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
              <div className="text-3xl font-bold text-slate-800 mb-1">{dashboardStats.avgSubmittedVisitsPerBranch}</div>
              <div className="text-xs text-blue-600/90 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Average</span>
              </div>
            </CardContent>
          </Card>

          {/* View Deep Analytics */}
          <Link href="/chr/analytics" className="w-full">
            <Card className="h-full w-full min-h-[180px] relative overflow-hidden border border-orange-500/10 bg-gradient-to-br from-white to-orange-500/5 transition-all duration-200 hover:border-orange-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm font-semibold text-orange-700">View Deep Analytics</CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Dive deeper into trends and insights
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-3 px-4 flex-grow flex flex-col justify-end">
                <div className="flex items-center justify-center gap-2">
                  <BarChartBig className="h-7 w-7 text-orange-600" />
                  <span className="text-orange-600/90">Explore Analytics</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      

      <div className="grid grid-cols-1 gap-6">
        {visitsByEntityChartData.length > 0 ? (
          <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]">
                <BarChartBig className="h-5 w-5" />Submitted Visits by VHR
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground/90">
                Total submitted visits, reflecting current VHR filters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-[350px] p-4">
                <Bar
                  data={{
                    labels: visitsByEntityChartData.map(item => item.name),
                    datasets: [
                      {
                        label: 'Visits',
                        data: visitsByEntityChartData.map(item => item.value),
                        backgroundColor: [
                          '#0E2B72', // Royal Blue
                          '#386FA4', // Sapphire
                          '#5D4E6D', // Deep Purple
                          '#FFD700', // Gold
                          '#10B981', // Emerald
                          '#C62828', // Ruby
                          '#7E6B8F', // Amethyst
                          '#4A5859', // Slate
                        ],
                        borderRadius: 6,
                        borderSkipped: false,
                        maxBarThickness: 65
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                      duration: 800,
                      easing: 'easeOutQuart'
                    },
                    layout: {
                      padding: {
                        top: 30,
                        right: 20,
                        bottom: 10,
                        left: 20
                      }
                    },
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        backgroundColor: '#0E2B72',
                        titleColor: '#FFFFFF',
                        bodyColor: '#FFFFFF',
                        borderColor: '#FFFFFF',
                        borderWidth: 0,
                        padding: 12,
                        cornerRadius: 4,
                        boxPadding: 6,
                        titleFont: {
                          size: 13,
                          weight: 'bold'
                        },
                        bodyFont: {
                          size: 12
                        },
                        displayColors: false,
                        callbacks: {
                          label: (context) => `${Math.round(context.parsed.y)} visits`,
                          title: (items) => items[0].label
                        }
                      }
                    },
                    scales: {
                      x: {
                        grid: {
                          display: false
                        },
                        border: {
                          display: false
                        },
                        ticks: {
                          color: '#666666',
                          font: {
                            size: 12,
                            weight: 'normal'
                          },
                          padding: 8
                        }
                      },
                      y: {
                        border: {
                          display: false
                        },
                        grid: {
                          color: '#E5E5E5',
                          drawTicks: false,
                          lineWidth: 1
                        },
                        ticks: {
                          color: '#666666',
                          font: {
                            size: 12,
                            weight: 'normal'
                          },
                          padding: 12,
                          stepSize: 1,
                          callback: function (value) { return typeof value === 'number' ? Math.round(value).toString() : value }
                        },
                        beginAtZero: true
                      }
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
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

