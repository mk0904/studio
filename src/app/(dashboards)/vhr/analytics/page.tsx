
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { ZhrFilterDropdown } from '@/components/shared/ZhrFilterDropdown';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Sector, Tooltip as RechartsTooltip } from 'recharts';
import type { PieProps } from 'recharts';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

import { LineChart, Line, XAxis, YAxis, CartesianGrid, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, RadarChart, Legend as RechartsLegend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Loader2,
  TrendingUp,
  ShieldQuestion,
  Target,
  PieChart as PieChartIcon,
  BarChartBig,
  Filter,
  ChevronsUpDown,
  XCircle,
  Search,
  X,
  User2,
  Building2,
  CalendarDays
} from 'lucide-react';
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
import { useVhrFilter } from '@/contexts/vhr-filter-context';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricConfig {
  key: keyof Visit;
  label: string;
  color: string;
  yAxisId?: string;
  strokeDasharray?: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'manning_percentage', label: 'Manning %', color: '#2E7D32', yAxisId: 'left' },      // Deep Green
  { key: 'attrition_percentage', label: 'Attrition %', color: '#C62828', yAxisId: 'left' },  // Deep Red
  { key: 'non_vendor_percentage', label: 'Non-Vendor %', color: '#1565C0', yAxisId: 'left' }, // Deep Blue
  { key: 'er_percentage', label: 'ER %', color: '#6D4C41', yAxisId: 'left' },                // Brown
  { key: 'cwt_cases', label: 'CWT Cases', color: '#4A148C', yAxisId: 'right' },              // Deep Purple
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
  <div className="flex items-center gap-3"> {/* Outer container for icon + button group */}
    <CalendarDays className="h-5 w-5 text-blue-600 shrink-0" /> {/* Single icon */}
    <div className="flex flex-wrap gap-2"> {/* Container for the buttons */}
      {TIMEFRAME_OPTIONS.map(tf => (
        <Button
          key={tf.key}
          size="sm"
          onClick={() => onTimeframeChange(tf.key)}
          className={cn(
            "h-8 sm:h-10 text-xs sm:text-sm shadow-sm rounded-lg transition-all duration-200 flex items-center", // Adjusted height and font size for phone screens
            selectedTimeframe === tf.key 
              ? 'bg-blue-50 text-blue-700 font-semibold border-transparent shadow-sm hover:bg-blue-100 focus:ring-2 focus:ring-offset-1 focus:ring-blue-500' 
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 focus:ring-1 focus:ring-offset-1 focus:ring-blue-500'
          )}
        >
          {/* CalendarDays icon removed from individual buttons */}
          {tf.label}
        </Button>
      ))}
    </div>
  </div>
);

type FilterOption = {
  id: string;
  value: string;
  label: string;
  name: string;
};

type CustomActiveShapeProps = {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
  value: number;
  name: string;
  percent: number;
};

