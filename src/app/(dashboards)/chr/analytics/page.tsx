
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, RadarChart } from 'recharts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, ShieldQuestion, Target, PieChart as PieChartIcon, BarChartBig, Filter as FilterIcon, ChevronsUpDown, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  format,
  parseISO,
  subDays,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  isWithinInterval,
  eachDayOfInterval,
  isValid,
} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { useChrFilter } from '@/contexts/chr-filter-context';

interface MetricConfig {
  key: keyof Visit;
  label: string;
  color: string;
  yAxisId?: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'manning_percentage', label: 'Manning %', color: 'hsl(var(--chart-1))', yAxisId: 'left' },
  { key: 'attrition_percentage', label: 'Attrition %', color: 'hsl(var(--chart-2))', yAxisId: 'left' },
  { key: 'non_vendor_percentage', label: 'Non-Vendor %', color: 'hsl(var(--chart-3))', yAxisId: 'left' },
  { key: 'er_percentage', label: 'ER %', color: 'hsl(var(--chart-4))', yAxisId: 'left' },
  { key: 'cwt_cases', label: 'CWT Cases', color: 'hsl(var(--chart-5))', yAxisId: 'right' },
];

type TimeframeKey = 'past_week' | 'past_month' | 'last_3_months' | 'last_6_months' | 'last_year' | 'last_3_years';

interface TimeframeOption {
  key: TimeframeKey;
  label: string;
}

const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { key: 'past_week', label: 'Past Week' },
  { key: 'past_month', label: 'Past Month' },
  { key: 'last_3_months', label: 'Last 3 Months' },
  { key: 'last_6_months', label: 'Last 6 Months' },
  { key: 'last_year', label: 'Last Year' },
  { key: 'last_3_years', label: 'Last 3 Years' },
];

type TrendChartDataPoint = { date: string; [key: string]: any; };
interface QualitativeQuestionConfig { key: keyof Visit; label: string; positiveIsYes: boolean; }

const QUALITATIVE_QUESTIONS_CONFIG: QualitativeQuestionConfig[] = [
    { key: 'qual_aligned_conduct', label: 'Leaders Aligned with Code', positiveIsYes: true },
    { key: 'qual_safe_secure', label: 'Employees Feel Safe', positiveIsYes: true },
    { key: 'qual_motivated', label: 'Employees Feel Motivated', positiveIsYes: true },
    { key: 'qual_abusive_language', label: 'Leaders Use Abusive Language', positiveIsYes: false },
    { key: 'qual_comfortable_escalate', label: 'Comfortable with Escalation', positiveIsYes: true },
    { key: 'qual_inclusive_culture', label: 'Inclusive Culture', positiveIsYes: true },
];

interface TimeframeButtonsProps {
  selectedTimeframe: TimeframeKey;
  onTimeframeChange: (timeframe: TimeframeKey) => void;
}

const TimeframeButtons: React.FC<TimeframeButtonsProps> = ({ selectedTimeframe, onTimeframeChange }) => (
  <div className="flex flex-wrap gap-2">
    {TIMEFRAME_OPTIONS.map(tf => (
      <Button key={tf.key} variant={selectedTimeframe === tf.key ? 'default' : 'outline'} size="sm" onClick={() => onTimeframeChange(tf.key)}>
        {tf.label}
      </Button>
    ))}
  </div>
);

interface FilterOption { value: string; label: string; }

