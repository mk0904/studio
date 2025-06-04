'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  RadarChart, 
  Legend as RechartsLegend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartjsTooltip,
  Legend as ChartjsLegend,
  ArcElement
} from 'chart.js/auto';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, ShieldQuestion, Target, PieChart as PieChartIcon, BarChartBig, Filter as FilterIcon, ChevronsUpDown, XCircle, Users, Building2 } from 'lucide-react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  ChartjsTooltip,
  ChartjsLegend
);

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
  { key: 'past_week', label: '1W' },
  { key: 'past_month', label: '1M' },
  { key: 'last_3_months', label: '3M' },
  { key: 'last_6_months', label: '6M' },
  { key: 'last_year', label: '1Y' },
  { key: 'last_3_years', label: '3Y' },
];

type TrendChartDataPoint = { date: string;[key: string]: any; };
interface QualitativeQuestionConfig { key: keyof Visit; label: string; positiveIsYes: boolean; color: string; }

const QUALITATIVE_QUESTIONS_CONFIG: QualitativeQuestionConfig[] = [
  { key: 'qual_aligned_conduct', label: 'Leaders Aligned with Code', positiveIsYes: true, color: '#2E7D32' },     // Deep Green
  { key: 'qual_safe_secure', label: 'Employees Feel Safe', positiveIsYes: true, color: '#43A047' },              // Medium Green
  { key: 'qual_motivated', label: 'Employees Feel Motivated', positiveIsYes: true, color: '#66BB6A' },           // Light Green
  { key: 'qual_abusive_language', label: 'Leaders Use Abusive Language', positiveIsYes: false, color: '#1565C0' }, // Deep Blue
  { key: 'qual_comfortable_escalate', label: 'Comfortable with Escalation', positiveIsYes: true, color: '#1E88E5' }, // Medium Blue
  { key: 'qual_inclusive_culture', label: 'Inclusive Culture', positiveIsYes: true, color: '#42A5F5' },           // Light Blue
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
          "h-9 sm:h-10 text-xs sm:text-sm font-medium transition-all duration-200 rounded-lg shadow-sm",
          selectedTimeframe === tf.key
            ? "bg-[#004C8F] hover:bg-[#004C8F]/90 text-white shadow-md"
            : "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

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
            setAllZoneVisits(visitsData as any || []);
          }

          const { data: branchesData, error: branchesError } = await supabase
            .from('branches')
            .select('id, name, category, code');
          if (branchesError) throw branchesError;
          setAllBranchesForCategoryLookup(branchesData as any || []);
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
    let maxDate = new Date(1970, 0, 1);

    visitsForChart.forEach(visit => {
      const visitDateObj = parseISO(visit.visit_date);
      if (isValid(visitDateObj)) {
        if (visitDateObj < minDate) minDate = visitDateObj;
        if (visitDateObj > maxDate) maxDate = visitDateObj;
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
    if (visitsForChart.length === 0 || !isValid(minDate) || !isValid(maxDate) || minDate > maxDate) return [];

    let dateRangeForChart: Date[] = [];
    try {
      dateRangeForChart = eachDayOfInterval({ start: startOfDay(minDate), end: endOfDay(maxDate) });
    } catch (e) { return []; }
    if (dateRangeForChart.length === 0) return [];

    // Group by weeks to reduce data points
    const weekData: Record<string, { date: string; sums: Record<string, number>; counts: Record<string, number> }> = {};

    // First, initialize all weeks in the range
    dateRangeForChart.forEach(dayDate => {
      const weekKey = format(dayDate, 'yyyy-ww');
      if (!weekData[weekKey]) {
        weekData[weekKey] = {
          date: format(dayDate, 'yyyy-MM-dd'),
          sums: {},
          counts: {}
        };
        METRIC_CONFIGS.forEach(m => {
          weekData[weekKey].sums[m.key] = 0;
          weekData[weekKey].counts[m.key] = 0;
        });
      }
    });

    // Then aggregate the data
    dateRangeForChart.forEach(dayDate => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const weekKey = format(dayDate, 'yyyy-ww');
      const dayData = aggregatedData[dayKey];

      METRIC_CONFIGS.forEach(m => {
        if (dayData && dayData[m.key] && dayData[m.key].count > 0) {
          weekData[weekKey].sums[m.key] += dayData[m.key].sum;
          weekData[weekKey].counts[m.key] += dayData[m.key].count;
        }
      });
    });

    return Object.values(weekData)
      .map(week => {
        const point: TrendChartDataPoint = { date: week.date };
        METRIC_CONFIGS.forEach(m => {
          if (week.counts[m.key] > 0) {
            point[m.key] = m.key === 'cwt_cases'
              ? week.sums[m.key]
              : parseFloat((week.sums[m.key] / week.counts[m.key]).toFixed(2));
          } else {
            point[m.key] = null;
          }
        });
        return point;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredVisitsData, globalTimeframe]);

  console.log('Metric Trend Chart Data:', metricTrendChartData);

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
    }).sort((a, b) => b.score - a.score);
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

  const topPerformingBranchesChartData = useMemo(() => {
    const visitsForChart = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsForChart.length === 0 || allBranchesForCategoryLookup.length === 0) return [];

    const visitsPerBranch: Record<string, number> = {};
    const branchNameMap = new Map(allBranchesForCategoryLookup.map(b => [b.id, b.name]));

    visitsForChart.forEach(visit => {
      const branchName = branchNameMap.get(visit.branch_id) || 'Unknown Branch';
      visitsPerBranch[branchName] = (visitsPerBranch[branchName] || 0) + 1;
    });

    return Object.entries(visitsPerBranch)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10

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
    setActiveMetrics(METRIC_CONFIGS.reduce((acc, metric) => ({ ...acc, [metric.key]: metric.key === 'manning_percentage' }), {}));
  };

  const isLoadingData = isLoading || isLoadingBhrOptions || isLoadingBranchOptions;

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
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
      <PageTitle
        title="ZHR Analytics Dashboard"
        description={`Review key metrics and trends for your BHRs and Branches. ${user?.name ? `Welcome, ${user.name}!` : ''}`}
      />

      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardContent className="space-y-6 pt-4">

          {/* Filter Row 1: BHR and Branch */}
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            {/* BHR Filter */}
            <div className="w-full md:w-auto relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                    <div className="flex items-center overflow-hidden">
                      <Users className="mr-2 h-4 w-4 text-blue-600 shrink-0" />
                      <span className="truncate">{getMultiSelectButtonText(bhrOptions, selectedBhrIds, "All BHRs", "BHR", "BHRs", isLoadingBhrOptions)}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto border-0 shadow-md">
                  <DropdownMenuLabel>Filter by BHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                    bhrOptions.length > 0 ? bhrOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedBhrIds.includes(option.value)}
                        onCheckedChange={() => handleMultiSelectChange(option.value, selectedBhrIds, setSelectedBhrIds)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    )) : <DropdownMenuLabel>No BHRs found.</DropdownMenuLabel>}
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

            {/* Branches Filter */}
            <div className="w-full md:w-auto relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                    <div className="flex items-center overflow-hidden">
                      <Building2 className="mr-2 h-4 w-4 text-blue-600 shrink-0" />
                      <span className="truncate">{getMultiSelectButtonText(branchOptions, selectedBranchIds, "All Branches", "Branch", "Branches", isLoadingBranchOptions)}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto border-0 shadow-md">
                  <DropdownMenuLabel>Filter by Branch</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBranchOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                    branchOptions.length > 0 ? branchOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedBranchIds.includes(option.value)}
                        onCheckedChange={() => handleMultiSelectChange(option.value, selectedBranchIds, setSelectedBranchIds)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    )) : <DropdownMenuLabel>No branches available.</DropdownMenuLabel>}
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

          {/* Filter Row 2: Timeframe and Clear All */}
          <div className="mt-4 md:mt-0 space-y-2">
            <Label className="text-sm font-medium block">Select Timeframe</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <TimeframeButtons selectedTimeframe={globalTimeframe} onTimeframeChange={setGlobalTimeframe} />
              </div>
              <Button
                onClick={handleClearAllLocalFilters}
                className="h-9 sm:h-10 bg-white border border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600 focus:ring-1 focus:ring-offset-1 focus:ring-red-500 text-sm shadow-sm rounded-lg transition-all duration-200 flex items-center justify-center p-2 sm:px-4 shrink-0"
              >
                <XCircle className="h-4 w-4 text-red-600 sm:mr-2" /> <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Branch Category Distribution Card */}
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><PieChartIcon className="h-5 w-5" />Branch Category Distribution</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">Distribution of visits across branch categories, reflecting active filters.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                <Loader2 className="h-12 w-12 animate-spin text-primary/70" />
              </div>
            ) : branchCategoryPieChartData.length > 0 ? (
              <div className="relative w-full h-[350px]">
                {/* PieChart content */}
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-lg">
                              <div className="text-base font-semibold mb-1">{data.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {data.value} visits ({((data.value / branchCategoryPieChartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%)
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Pie
                      data={branchCategoryPieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    >
                      {branchCategoryPieChartData.map((entry, index) => {
                        const categoryColors = {
                          'gold': '#FFB800',
                          'silver': '#D1D1D1',
                          'bronze': '#B87333',
                          'platinum': '#F8F9F9',
                          'diamond': '#E8F6FF',
                          'standard': '#4A5568'
                        };
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={categoryColors[entry.name.toLowerCase() as keyof typeof categoryColors] || '#4A5568'}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Total Visits overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {branchCategoryPieChartData.reduce((sum, item) => sum + item.value, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Visits</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                <PieChartIcon className="w-20 h-20 text-primary/70 mb-5" />
                <div className="text-lg font-semibold text-slate-700 mb-1.5">No Category Data</div>
                <div className="text-sm text-slate-500 max-w-xs">No visit data found for branch categories under the current filter combination.</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performing Branches Card */}
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChartBig className="h-5 w-5 text-primary" />Top Branches by Visits</CardTitle>
            <CardDescription>Branches with the most submitted HR visits.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                <Loader2 className="h-12 w-12 animate-spin text-primary/70" />
              </div>
            ) : topPerformingBranchesChartData.length > 0 ? (
              <div className="relative w-full h-[350px] p-4">
                {/* Bar chart content */}
                <Bar
                  data={{
                    labels: topPerformingBranchesChartData.map(item => item.name),
                    datasets: [
                      {
                        label: 'Total Visits',
                        data: topPerformingBranchesChartData.map(item => item.value),
                        backgroundColor: (context) => {
                          const index = context.dataIndex;
                          const colors = [
                            '#0E2B72',  // HDFC Navy Blue
                            '#2D4B73',  // Steel Blue
                            '#00A3E0',  // HDFC Light Blue
                            '#1B4D89',  // Royal Blue
                            '#386FA4',  // Sapphire Blue
                            '#133C55',  // Deep Ocean Blue
                            '#5D4E6D',  // Elegant Purple
                            '#7E6B8F',  // Dusty Purple
                            '#4A5859',  // Slate Gray
                            '#3F4E4F'   // Charcoal
                          ];
                          return colors[index % colors.length];
                        },
                        hoverBackgroundColor: (context) => {
                          const index = context.dataIndex;
                          const colors = [
                            '#1A3C8C',  // Lighter Navy Blue
                            '#3A5C84',  // Lighter Steel Blue
                            '#33B5E8',  // Lighter Light Blue
                            '#2A5C98',  // Lighter Royal Blue
                            '#4780B5',  // Lighter Sapphire
                            '#224D66',  // Lighter Ocean Blue
                            '#6E5F7E',  // Lighter Elegant Purple
                            '#8F7CA0',  // Lighter Dusty Purple
                            '#5B696A',  // Lighter Slate
                            '#505F60'   // Lighter Charcoal
                          ];
                          return colors[index % colors.length];
                        },
                        borderRadius: 0,
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
                          label: (context: any) => `${Math.round(context.parsed.y)} visits`,
                          title: (items: any) => items[0].label
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
                          callback: function (value: any) { return typeof value === 'number' ? Math.round(value).toString() : value }
                        },
                        beginAtZero: true
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                <BarChartBig className="w-20 h-20 text-primary/70 mb-5" />
                <p className="text-lg font-semibold text-slate-700 mb-1.5">No Branch Visit Data</p>
                <p className="text-sm text-slate-500 max-w-xs">No data available for top branches by visits with the current filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}