export default function VHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    selectedZhrIds: globalSelectedZhrIds,
    setSelectedZhrIds: setGlobalSelectedZhrIds,
    zhrOptions: globalZhrOptions,
    isLoadingZhrOptions: isLoadingGlobalZhrOptions,
    allBhrsInVhrVertical,
    isLoadingBhrsInVhrVertical
  } = useVhrFilter();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [allVisitsInVertical, setAllVisitsInVertical] = useState<Visit[]>([]);
  const [allBranchesForLookup, setAllBranchesForLookup] = useState<Branch[]>([]);

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(METRIC_CONFIGS.map(config => config.key));
  const [bhrOptions, setBhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingBhrOptions, setIsLoadingBhrOptions] = useState(false);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<FilterOption[]>([]);
  const [isLoadingBranchOptions, setIsLoadingBranchOptions] = useState(false);

  const [globalTimeframe, setGlobalTimeframe] = useState<TimeframeKey>('past_month');

  const pageTitleText = useMemo(() => {
    let title = `VHR Analytics`;
    if (user) {
      if (globalSelectedZhrIds.length > 0) {
        if (globalSelectedZhrIds.length === 1) {
          const zhr = globalZhrOptions.find(z => z.value === globalSelectedZhrIds[0]);
          title += ` (${zhr?.label || 'Selected ZHR'})`;
        } else {
          title += ` (${globalSelectedZhrIds.length} ZHRs)`;
        }
      } else {
        title += ` (${user.name})`;
      }
    }
    return title;
  }, [globalSelectedZhrIds, globalZhrOptions, user]);


  useEffect(() => {
    if (user && user.role === 'VHR') {
      if (isLoadingBhrsInVhrVertical) return;

      const fetchData = async () => {
        setIsLoadingPageData(true);
        try {
          const bhrIdsInEntireVertical = allBhrsInVhrVertical.map(b => b.id);
          if (bhrIdsInEntireVertical.length > 0) {
            const { data: visits, error: visitsError } = await supabase
              .from('visits')
              .select('bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases, qual_aligned_conduct, qual_safe_secure, qual_motivated, qual_abusive_language, qual_comfortable_escalate, qual_inclusive_culture')
              .in('bhr_id', bhrIdsInEntireVertical)
              .eq('status', 'submitted');
            if (visitsError) throw visitsError;
            setAllVisitsInVertical(visits || []);
          } else {
            setAllVisitsInVertical([]);
          }

          const { data: branches, error: branchesError } = await supabase
            .from('branches')
            .select('id, name, category');
          if (branchesError) throw branchesError;
          setAllBranchesForLookup(branches || []);
          setBranchOptions((branches || []).map(b => ({ id: b.id, value: b.id, label: b.name, name: b.name } as FilterOption)));
          setIsLoadingBranchOptions(false);

        } catch (error: any) {
          console.error("VHR Analytics: Error fetching page data (visits/branches):", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
        } finally {
          setIsLoadingPageData(false);
        }
      };
      fetchData();
    } else {
      setIsLoadingPageData(false);
    }
  }, [user, toast, allBhrsInVhrVertical, isLoadingBhrsInVhrVertical]);

  useEffect(() => {
    setIsLoadingBhrOptions(true);
    if (allBhrsInVhrVertical.length > 0) {
      if (globalSelectedZhrIds.length > 0) {
        const filteredBhrs = allBhrsInVhrVertical.filter(bhr => bhr.reports_to && globalSelectedZhrIds.includes(bhr.reports_to));
        setBhrOptions(filteredBhrs.map(b => ({ id: b.id, value: b.id, label: b.name, name: b.name })));
      } else {
        setBhrOptions(allBhrsInVhrVertical.map(b => ({ id: b.id, value: b.id, label: b.name, name: b.name })));
      }
    } else {
      setBhrOptions([]);
    }
    setSelectedMetrics(METRIC_CONFIGS.map(config => config.key).slice(0, 3));
    setIsLoadingBhrOptions(false);
  }, [globalSelectedZhrIds, allBhrsInVhrVertical]);

  useEffect(() => {
    setSelectedBranchIds([]);
  }, [selectedMetrics, globalSelectedZhrIds]);

  const filteredVisitsData = useMemo(() => {
    let visits = allVisitsInVertical;

    let relevantBhrIds = new Set<string>();
    const bhrsConsideredForFiltering = globalSelectedZhrIds.length > 0
      ? allBhrsInVhrVertical.filter(bhr => bhr.reports_to && globalSelectedZhrIds.includes(bhr.reports_to))
      : allBhrsInVhrVertical;

    bhrsConsideredForFiltering.forEach(b => relevantBhrIds.add(b.id));

    if (relevantBhrIds.size > 0) {
      visits = visits.filter(visit => relevantBhrIds.has(visit.bhr_id));
    }

    if (selectedBranchIds.length > 0) {
      visits = visits.filter(visit => selectedBranchIds.includes(visit.branch_id));
    }
    return visits;
  }, [allVisitsInVertical, globalSelectedZhrIds, selectedMetrics, selectedBranchIds, allBhrsInVhrVertical]);

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

    dateRangeForChart.forEach(dayDate => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const weekKey = format(dayDate, 'yyyy-ww');
      const dayData = aggregatedData[dayKey];

      if (!weekData[weekKey]) {
        weekData[weekKey] = {
          date: dayKey, // Use first day of week as the date
          sums: {},
          counts: {}
        };
      }

      METRIC_CONFIGS.forEach(m => {
        if (dayData && dayData[m.key] && dayData[m.key].count > 0) {
          weekData[weekKey].sums[m.key] = (weekData[weekKey].sums[m.key] || 0) + dayData[m.key].sum;
          weekData[weekKey].counts[m.key] = (weekData[weekKey].counts[m.key] || 0) + dayData[m.key].count;
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
    if (visitsForChart.length === 0 || allBranchesForLookup.length === 0) return [];
    const categoryCounts: Record<string, number> = {};
    const branchCategoryMap = new Map(allBranchesForLookup.map(b => [b.id, b.category]));
    visitsForChart.forEach(visit => {
      const category = branchCategoryMap.get(visit.branch_id);
      if (category) { categoryCounts[category] = (categoryCounts[category] || 0) + 1; }
    });
    return Object.entries(categoryCounts)
      .map(([name, value]) => ({
        name,
        value
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredVisitsData, globalTimeframe, allBranchesForLookup]);

  const topPerformingBranchesChartData = useMemo(() => {
    const visitsForChart = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsForChart.length === 0 || allBranchesForLookup.length === 0) return [];

    const visitsPerBranch: Record<string, number> = {};
    const branchNameMap = new Map(allBranchesForLookup.map(b => [b.id, b.name]));

    visitsForChart.forEach(visit => {
      const branchName = branchNameMap.get(visit.branch_id) || 'Unknown Branch';
      visitsPerBranch[branchName] = (visitsPerBranch[branchName] || 0) + 1;
    });

    return Object.entries(visitsPerBranch)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredVisitsData, globalTimeframe, allBranchesForLookup]);

  const visitsByZHRChartData = useMemo(() => {
    // Use filteredVisitsData which is already filtered by BHR, Branch, and Timeframe
    const visitsToProcess = filteredVisitsData;
    if (visitsToProcess.length === 0 || globalZhrOptions.length === 0) return [];

    const bhrToZhrMap = new Map<string, string>();
    allBhrsInVhrVertical.forEach(bhr => {
      if (bhr.reports_to) {
        bhrToZhrMap.set(bhr.id, bhr.reports_to);
      }
    });

    const visitsPerZhr: Record<string, number> = {};
    visitsToProcess.forEach(visit => {
      const zhrId = bhrToZhrMap.get(visit.bhr_id);
      if (zhrId) {
        const zhrOption = globalZhrOptions.find(z => z.value === zhrId);
        if (zhrOption) {
          visitsPerZhr[zhrOption.label] = (visitsPerZhr[zhrOption.label] || 0) + 1;
        }
      }
    });

    return Object.entries(visitsPerZhr)
      .map(([name, value], index) => ({
        name,
        value,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredVisitsData, allBhrsInVhrVertical, globalZhrOptions]);

  const handleMetricToggle = (metricKey: string) => {
    setSelectedMetrics(prev => prev.includes(metricKey) ? prev.filter(m => m !== metricKey) : [...prev, metricKey]);
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
    setSelectedMetrics(METRIC_CONFIGS.map(config => config.key).slice(0, 3));
    setSelectedBranchIds([]);
    setGlobalTimeframe('past_month');
  };

  const isLoading = isLoadingGlobalZhrOptions || isLoadingBhrsInVhrVertical || isLoadingPageData || isLoadingBranchOptions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  if (!user || user.role !== 'VHR') {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }

  const showBranchSpecificCharts = selectedBranchIds.length === 0;

  return (
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
      <PageTitle
  title="VHR Analytics Dashboard"
  description={`Review key metrics and trends for your ZHRs and Branches. ${user?.name ? `Welcome, ${user.name}!` : ''}`}
  action={<ZhrFilterDropdown />}
/>

      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardContent className="space-y-6 pt-4">
          <div className="flex flex-row gap-4">
            <div className="relative flex items-center w-1/2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                    <div className="flex items-center overflow-hidden">
                      <User2 className="mr-2 h-4 w-4 text-blue-600 shrink-0" />
                      <span className="truncate">{getMultiSelectButtonText(bhrOptions, selectedMetrics, "All BHRs", "BHR", "BHRs", isLoadingBhrOptions)}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto border-0 shadow-md">
                  <DropdownMenuLabel>Filter by BHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                    bhrOptions.length > 0 ? bhrOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.id}
                        checked={selectedMetrics.includes(option.id)}
                        onCheckedChange={() => handleMultiSelectChange(option.id, selectedMetrics, setSelectedMetrics)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {option.name}
                      </DropdownMenuCheckboxItem>
                    )) : <DropdownMenuLabel>No BHRs match current ZHR filter.</DropdownMenuLabel>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedMetrics(METRIC_CONFIGS.map(config => config.key))} disabled={selectedMetrics.length === METRIC_CONFIGS.length}>Show All BHRs</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedMetrics.length > 0 && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedMetrics(METRIC_CONFIGS.map(config => config.key)); }} aria-label="Clear BHR filter">
                  <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>

            <div className="relative flex items-center w-1/2">
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
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto border-0 shadow-md">
                  <DropdownMenuLabel>Filter by Branch</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBranchOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                    branchOptions.length > 0 ? branchOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.id}
                        checked={selectedBranchIds.includes(option.id)}
                        onCheckedChange={() => handleMultiSelectChange(option.id, selectedBranchIds, setSelectedBranchIds)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {option.name}
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
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Timeframe (Global for this page)</Label>
            <div className="flex items-center justify-between gap-4">
              <TimeframeButtons selectedTimeframe={globalTimeframe} onTimeframeChange={setGlobalTimeframe} />
              <Button 
                onClick={handleClearAllLocalFilters} 
                className="h-9 sm:h-10 bg-white border border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600 focus:ring-1 focus:ring-offset-1 focus:ring-red-500 text-sm shadow-sm rounded-lg transition-all duration-200 flex items-center justify-center p-2 sm:px-4 shrink-0">
                <XCircle className="h-4 w-4 text-red-600 sm:mr-2" /> <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><TrendingUp className="h-5 w-5" /> Metric Trends</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/90">Trendlines for selected metrics from submitted visits, reflecting all active filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {METRIC_CONFIGS.map(metric => (
              <label key={metric.key} className="flex items-center space-x-2 cursor-pointer">
                <Checkbox id={`metric-vhr-${metric.key}`} checked={selectedMetrics.includes(metric.key)} onCheckedChange={() => handleMetricToggle(metric.key)} style={{ accentColor: metric.color } as React.CSSProperties} />
                <span className="text-sm font-medium" style={{ color: metric.color }}>{metric.label}</span>
              </label>
            ))}
          </div>
          {metricTrendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={metricTrendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={(tick) => format(parseISO(tick), 'MMM d')} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" orientation="left" tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis yAxisId="right" stroke="hsl(var(--muted-foreground))" orientation="right" tick={{ fontSize: 12 }} allowDecimals={false} />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <div className="font-semibold text-base text-slate-700 mb-2">{format(parseISO(label), 'yyyy-MM-dd')}</div>
                          <div className="space-y-1">
  {payload.map((entry, idx) => (
    <div
      key={entry.dataKey || idx}
      className="flex justify-between items-center text-sm font-medium text-slate-700 mb-1 last:mb-0"
    >
      <span className="flex items-center">
        <span
          className="inline-block w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: entry.color }}
        />
        {entry.name}
      </span>
      <span className="ml-4">{entry.value}{METRIC_CONFIGS.find(m => m.label === entry.name)?.key.toString().includes('percentage') ? '%' : ''}</span>
    </div>
  ))}
</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {METRIC_CONFIGS.map(metric => selectedMetrics.includes(metric.key) && (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key.toString()}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2}
                    yAxisId={metric.yAxisId || 'left'}
                    connectNulls={true}
                    strokeDasharray={metric.strokeDasharray}
                    dot={{ r: 3, fill: metric.color, stroke: 'white', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: metric.color, stroke: 'white', strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
              <TrendingUp className="w-20 h-20 text-primary/70 mb-5" />
              <div className="text-lg font-semibold text-slate-700 mb-1.5">No Metric Data</div>
              <div className="text-sm text-slate-500 max-w-xs">Try adjusting your filters or check if data has been submitted for the selected criteria.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><Target className="h-5 w-5" />Qualitative Assessment</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">Average scores for qualitative questions from visits (0-5 scale), reflecting active filters.</CardDescription>
          </CardHeader>
          <CardContent>
            {qualitativeSpiderChartData.length > 0 && qualitativeSpiderChartData.some(d => d.score > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={qualitativeSpiderChartData}>
                  <PolarGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    gridType="circle"
                  />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{
                      fill: 'hsl(var(--foreground))',
                      fontSize: 12,
                      fontWeight: 500
                    }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 5]}
                    tick={{
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 10
                    }}
                    stroke="hsl(var(--border)/0.5)"
                    tickCount={6}
                  />
                  {QUALITATIVE_QUESTIONS_CONFIG.map((config, index) => (
                    <Radar
                      key={config.key}
                      dataKey="score"
                      name={config.label}
                      stroke={config.color}
                      fill={config.color}
                      fillOpacity={0.12}
                      strokeWidth={1.5}
                      dot={{
                        r: 3,
                        fill: config.color,
                        stroke: 'white',
                        strokeWidth: 1.5
                      }}
                      activeDot={{
                        r: 5,
                        fill: config.color,
                        stroke: 'white',
                        strokeWidth: 2
                      }}
                    />
                  ))}
                  <RechartsTooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-lg">
                            <div className="text-base font-semibold mb-2">{data.subject}</div>
                            {payload.map((entry, index) => (
                              <div
                                key={entry.name}
                                className="flex items-center gap-2 text-sm mb-1"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span>{entry.name}:</span>
                                <span className="text-muted-foreground ml-1">
                                  {Number(entry.value).toFixed(1)} / 5
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                <ShieldQuestion className="w-20 h-20 text-primary/70 mb-5" />
                <div className="text-lg font-semibold text-slate-700 mb-1.5">No Qualitative Data</div>
                <div className="text-sm text-slate-500 max-w-xs">Ensure qualitative assessments were part of the submitted visits for the selected filters.</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllLocalFilters}
                  className="h-8 px-2 lg:px-3 text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  Clear
                  <XCircle className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {showBranchSpecificCharts && (
          <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><PieChartIcon className="h-5 w-5" />Branch Category Distribution</CardTitle>
              <CardDescription className="text-sm text-muted-foreground/90">Distribution of visits across branch categories, reflecting active filters.</CardDescription>
            </CardHeader>
            <CardContent>
              {branchCategoryPieChartData.length > 0 ? (
                <div className="relative w-full h-[350px]">
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
                        {(() => {
                          // Premium metallic colors defined once
                          const categoryColors = {
                            'gold': '#FFB800',       // Richer, warmer gold
                            'silver': '#D1D1D1',     // Brighter silver
                            'bronze': '#B87333',     // Warmer bronze
                            'platinum': '#F8F9F9',   // Bright platinum white
                            'diamond': '#E8F6FF',    // Icy diamond blue
                            'standard': '#4A5568'    // Professional gray
                          };

                          return branchCategoryPieChartData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={categoryColors[entry.name.toLowerCase() as keyof typeof categoryColors] || '#4A5568'}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          ));
                        })()}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
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
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {showBranchSpecificCharts && (
          <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200l">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChartBig className="h-5 w-5 text-primary" />Top Branches by Visits</CardTitle>
              <CardDescription>Branches with the most submitted HR visits (hidden if specific branches selected).</CardDescription>
            </CardHeader>
            <CardContent>
              {topPerformingBranchesChartData.length > 0 ? (
                <div className="relative w-full h-[350px] p-4">
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
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                  <BarChartBig className="w-20 h-20 text-primary/70 mb-5" />
                  <p className="text-lg font-semibold text-slate-700 mb-1.5">No Branch Visit Data</p>
                  <p className="text-sm text-slate-500 max-w-xs">No data available for top branches by visits with the current filters.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {globalSelectedZhrIds.length === 0 ? (
          <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User2 className="h-5 w-5 text-primary" />Visits by ZHR</CardTitle>
              <CardDescription>Distribution of submitted visits by ZHRs in your vertical, reflecting the global timeframe.</CardDescription>
            </CardHeader>
            <CardContent>
              {visitsByZHRChartData.length > 0 ? (
                <div className="relative w-full h-[300px]">
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
                                  {data.value} visits ({((data.value / visitsByZHRChartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%)
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                        wrapperStyle={{ outline: 'none' }}
                      />
                      <Pie
                        data={visitsByZHRChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={85}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        activeIndex={activeIndex}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                        isAnimationActive={true}
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(-1)}
                        activeShape={(props: any) => {
                          const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props as {
                            cx: number;
                            cy: number;
                            innerRadius: number;
                            outerRadius: number;
                            startAngle: number;
                            endAngle: number;
                            fill: string;
                            payload: { name: string; value: number };
                          };
                          return (
                            <g>
                              <foreignObject x={cx - 120} y={cy - 60} width={240} height={120}>
                                <div style={{ width: '100%', height: '100%' }} className="flex flex-col items-center justify-center p-3 rounded-lg bg-background border shadow-lg">
                                  <div className="text-lg font-semibold text-foreground">
                                    {payload.name}
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {payload.value} visits
                                  </div>
                                </div>
                              </foreignObject>
                              <Sector
                                cx={cx}
                                cy={cy}
                                innerRadius={innerRadius}
                                outerRadius={outerRadius + 8}
                                startAngle={startAngle}
                                endAngle={endAngle}
                                fill={fill}
                                opacity={0.15}
                              />
                              <Sector
                                cx={cx}
                                cy={cy}
                                innerRadius={innerRadius}
                                outerRadius={outerRadius}
                                startAngle={startAngle}
                                endAngle={endAngle}
                                fill={fill}
                              />
                            </g>
                          );
                        }}
                      >
                        {visitsByZHRChartData.map((entry, index) => {
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
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={colors[index % colors.length]}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          );
                        })}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-md">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="font-medium">{data.name}</div>
                                  <div className="font-medium text-right">{data.value} visits</div>
                                  <div className="text-sm text-muted-foreground">Percentage</div>
                                  <div className="text-sm text-muted-foreground text-right">
                                    {((data.value / visitsByZHRChartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">
                        {visitsByZHRChartData.reduce((sum, item) => sum + item.value, 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Visits</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-center p-6 bg-slate-50/70 rounded-lg border border-slate-200/60">
                  <User2 className="w-20 h-20 text-primary/70 mb-5" />
                  <p className="text-lg font-semibold text-slate-700 mb-1.5">No ZHR Visit Data</p>
                  <p className="text-sm text-slate-500 max-w-xs">No data available for ZHR visits within the selected timeframe.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Visits by ZHR Chart Hidden</CardTitle>
              <CardDescription>This chart is hidden when specific ZHRs are selected in the global filter. Clear the ZHR filter to see the overall distribution by ZHR.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-40">
              <User2 className="w-12 h-12 text-muted-foreground opacity-50" />
            </CardContent>
          </Card>
        )}
      </div>
      {!showBranchSpecificCharts && (
        <Card className="bg-white border-none shadow-sm hover:shadow transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]">
              <PieChartIcon className="h-5 w-5" />
              Branch Category Distribution
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">
              Distribution of visits by branch category.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-40">
            <BarChartBig className="w-12 h-12 text-muted-foreground opacity-50 mr-2" />
            <PieChartIcon className="w-12 h-12 text-muted-foreground opacity-50" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}