export default function CHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedVhrIds: globalSelectedVhrIds, vhrOptions: globalVhrOptions } = useChrFilter();

  const [isLoading, setIsLoading] = useState(true);
  
  const [allSubmittedVisitsGlobal, setAllSubmittedVisitsGlobal] = useState<Visit[]>([]);
  const [allUsersGlobal, setAllUsersGlobal] = useState<User[]>([]);
  const [allBranchesGlobal, setAllBranchesGlobal] = useState<Branch[]>([]);

  const [selectedZhrIds, setSelectedZhrIds] = useState<string[]>([]);
  const [zhrOptions, setZhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingZhrOptions, setIsLoadingZhrOptions] = useState(false);

  const [selectedBhrIds, setSelectedBhrIds] = useState<string[]>([]);
  const [bhrOptions, setBhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingBhrOptions, setIsLoadingBhrOptions] = useState(false);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<FilterOption[]>([]);
  const [isLoadingBranchOptions, setIsLoadingBranchOptions] = useState(false);


  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
    METRIC_CONFIGS.reduce((acc, metric) => ({ ...acc, [metric.key]: metric.key === 'manning_percentage' }), {})
  );
  
  const [globalTimeframe, setGlobalTimeframe] = useState<TimeframeKey>('past_month');


  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { data: usersData, error: usersError } = await supabase.from('users').select('id, name, role, reports_to');
          if (usersError) throw usersError;
          setAllUsersGlobal(usersData || []);

          const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name, category, location');
          if (branchesError) throw branchesError;
          setAllBranchesGlobal(branchesData || []);
          setBranchOptions((branchesData || []).map(b => ({ value: b.id, label: b.name }))); 
          setIsLoadingBranchOptions(false);


          const { data: visitsData, error: visitsError } = await supabase
            .from('visits')
            .select('bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases, qual_aligned_conduct, qual_safe_secure, qual_motivated, qual_abusive_language, qual_comfortable_escalate, qual_inclusive_culture')
            .eq('status', 'submitted');
          if (visitsError) throw visitsError;
          setAllSubmittedVisitsGlobal(visitsData || []);

        } catch (error: any) {
          console.error("CHR Analytics: Error fetching global data:", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    setIsLoadingZhrOptions(true);
    if (allUsersGlobal.length > 0) {
      let potentialZhrs = allUsersGlobal.filter(u => u.role === 'ZHR');
      if (globalSelectedVhrIds.length > 0) {
        potentialZhrs = potentialZhrs.filter(zhr => zhr.reports_to && globalSelectedVhrIds.includes(zhr.reports_to));
      }
      setZhrOptions(potentialZhrs.map(z => ({ value: z.id, label: z.name })));
    } else {
      setZhrOptions([]);
    }
    setSelectedZhrIds([]); 
    setIsLoadingZhrOptions(false);
  }, [globalSelectedVhrIds, allUsersGlobal]);

  useEffect(() => {
    setIsLoadingBhrOptions(true);
    if (allUsersGlobal.length > 0) {
      let potentialBhrs = allUsersGlobal.filter(u => u.role === 'BHR');
      if (selectedZhrIds.length > 0) {
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
      } else if (globalSelectedVhrIds.length > 0) {
        const zhrsUnderSelectedVhrs = allUsersGlobal
          .filter(u => u.role === 'ZHR' && u.reports_to && globalSelectedVhrIds.includes(u.reports_to))
          .map(z => z.id);
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && zhrsUnderSelectedVhrs.includes(bhr.reports_to));
      }
      setBhrOptions(potentialBhrs.map(b => ({ value: b.id, label: b.name })));
    } else {
      setBhrOptions([]);
    }
    setSelectedBhrIds([]); 
    setIsLoadingBhrOptions(false);
  }, [selectedZhrIds, globalSelectedVhrIds, allUsersGlobal]);
  
  useEffect(() => {
    setSelectedBranchIds([]);
  }, [selectedBhrIds, selectedZhrIds, globalSelectedVhrIds]);


  const filteredVisitsData = useMemo(() => {
    let visits = allSubmittedVisitsGlobal;
    
    let relevantBhrIds = new Set<string>();

    if (selectedBhrIds.length > 0) {
        selectedBhrIds.forEach(id => relevantBhrIds.add(id));
    } else if (selectedZhrIds.length > 0) {
        allUsersGlobal
            .filter(u => u.role === 'BHR' && u.reports_to && selectedZhrIds.includes(u.reports_to))
            .forEach(b => relevantBhrIds.add(b.id));
    } else if (globalSelectedVhrIds.length > 0) {
        const zhrsInSelectedVhrs = allUsersGlobal
            .filter(u => u.role === 'ZHR' && u.reports_to && globalSelectedVhrIds.includes(u.reports_to))
            .map(z => z.id);
        allUsersGlobal
            .filter(u => u.role === 'BHR' && u.reports_to && zhrsInSelectedVhrs.includes(u.reports_to))
            .forEach(b => relevantBhrIds.add(b.id));
    } else {
        allUsersGlobal.filter(u => u.role === 'BHR').forEach(b => relevantBhrIds.add(b.id));
    }
    
    if (relevantBhrIds.size > 0 || selectedBhrIds.length > 0 || selectedZhrIds.length > 0 || globalSelectedVhrIds.length > 0) {
      if (relevantBhrIds.size === 0 && (selectedBhrIds.length > 0 || selectedZhrIds.length > 0 || globalSelectedVhrIds.length > 0)) {
        visits = [];
      } else if (relevantBhrIds.size > 0) {
        visits = visits.filter(visit => relevantBhrIds.has(visit.bhr_id));
      }
    }

    if (selectedBranchIds.length > 0) {
      visits = visits.filter(visit => selectedBranchIds.includes(visit.branch_id));
    }

    return visits;
  }, [allSubmittedVisitsGlobal, allUsersGlobal, globalSelectedVhrIds, selectedZhrIds, selectedBhrIds, selectedBranchIds]);


  const filterVisitsByTimeframe = (visits: Visit[], timeframe: TimeframeKey): Visit[] => {
    const now = new Date();
    let startDateFilter: Date;
    const endDateFilter: Date = endOfDay(now);

    switch (timeframe) {
      case 'past_week': startDateFilter = startOfDay(subDays(now, 6)); break;
      case 'past_month': startDateFilter = startOfDay(subMonths(now, 1)); break;
      case 'last_3_months': startDateFilter = startOfDay(subMonths(now, 3)); break;
      case 'last_6_months': startDateFilter = startOfDay(subMonths(now, 6)); break;
      case 'last_year': startDateFilter = startOfDay(subYears(now, 1)); break;
      case 'last_3_years': startDateFilter = startOfDay(subYears(now, 3)); break;
      default: startDateFilter = startOfDay(subMonths(now, 1)); 
    }
    if (!isValid(startDateFilter) || !isValid(endDateFilter) || startDateFilter > endDateFilter) return [];
    
    return visits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      return isValid(visitDate) && isWithinInterval(visitDate, { start: startDateFilter, end: endDateFilter });
    });
  };

  const metricTrendChartData = useMemo(() => {
    const filteredByAllSelections = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (filteredByAllSelections.length === 0) return [];
    const aggregatedData: Record<string, { [key: string]: { sum: number; count: number } }> = {};
    let minDate = new Date();
    let maxDate = new Date(1970,0,1);

    filteredByAllSelections.forEach(visit => {
      const visitDateObj = parseISO(visit.visit_date);
      if(isValid(visitDateObj)) {
        if(visitDateObj < minDate) minDate = visitDateObj;
        if(visitDateObj > maxDate) maxDate = visitDateObj;

        const day = format(visitDateObj, 'yyyy-MM-dd');
        if (!aggregatedData[day]) {
          aggregatedData[day] = {};
          METRIC_CONFIGS.forEach(m => { aggregatedData[day][m.key] = { sum: 0, count: 0 }; });
        }
        METRIC_CONFIGS.forEach(m => {
          const value = visit[m.key] as number | undefined;
          if (typeof value === 'number' && !isNaN(value)) {
            aggregatedData[day][m.key].sum += value;
            aggregatedData[day][m.key].count += 1;
          }
        });
      }
    });
    if (filteredByAllSelections.length === 0 || !isValid(minDate) || !isValid(maxDate) || minDate > maxDate ) return [];
    let dateRangeForChart: Date[] = [];
    try {
       dateRangeForChart = eachDayOfInterval({ start: startOfDay(minDate), end: endOfDay(maxDate) });
    } catch (e) { return []; }

    return dateRangeForChart.map(dayDate => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const dayData = aggregatedData[dayKey];
      const point: TrendChartDataPoint = { date: dayKey };
      METRIC_CONFIGS.forEach(m => {
        if (dayData && dayData[m.key] && dayData[m.key].count > 0) {
          point[m.key] = parseFloat((dayData[m.key].sum / dayData[m.key].count).toFixed(2));
          if (m.key === 'cwt_cases') point[m.key] = dayData[m.key].sum;
        }
      });
      return point;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredVisitsData, globalTimeframe]);

  const qualitativeSpiderChartData = useMemo(() => {
    const filteredByAllSelections = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (filteredByAllSelections.length === 0) return QUALITATIVE_QUESTIONS_CONFIG.map(q => ({ subject: q.label, score: 0, fullMark: 5 }));
    const scores: Record<string, { totalScore: number; count: number }> = {};
    QUALITATIVE_QUESTIONS_CONFIG.forEach(q => { scores[q.key] = { totalScore: 0, count: 0 }; });
    filteredByAllSelections.forEach(visit => {
        QUALITATIVE_QUESTIONS_CONFIG.forEach(qConfig => {
            const value = visit[qConfig.key] as 'yes' | 'no' | undefined;
            if (value === 'yes' || value === 'no') {
                const scoreValue = value === 'yes' ? (qConfig.positiveIsYes ? 5 : 0) : (qConfig.positiveIsYes ? 0 : 5);
                scores[qConfig.key].totalScore += scoreValue;
                scores[qConfig.key].count += 1;
            }
        });
    });
    return QUALITATIVE_QUESTIONS_CONFIG.map(qConfig => {
        const aggregate = scores[qConfig.key];
        return { subject: qConfig.label, score: aggregate.count > 0 ? parseFloat((aggregate.totalScore / aggregate.count).toFixed(2)) : 0, fullMark: 5 };
    });
  }, [filteredVisitsData, globalTimeframe]);

  const branchCategoryPieChartData = useMemo(() => {
    const filteredByAllSelections = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (filteredByAllSelections.length === 0 || allBranchesGlobal.length === 0) return [];
    const categoryCounts: Record<string, number> = {};
    const branchCategoryMap = new Map(allBranchesGlobal.map(b => [b.id, b.category]));
    filteredByAllSelections.forEach(visit => {
        const category = branchCategoryMap.get(visit.branch_id);
        if (category) { categoryCounts[category] = (categoryCounts[category] || 0) + 1; }
    });
    return Object.entries(categoryCounts).map(([name, value], index) => ({ name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))` })).sort((a, b) => b.value - a.value);
  }, [filteredVisitsData, globalTimeframe, allBranchesGlobal]);

  const topPerformingBranchesChartData = useMemo(() => {
    const filteredByAllSelections = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (filteredByAllSelections.length === 0 || allBranchesGlobal.length === 0) return [];
    const visitsPerBranch: Record<string, number> = {};
    const branchNameMap = new Map(allBranchesGlobal.map(b => [b.id, b.name]));
    filteredByAllSelections.forEach(visit => {
      const branchName = branchNameMap.get(visit.branch_id) || 'Unknown Branch';
      visitsPerBranch[branchName] = (visitsPerBranch[branchName] || 0) + 1;
    });
    return Object.entries(visitsPerBranch)
      .map(([name, value], index) => ({ name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredVisitsData, globalTimeframe, allBranchesGlobal]);
  
  const handleMetricToggle = (metricKey: string) => {
    setActiveMetrics(prev => ({ ...prev, [metricKey]: !prev[metricKey] }));
  };

  const getMultiSelectButtonText = (
    options: FilterOption[], 
    selectedIds: string[], 
    defaultText: string, 
    singularName: string,
    pluralName: string,
    isLoadingOptions: boolean
  ) => {
    if (isLoadingOptions) return `Loading ${pluralName}...`;
    if (selectedIds.length === 0) return defaultText;
    if (selectedIds.length === 1) {
      const selectedOption = options.find(opt => opt.value === selectedIds[0]);
      return selectedOption ? selectedOption.label : `1 ${singularName} Selected`;
    }
    return `${selectedIds.length} ${pluralName} Selected`;
  };

  const handleMultiSelectChange = (
    id: string, 
    currentSelectedIds: string[], 
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const newSelectedIds = currentSelectedIds.includes(id)
      ? currentSelectedIds.filter(selectedId => selectedId !== id)
      : [...currentSelectedIds, id];
    setter(newSelectedIds);
  };

  const handleClearAllLocalFilters = () => {
    setSelectedZhrIds([]);
    setSelectedBhrIds([]);
    setSelectedBranchIds([]);
    setGlobalTimeframe('past_month');
  };
  
  const pageTitleText = useMemo(() => {
    let title = "CHR Analytics";
    if (globalSelectedVhrIds.length > 0) {
      if (globalSelectedVhrIds.length === 1) {
        const vhrName = globalVhrOptions.find(v => v.value === globalSelectedVhrIds[0])?.label || "Selected VHR";
        title += ` (${vhrName})`;
      } else {
        title += ` (${globalSelectedVhrIds.length} VHRs)`;
      }
    } else {
      title += " (Global)";
    }
    return title;
  }, [globalSelectedVhrIds, globalVhrOptions]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  if (!user || user.role !== 'CHR') {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }

  const showBranchSpecificCharts = selectedBranchIds.length === 0;

  return (
    <div className="space-y-8">
      <PageTitle title={pageTitleText} description={`Analyze key metrics, qualitative assessments, and visit distributions based on current filters.`} />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FilterIcon className="h-5 w-5 text-primary"/>Additional Filters</CardTitle>
          <CardDescription>Refine analytics by ZHR, BHR, specific Branches, and Timeframe. These filters are applied in conjunction with the global VHR filter in the header.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ZHR Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(zhrOptions, selectedZhrIds, "All ZHRs", "ZHR", "ZHRs", isLoadingZhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by ZHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingZhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                  zhrOptions.length > 0 ? zhrOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedZhrIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedZhrIds, setSelectedZhrIds)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No ZHRs match current VHR filter.</DropdownMenuLabel>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedZhrIds([])} disabled={selectedZhrIds.length === 0}>Show All ZHRs</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedZhrIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10"
                    onClick={(e) => { e.stopPropagation(); setSelectedZhrIds([]); }}
                    aria-label="Clear ZHR filter"
                  >
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>

            {/* BHR Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(bhrOptions, selectedBhrIds, "All BHRs", "BHR", "BHRs", isLoadingBhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by BHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                  bhrOptions.length > 0 ? bhrOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBhrIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedBhrIds, setSelectedBhrIds)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No BHRs match current ZHR/VHR filter.</DropdownMenuLabel>}
                   <DropdownMenuSeparator />
                   <DropdownMenuItem onSelect={() => setSelectedBhrIds([])} disabled={selectedBhrIds.length === 0}>Show All BHRs</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedBhrIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10"
                    onClick={(e) => { e.stopPropagation(); setSelectedBhrIds([]); }}
                    aria-label="Clear BHR filter"
                  >
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
            
            {/* Branch Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(branchOptions, selectedBranchIds, "All Branches", "Branch", "Branches", isLoadingBranchOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by Branch</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBranchOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> : 
                  branchOptions.length > 0 ? branchOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBranchIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedBranchIds, setSelectedBranchIds)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No branches available.</DropdownMenuLabel>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedBranchIds([])} disabled={selectedBranchIds.length === 0}>Show All Branches</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedBranchIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10"
                    onClick={(e) => { e.stopPropagation(); setSelectedBranchIds([]); }}
                    aria-label="Clear Branch filter"
                  >
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Timeframe</Label>
            <TimeframeButtons selectedTimeframe={globalTimeframe} onTimeframeChange={setGlobalTimeframe} />
          </div>
          <Button variant="outline" onClick={handleClearAllLocalFilters} className="w-full md:w-auto">
            <XCircle className="mr-2 h-4 w-4" /> Clear All Local Filters & Timeframe
          </Button>
        </CardContent>
      </Card>


      <Card className="shadow-xl">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Metric Trends</CardTitle>
            <CardDescription>Trendlines for selected metrics from submitted visits, reflecting all active filters and the global timeframe.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TimeframeButtons removed from here */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
            {METRIC_CONFIGS.map(metric => (
              <div key={metric.key} className="flex items-center space-x-2">
                <Checkbox id={`metric-chr-${metric.key}`} checked={!!activeMetrics[metric.key]} onCheckedChange={() => handleMetricToggle(metric.key)} style={{ accentColor: metric.color } as React.CSSProperties}/>
                <Label htmlFor={`metric-chr-${metric.key}`} className="text-sm font-medium" style={{ color: metric.color }}>{metric.label}</Label>
              </div>
            ))}
          </div>
          {metricTrendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={metricTrendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={(tick) => format(parseISO(tick), 'MMM d')} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }}/>
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" orientation="left" tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis yAxisId="right" stroke="hsl(var(--muted-foreground))" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)'}} labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }} formatter={(value: number, name) => METRIC_CONFIGS.find(m=>m.label===name)?.key.includes('percentage') ? [`${value}%`, name] : [value, name]}/>
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {METRIC_CONFIGS.map(metric => activeMetrics[metric.key] && (
                    <Line key={metric.key} type="monotone" dataKey={metric.key.toString()} name={metric.label} stroke={metric.color} strokeWidth={2} yAxisId={metric.yAxisId || 'left'} dot={{ r: 2, fill: metric.color }} activeDot={{ r: 5 }} connectNulls/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : ( <div className="flex flex-col items-center justify-center h-96 text-center p-4"><TrendingUp className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No metric data for current filter combination.</p></div> )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>Qualitative Assessment</CardTitle>
            <CardDescription>Average scores for qualitative questions from submitted visits (0-5 scale), reflecting all active filters and the global timeframe.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* TimeframeButtons removed from here */}
            {qualitativeSpiderChartData.length > 0 && qualitativeSpiderChartData.some(d => d.score > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={qualitativeSpiderChartData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <Radar name="Avg Score" dataKey="score" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)'}}/>
                </RadarChart>
              </ResponsiveContainer>
            ) : ( <div className="flex flex-col items-center justify-center h-80 text-center p-4"><ShieldQuestion className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No qualitative data for current filter combination.</p></div>)}
          </CardContent>
        </Card>

        {showBranchSpecificCharts && (
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary"/>Branch Category Visits</CardTitle>
                    <CardDescription>Distribution of submitted visits by branch category, reflecting current filters and global timeframe (hidden if specific branches are selected).</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* TimeframeButtons removed from here */}
                    {branchCategoryPieChartData.length > 0 ? (
                        <PlaceholderPieChart data={branchCategoryPieChartData} title="" dataKey="value" nameKey="name"/>
                    ) : ( <div className="flex flex-col items-center justify-center h-80 text-center p-4"><PieChartIcon className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No category data for current filter combination.</p></div>)}
                </CardContent>
            </Card>
        )}
      </div>

      {showBranchSpecificCharts && (
           <div className="grid grid-cols-1 gap-8">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChartBig className="h-5 w-5 text-primary"/>Top Branches by Visits</CardTitle>
                <CardDescription>Branches with the most submitted HR visits, reflecting current filters and global timeframe (hidden if specific branches are selected).</CardDescription>
              </CardHeader>
              <CardContent>
                {/* TimeframeButtons removed from here */}
                {topPerformingBranchesChartData.length > 0 ? (
                    <PlaceholderBarChart data={topPerformingBranchesChartData} title="" xAxisKey="name" dataKey="value" />
                ) : ( <div className="flex flex-col items-center justify-center h-80 text-center p-4"><BarChartBig className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No branch visit data for current filter combination.</p></div>)}
              </CardContent>
            </Card>
          </div>
      )}
       {!showBranchSpecificCharts && (
        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle>Branch Specific Charts Hidden</CardTitle>
                <CardDescription>The "Top Branches by Visits" and "Branch Category Visits" charts are hidden when specific branches are selected in the filter above. Clear the branch filter to see these charts.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-40">
                <BarChartBig className="w-12 h-12 text-muted-foreground opacity-50 mr-2"/>
                <PieChartIcon className="w-12 h-12 text-muted-foreground opacity-50"/>
            </CardContent>
        </Card>
       )}
    </div>
  );
}

