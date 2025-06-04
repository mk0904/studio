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
import type { ChartData } from "@/types";
import { cn } from '@/lib/utils';


interface MetricConfig {
  key: keyof Visit;
  label: string;
  color: string;
  yAxisId?: string;
  strokeDasharray?: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'manning_percentage', label: 'Manning %', color: 'hsl(var(--chart-1))', yAxisId: 'left', strokeDasharray: "1 0" },
  { key: 'attrition_percentage', label: 'Attrition %', color: 'hsl(var(--chart-2))', yAxisId: 'left', strokeDasharray: "5 5" },
  { key: 'non_vendor_percentage', label: 'Non-Vendor %', color: 'hsl(var(--chart-3))', yAxisId: 'left', strokeDasharray: "2 4" },
  { key: 'er_percentage', label: 'ER %', color: 'hsl(var(--chart-4))', yAxisId: 'left', strokeDasharray: "10 2 2 2" },
  { key: 'cwt_cases', label: 'CWT Cases', color: 'hsl(var(--chart-5))', yAxisId: 'right', strokeDasharray: "8 3 2 3" },
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
      <Button 
        key={tf.key} 
        variant={selectedTimeframe === tf.key ? 'default' : 'outline'} 
        size="sm" 
        onClick={() => onTimeframeChange(tf.key)}
        className={cn(
          "h-9 text-xs sm:text-sm font-medium transition-all duration-200 rounded-md",
          selectedTimeframe === tf.key 
              ? "bg-[#004C8F] hover:bg-[#004C8F]/90 text-white shadow-md" 
              : "border-slate-300 hover:bg-slate-50 hover:border-slate-400"
        )}
      >
        {tf.label}
      </Button>
    ))}
  </div>
);

interface FilterOption { value: string; label: string; }

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

export default function ZHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [allZoneVisits, setAllZoneVisits] = useState<Visit[]>([]);
  
  const [bhrOptions, setBhrOptions] = useState<FilterOption[]>([]);
  const [selectedBhrIds, setSelectedBhrIds] = useState<string[]>([]);
  const [isLoadingBhrOptions, setIsLoadingBhrOptions] = useState(false);

  const [branchOptions, setBranchOptions] = useState<FilterOption[]>([]);
  const [allBranchesForCategoryLookup, setAllBranchesForCategoryLookup] = useState<Branch[]>([]); 
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [isLoadingBranchOptions, setIsLoadingBranchOptions] = useState(false);
  
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
    METRIC_CONFIGS.reduce((acc, metric) => ({ ...acc, [metric.key]: metric.key === 'manning_percentage' }), {})
  );
  
  const [globalTimeframe, setGlobalTimeframe] = useState<TimeframeKey>('past_month');


  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const fetchData = async () => {
        setIsLoading(true);
        setIsLoadingBhrOptions(true);
        setIsLoadingBranchOptions(true);
        try {
          const { data: bhrUsersData, error: bhrError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'BHR')
            .eq('reports_to', user.id);

          if (bhrError) throw bhrError;
          setBhrOptions((bhrUsersData || []).map(b => ({ value: b.id, label: b.name })));
          setIsLoadingBhrOptions(false);

          const bhrIds = (bhrUsersData || []).map(bhr => bhr.id);

          if (bhrIds.length === 0) {
            setAllZoneVisits([]);
          } else {
            const { data: visitsData, error: visitsError } = await supabase
              .from('visits')
              .select('bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases, qual_aligned_conduct, qual_safe_secure, qual_motivated, qual_abusive_language, qual_comfortable_escalate, qual_inclusive_culture')
              .in('bhr_id', bhrIds)
              .eq('status', 'submitted');
            if (visitsError) throw visitsError;
            setAllZoneVisits(visitsData || []);
          }

          const { data: branchesData, error: branchesError } = await supabase
            .from('branches')
            .select('id, name, category, code'); 
          if (branchesError) throw branchesError;
          setAllBranchesForCategoryLookup(branchesData || []); 
          setBranchOptions((branchesData || []).map(b => ({ value: b.id, label: `${b.name} (${b.code})` })));
          setIsLoadingBranchOptions(false);

        } catch (error: any) {
          console.error("ZHR Analytics: Error fetching data:", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
          setAllZoneVisits([]);
          setBhrOptions([]);
          setBranchOptions([]);
          setAllBranchesForCategoryLookup([]);
          setIsLoadingBhrOptions(false);
          setIsLoadingBranchOptions(false);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsLoading(false);
      setIsLoadingBhrOptions(false);
      setIsLoadingBranchOptions(false);
    }
  }, [user, toast]);

  const filteredVisitsData = useMemo(() => {
    let visits = allZoneVisits;
    if (selectedBhrIds.length > 0) {
      visits = visits.filter(visit => selectedBhrIds.includes(visit.bhr_id));
    }
    if (selectedBranchIds.length > 0) {
      visits = visits.filter(visit => selectedBranchIds.includes(visit.branch_id));
    }
    return visits;
  }, [allZoneVisits, selectedBhrIds, selectedBranchIds]);


  const metricTrendChartData = useMemo(() => {
    const visitsForChart = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsForChart.length === 0) return [];
    const aggregatedData: Record<string, { [key: string]: { sum: number; count: number } }> = {};
    let minDate = new Date();
    let maxDate = new Date(1970,0,1);

    visitsForChart.forEach(visit => {
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
    if (visitsForChart.length === 0 || !isValid(minDate) || !isValid(maxDate) || minDate > maxDate ) return [];
    
    let dateRangeForChart: Date[] = [];
    try {
       dateRangeForChart = eachDayOfInterval({ start: startOfDay(minDate), end: endOfDay(maxDate) });
    } catch (e) { return []; }
    if (dateRangeForChart.length === 0) return [];


    return dateRangeForChart.map(dayDate => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const dayData = aggregatedData[dayKey];
      const point: TrendChartDataPoint = { date: dayKey };
      METRIC_CONFIGS.forEach(m => {
        if (dayData && dayData[m.key] && dayData[m.key].count > 0) {
          point[m.key] = parseFloat((dayData[m.key].sum / dayData[m.key].count).toFixed(2));
          if (m.key === 'cwt_cases') {
            point[m.key] = dayData[m.key].sum;
          }
        } else {
          point[m.key] = null; 
        }
      });
      return point;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredVisitsData, globalTimeframe]);

  const qualitativeSpiderChartData = useMemo(() => {
    const visitsForChart = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsForChart.length === 0) return QUALITATIVE_QUESTIONS_CONFIG.map(q => ({ subject: q.label, score: 0, fullMark: 5 }));
    const scores: Record<string, { totalScore: number; count: number }> = {};
    QUALITATIVE_QUESTIONS_CONFIG.forEach(q => { scores[q.key] = { totalScore: 0, count: 0 }; });
    visitsForChart.forEach(visit => {
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
    const visitsForChart = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsForChart.length === 0 || allBranchesForCategoryLookup.length === 0) return [];
    
    const categoryCounts: Record<string, number> = {};
    const branchCategoryMap = new Map(allBranchesForCategoryLookup.map(b => [b.id, b.category]));

    visitsForChart.forEach(visit => {
        const category = branchCategoryMap.get(visit.branch_id);
        if (category) { 
          categoryCounts[category] = (categoryCounts[category] || 0) + 1; 
        }
    });
    
    return Object.entries(categoryCounts)
                 .map(([name, value], index) => ({ name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))` }))
                 .sort((a, b) => b.value - a.value);
  }, [filteredVisitsData, globalTimeframe, allBranchesForCategoryLookup]);

  const handleMetricToggle = (metricKey: string) => {
    setActiveMetrics(prev => ({ ...prev, [metricKey]: !prev[metricKey] }));
  };

  const getMultiSelectButtonText = (
    options: FilterOption[], 
    selectedIds: string[], 
    defaultText: string, 
    singularName: string,
    pluralName: string,
    isLoadingOptionsFlag: boolean 
  ) => {
    if (isLoadingOptionsFlag) return `Loading ${pluralName}...`;
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
    setSelectedBhrIds([]);
    setSelectedBranchIds([]);
    setGlobalTimeframe('past_month'); 
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'ZHR') {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }

  return (
    <div className="sflex min-h-full w-full flex-col items-center bg-gradient-to-b from-slate-50 to-white">
      <PageTitle title="Zonal Performance Trends" description="Analyze key metrics and qualitative assessments from submitted visits in your zone over time." />
      
      <Card className="shadow-xl border-slate-200/50 hover:shadow-2xl transition-shadow duration-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><FilterIcon className="h-5 w-5"/>Filters</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/90">Refine analytics by BHR, Branch, and Timeframe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-3 h-10 border-gray-200 bg-white hover:border-gray-300 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.2)] text-gray-700">
                    {getMultiSelectButtonText(bhrOptions, selectedBhrIds, "All BHRs", "BHR", "BHRs", isLoadingBhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by BHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBhrOptions ? <DropdownMenuItem disabled>Loading...</DropdownMenuItem> :
                  bhrOptions.length > 0 ? bhrOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBhrIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedBhrIds, setSelectedBhrIds)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuItem disabled>No BHRs report to you.</DropdownMenuItem>}
                   <DropdownMenuSeparator />
                   <DropdownMenuItem onSelect={() => setSelectedBhrIds([])} disabled={selectedBhrIds.length === 0}>Show All BHRs</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedBhrIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBhrIds([]); }} aria-label="Clear BHR filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
            
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-3 h-10 border-gray-200 bg-white hover:border-gray-300 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.2)] text-gray-700">
                    {getMultiSelectButtonText(branchOptions, selectedBranchIds, "All Branches", "Branch", "Branches", isLoadingBranchOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by Branch</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBranchOptions ? <DropdownMenuItem disabled>Loading...</DropdownMenuItem> : 
                  branchOptions.length > 0 ? branchOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBranchIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedBranchIds, setSelectedBranchIds)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuItem disabled>No branches available.</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedBranchIds([])} disabled={selectedBranchIds.length === 0}>Show All Branches</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedBranchIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBranchIds([]); }} aria-label="Clear Branch filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium block text-gray-700">Select Timeframe</Label>
            <TimeframeButtons selectedTimeframe={globalTimeframe} onTimeframeChange={setGlobalTimeframe} />
          </div>
          <Button 
            variant="outline" 
            onClick={handleClearAllLocalFilters} 
            className="w-full sm:w-auto h-9 border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-xs"
          >
            <XCircle className="mr-2 h-4 w-4" /> Clear All Filters & Timeframe
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-xl border-slate-200/50 hover:shadow-2xl transition-shadow duration-200">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><TrendingUp className="h-5 w-5" />Metric Trends</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">Trendlines for selected metrics, reflecting active filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {METRIC_CONFIGS.map(metric => (
              <div key={metric.key} className="flex items-center space-x-2">
                <Checkbox
                  id={`metric-${metric.key}`}
                  checked={!!activeMetrics[metric.key]}
                  onCheckedChange={() => handleMetricToggle(metric.key)}
                  style={{ accentColor: metric.color } as React.CSSProperties}
                  className="border-slate-400 data-[state=checked]:bg-[var(--primary)] data-[state=checked]:border-[var(--primary)]"
                />
                <Label htmlFor={`metric-${metric.key}`} className="text-sm font-medium cursor-pointer" style={{ color: metric.color }}>
                  {metric.label}
                </Label>
              </div>
            ))}
          </div>
          {metricTrendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={metricTrendChartData} isAnimationActive={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.7)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(tick) => format(parseISO(tick), 'MMM d')}
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" orientation="left" tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis yAxisId="right" stroke="hsl(var(--muted-foreground))" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                  formatter={(value: number, name) => { 
                    const config = METRIC_CONFIGS.find(m => m.label === name);
                    if (config?.key.includes('percentage')) return [`${value}%`, name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {METRIC_CONFIGS.map(metric =>
                  activeMetrics[metric.key] && (
                    <Line
                      key={metric.key}
                      type="linear"
                      dataKey={metric.key.toString()}
                      name={metric.label}
                      stroke={metric.color}
                      strokeWidth={2.5}
                      connectNulls={true} 
                      yAxisId={metric.yAxisId || 'left'}
                      strokeDasharray={metric.strokeDasharray}
                      dot={{ r: 3, fill: metric.color, strokeWidth: 1, stroke: 'hsl(var(--background))' }}
                      activeDot={{ r: 6, stroke: 'hsl(var(--background))', strokeWidth: 2, fill: metric.color }}
                    />
                  )
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
              <TrendingUp className="w-20 h-20 text-primary/70 mb-5" />
              <p className="text-lg font-semibold text-slate-700 mb-1.5">No Metric Data</p>
              <p className="text-sm text-slate-500 max-w-xs">Try adjusting filters or ensure BHRs in your zone have submitted visits with relevant data.</p>
            </div>
          )}
        </CardContent>
      </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-xl border-slate-200/50 hover:shadow-2xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><Target className="h-5 w-5"/>Qualitative Assessment Overview</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">Average scores for qualitative questions (0-5 scale), reflecting active filters.</CardDescription>
          </CardHeader>
          <CardContent>
            {qualitativeSpiderChartData.length > 0 && qualitativeSpiderChartData.some(d => d.score > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={qualitativeSpiderChartData}>
                  <PolarGrid stroke="hsl(var(--border)/0.7)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <Radar 
                    name="Average Score" 
                    dataKey="score" 
                    stroke="hsl(var(--chart-1))" 
                    fill="url(#radarGradient)" 
                    fillOpacity={0.8} 
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                      contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                      }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                <ShieldQuestion className="w-20 h-20 text-primary/70 mb-5" />
                <p className="text-lg font-semibold text-slate-700 mb-1.5">No Qualitative Data</p>
                <p className="text-sm text-slate-500 max-w-xs">Ensure BHRs have submitted visits with qualitative answers for the selected filters.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl border-slate-200/50 hover:shadow-2xl transition-shadow duration-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><PieChartIcon className="h-5 w-5"/>Branch Category Distribution</CardTitle>
                <CardDescription className="text-sm text-muted-foreground/90">Distribution of submitted visits by branch category, reflecting active filters.</CardDescription>
            </CardHeader>
            <CardContent>
                {branchCategoryPieChartData.length > 0 ? (
                    <PlaceholderPieChart
                        data={branchCategoryPieChartData}
                        title=""
                        dataKey="value"
                        nameKey="name"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                        <PieChartIcon className="w-20 h-20 text-primary/70 mb-5" />
                        <p className="text-lg font-semibold text-slate-700 mb-1.5">No Category Data</p>
                        <p className="text-sm text-slate-500 max-w-xs">Ensure visits are submitted and branches have categories assigned for the current filters.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
    </div>
  );
}
    

    
