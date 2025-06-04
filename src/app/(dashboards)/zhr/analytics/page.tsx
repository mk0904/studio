'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  PieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  isValid
} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TrendingUp, ShieldQuestion, PieChart as PieChartIcon, BarChartBig, Users, Building2, CalendarDays, ChevronsUpDown, XCircle } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartJSTitle,
  Tooltip as ChartJSTooltip,
  Legend as ChartJSLegend,
} from 'chart.js/auto';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ChartJSTitle,
  ChartJSTooltip,
  ChartJSLegend
);

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

type TrendChartDataPoint = { date: string; [key: string]: any };

interface QualitativeQuestionConfig { key: keyof Visit; label: string; positiveIsYes: boolean; color: string; }

const QUALITATIVE_QUESTIONS_CONFIG: QualitativeQuestionConfig[] = [
  { key: 'qual_aligned_conduct', label: 'Leaders Aligned with Code', positiveIsYes: true, color: '#2E7D32' },
  { key: 'qual_safe_secure', label: 'Employees Feel Safe', positiveIsYes: true, color: '#43A047' },
  { key: 'qual_motivated', label: 'Employees Feel Motivated', positiveIsYes: true, color: '#66BB6A' },
  { key: 'qual_abusive_language', label: 'Leaders Use Abusive Language', positiveIsYes: false, color: '#1565C0' },
  { key: 'qual_comfortable_escalate', label: 'Comfortable with Escalation', positiveIsYes: true, color: '#1E88E5' },
  { key: 'qual_inclusive_culture', label: 'Inclusive Culture', positiveIsYes: true, color: '#42A5F5' },
];

export default function ZHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Data states
  const [isLoading, setIsLoading] = useState(true);
  const [allZoneVisits, setAllZoneVisits] = useState<Visit[]>([]);
  const [bhrOptions, setBhrOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedBhrIds, setSelectedBhrIds] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [allBranchesForCategoryLookup, setAllBranchesForCategoryLookup] = useState<Branch[]>([]);

  // Filter states
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
    METRIC_CONFIGS.reduce((acc, metric, index) => ({ ...acc, [metric.key]: index < 3 }), {})
  );
  const [globalTimeframe, setGlobalTimeframe] = useState<TimeframeKey>('past_month');

  // Load data on mount
  useEffect(() => {
    if (user && user.role === 'ZHR') {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { data: bhrUsersData, error: bhrError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'BHR')
        .eq('reports_to', user?.id);

          if (bhrError) throw bhrError;

          setBhrOptions((bhrUsersData || []).map(b => ({ value: b.id, label: b.name })));

          const bhrIds = (bhrUsersData || []).map(bhr => bhr.id);

      let visitsData: Visit[] = [];
      if (bhrIds.length > 0) {
        const { data, error } = await supabase
              .from('visits')
          .select('id, bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases, qual_aligned_conduct, qual_safe_secure, qual_motivated, qual_abusive_language, qual_comfortable_escalate, qual_inclusive_culture')
              .in('bhr_id', bhrIds)
              .eq('status', 'submitted');

        if (error) throw error;

        visitsData = data;
      }

      setAllZoneVisits(visitsData as any || []);

          const { data: branchesData, error: branchesError } = await supabase
            .from('branches')
            .select('id, name, category, code');

          if (branchesError) throw branchesError;

          setAllBranchesForCategoryLookup(branchesData as any || []);
          setBranchOptions((branchesData || []).map(b => ({ value: b.id, label: `${b.name} (${b.code})` })));
        } catch (error: any) {
          console.error("ZHR Analytics: Error fetching data:", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };

  const filteredVisitsData = useMemo(() => {
    return allZoneVisits.filter(visit => {
      const matchBhr = selectedBhrIds.length === 0 || selectedBhrIds.includes(visit.bhr_id);
      const matchBranch = selectedBranchIds.length === 0 || selectedBranchIds.includes(visit.branch_id);
      return matchBhr && matchBranch;
    });
  }, [allZoneVisits, selectedBhrIds, selectedBranchIds]);

  const filterVisitsByTimeframe = useCallback((visits: Visit[], timeframe: TimeframeKey): Visit[] => {
    const now = new Date();
    let startDateFilter: Date;
    const endDateFilter: Date = now;

    switch (timeframe) {
      case 'past_week': startDateFilter = subDays(now, 7); break;
      case 'past_month': startDateFilter = subMonths(now, 1); break;
      case 'last_3_months': startDateFilter = subMonths(now, 3); break;
      case 'last_6_months': startDateFilter = subMonths(now, 6); break;
      case 'last_year': startDateFilter = subYears(now, 1); break;
      case 'last_3_years': startDateFilter = subYears(now, 3); break;
      default: startDateFilter = startOfDay(subMonths(now, 1));
    }

    if (!isValid(startDateFilter) || !isValid(endDateFilter) || startDateFilter > endDateFilter) return [];

    return visits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      return isValid(visitDate) && isWithinInterval(visitDate, { start: startDateFilter, end: endDateFilter });
    });
  }, [filteredVisitsData, globalTimeframe]);

  const metricTrendChartData = useMemo(() => {
    const visitsForChart = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsForChart.length === 0) return [];

    // Group visits by date and calculate averages
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

    if (!isValid(minDate) || !isValid(maxDate) || minDate > maxDate) return [];

    const dateRangeForChart = eachDayOfInterval({ start: startOfDay(minDate), end: endOfDay(maxDate) });

    const chartData = dateRangeForChart.map(dayDate => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const dayData = aggregatedData[dayKey];
      const point: TrendChartDataPoint = { date: dayKey };

      METRIC_CONFIGS.forEach(m => {
        if (dayData && dayData[m.key]?.count > 0) {
          point[m.key] = m.key === 'cwt_cases'
            ? dayData[m.key].sum
            : parseFloat((dayData[m.key].sum / dayData[m.key].count).toFixed(2));
        } else {
          point[m.key] = null;
        }
      });
      return point;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('Processed Chart Data:', chartData);
    return chartData;
  }, [filteredVisitsData, globalTimeframe, filterVisitsByTimeframe]);

  const qualitativeSpiderChartData = useMemo(() => {
    const visitsForChart = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsForChart.length === 0) return QUALITATIVE_QUESTIONS_CONFIG.map(q => ({ subject: q.label, score: 0, fullMark: 5 }));
    const scores: Record<string, { totalScore: number; count: number }> = {};
    QUALITATIVE_QUESTIONS_CONFIG.forEach(q => { scores[q.key] = { totalScore: 0, count: 0 }; });
    visitsForChart.forEach(visit => {
      QUALITATIVE_QUESTIONS_CONFIG.forEach(qConfig => {
        const value = visit[qConfig.key as keyof Visit] as 'yes' | 'no' | undefined;
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
  }, [filteredVisitsData, globalTimeframe, filterVisitsByTimeframe]);

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
  }, [filteredVisitsData, globalTimeframe, allBranchesForCategoryLookup, filterVisitsByTimeframe]);

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

  }, [filteredVisitsData, globalTimeframe, allBranchesForCategoryLookup, filterVisitsByTimeframe]);

  const visitsByEntityChartData = useMemo(() => {
    // Note: ZHR context means 'entity' here refers to BHRs that report to this ZHR
    const visitsToProcess = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsToProcess.length === 0) return [];

    const visitsPerBhr: Record<string, number> = {};
    // Assuming you have a way to map bhr_id to bhr name, similar to CHR's allUsersForContext
    // For now, we'll just use the bhr_id as the label or fetch user data if necessary
    // Let's assume bhrOptions has the necessary mapping.

    const bhrNameMap = new Map(bhrOptions.map(b => [b.value, b.label]));

    visitsToProcess.forEach(visit => {
      const bhrName = bhrNameMap.get(visit.bhr_id) || `BHR ID: ${visit.bhr_id.substring(0, 6)}`;
      visitsPerBhr[bhrName] = (visitsPerBhr[bhrName] || 0) + 1;
    });

    return Object.entries(visitsPerBhr)
      .map(([name, value], index) => ({
        name,
        value,
        fill: [ // Using a blue palette similar to CHR entity chart
          '#0E2B72',  // HDFC Navy Blue
          '#2D4B73',  // Steel Blue
          '#00A3E0',  // HDFC Light Blue
          '#1B4D89',  // Royal Blue
          '#386FA4',  // Sapphire Blue
          '#133C55',  // Deep Ocean Blue
          '#5D4E6D',  // Elegant Purple (optional, for variation)
          '#7E6B8F',  // Dusty Purple (optional)
          '#4A5859',  // Slate Gray (optional)
          '#3F4E4F'   // Charcoal (optional)
        ][index % 10], // Cycle through the 10 colors
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredVisitsData, globalTimeframe, bhrOptions, filterVisitsByTimeframe]);

  const metricsByBranchCategoryChartData = useMemo(() => {
    const visitsToProcess = filterVisitsByTimeframe(filteredVisitsData, globalTimeframe);
    if (visitsToProcess.length === 0 || allBranchesForCategoryLookup.length === 0) return { labels: [], datasets: [] };

    const branchCategoryMap = new Map(allBranchesForCategoryLookup.map(b => [b.id, b.category]));
    const categoryData: Record<string, { [key: string]: { sum: number; count: number } }> = {};
    const categoriesOrder = ['Gold', 'Silver', 'Bronze', 'Platinum', 'Diamond']; // Desired order
    const allCategories = new Set<string>();

    visitsToProcess.forEach(visit => {
      const category = branchCategoryMap.get(visit.branch_id);
      if (category) {
        allCategories.add(category);
        if (!categoryData[category]) {
          categoryData[category] = {};
          METRIC_CONFIGS.forEach(m => { categoryData[category][m.key] = { sum: 0, count: 0 }; });
        }
        METRIC_CONFIGS.forEach(m => {
          const value = visit[m.key as keyof Visit] as number | undefined;
          if (typeof value === 'number' && !isNaN(value)) {
            categoryData[category][m.key].sum += value;
            categoryData[category][m.key].count += 1;
          }
        });
      }
    });

    // Sort categories according to desired order, placing others at the end
    const sortedCategories = Array.from(allCategories).sort((a, b) => {
      const aIndex = categoriesOrder.indexOf(a);
      const bIndex = categoriesOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b); // Alphabetical for unknown
      if (aIndex === -1) return 1; // Unknown comes after known
      if (bIndex === -1) return -1; // Known comes before unknown
      return aIndex - bIndex; // Order by predefined array
    });

    const datasets = METRIC_CONFIGS.map(metric => {
      const data = sortedCategories.map(category => {
        const agg = categoryData[category]?.[metric.key];
        if (!agg || agg.count === 0) return 0; // Show 0 if no data or count is 0
        if (metric.key === 'cwt_cases') return agg.sum; // CWT is a sum
        return parseFloat((agg.sum / agg.count).toFixed(2)); // Others are averages
      });
      return {
        label: metric.label,
        data: data,
        backgroundColor: [ // Royal Blue Palette
          '#0E2B72',  // HDFC Navy Blue
          '#2D4B73',  // Steel Blue
          '#00A3E0',  // HDFC Light Blue
          '#1B4D89',  // Royal Blue
          '#386FA4',  // Sapphire Blue
          '#133C55',  // Deep Ocean Blue
          '#5D4E6D',  // Elegant Purple (optional, for variation)
          '#7E6B8F',  // Dusty Purple (optional)
          '#4A5859',  // Slate Gray (optional)
          '#3F4E4F'   // Charcoal (optional)
        ][METRIC_CONFIGS.findIndex(m => m.key === metric.key) % 10], // Cycle through the 10 colors based on metric index
        borderColor: [ // Royal Blue Palette
          '#0E2B72',  // HDFC Navy Blue
          '#2D4B73',  // Steel Blue
          '#00A3E0',  // HDFC Light Blue
          '#1B4D89',  // Royal Blue
          '#386FA4',  // Sapphire Blue
          '#133C55',  // Deep Ocean Blue
          '#5D4E6D',  // Elegant Purple (optional, for variation)
          '#7E6B8F',  // Dusty Purple (optional)
          '#4A5859',  // Slate Gray (optional)
          '#3F4E4F'   // Charcoal (optional)
        ][METRIC_CONFIGS.findIndex(m => m.key === metric.key) % 10],
        borderWidth: 1,
        // stack: 'categoryStack' // This groups bars by category - remove stack for grouped bar
      };
    });

    return { labels: sortedCategories, datasets: datasets };

  }, [filteredVisitsData, globalTimeframe, allBranchesForCategoryLookup, filterVisitsByTimeframe]);

  const handleMetricToggle = (metricKey: string) => {
    setActiveMetrics(prev => ({ ...prev, [metricKey]: !prev[metricKey] }));
  };

  const handleClearAllLocalFilters = () => {
    setSelectedBhrIds([]);
    setSelectedBranchIds([]);
    setGlobalTimeframe('past_month');
    setActiveMetrics(METRIC_CONFIGS.reduce((acc, metric, index) => ({ ...acc, [metric.key]: index < 3 }), {}));
  };

    return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <PageTitle
        title="ZHR Analytics Dashboard"
        description={`Review key metrics and trends for your BHRs and Branches. ${user?.name ? `Welcome, ${user.name}!` : ''}`}
      />

      {/* Filter Section */}
      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardContent className="space-y-6 px-4 py-4 sm:px-6 sm:py-6">
          {/* Hierarchy Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BHR Filter */}
            <div className="space-y-2 relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                    <div className="flex items-center overflow-hidden">
                      <span className="truncate">
                        {bhrOptions.length > 0 ? selectedBhrIds.length === 0 ? "All BHRs" : selectedBhrIds.length === 1 ? bhrOptions.find(opt => opt.value === selectedBhrIds[0])?.label : `${selectedBhrIds.length} BHRs Selected` : "No BHRs found"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  {bhrOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedBhrIds.includes(option.value)}
                      onCheckedChange={() => {
                        if (selectedBhrIds.includes(option.value)) {
                          setSelectedBhrIds(prev => prev.filter(id => id !== option.value));
                        } else {
                          setSelectedBhrIds(prev => [...prev, option.value]);
                        }
                      }}
                      className="capitalize"
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedBhrIds.length > 0 && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1.5 -translate-y-2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBhrIds([]); }} aria-label="Clear BHR filter">
                  <XCircle className="h-4 w-4 text-red-600 hover:text-red-700" />
                </Button>
              )}
            </div>

            {/* Branch Filter */}
            <div className="space-y-2 relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                    <div className="flex items-center overflow-hidden">
                      <span className="truncate">
                        {branchOptions.length > 0 ? selectedBranchIds.length === 0 ? "All Branches" : selectedBranchIds.length === 1 ? branchOptions.find(opt => opt.value === selectedBranchIds[0])?.label : `${selectedBranchIds.length} Branches Selected` : "No Branches found"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  {branchOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedBranchIds.includes(option.value)}
                      onCheckedChange={() => {
                        if (selectedBranchIds.includes(option.value)) {
                          setSelectedBranchIds(prev => prev.filter(id => id !== option.value));
                        } else {
                          setSelectedBranchIds(prev => [...prev, option.value]);
                        }
                      }}
                      className="capitalize"
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedBranchIds.length > 0 && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1.5 -translate-y-2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBranchIds([]); }} aria-label="Clear Branch filter">
                  <XCircle className="h-4 w-4 text-red-600 hover:text-red-700" />
                </Button>
              )}
            </div>
          </div>

          {/* Timeframe Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />Select Timeframe (Global for this page)
            </Label>
            <div className="flex items-center justify-between gap-4">
                <TimeframeButtons selectedTimeframe={globalTimeframe} onTimeframeChange={setGlobalTimeframe} />
              {(selectedBhrIds.length > 0 || selectedBranchIds.length > 0 || globalTimeframe !== 'past_month') && (
              <Button
                  variant="outline" 
                  onClick={() => {
                    setSelectedBhrIds([]);
                    setSelectedBranchIds([]);
                    setGlobalTimeframe('past_month');
                  }}
                  className="h-9 sm:h-10 bg-white border border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600 hover:text-red-600 focus:ring-1 focus:ring-offset-1 focus:ring-red-500 text-sm shadow-sm rounded-lg transition-all duration-200 flex items-center justify-center p-2 sm:px-4 shrink-0"
              >
                <XCircle className="h-4 w-4 text-red-600 sm:mr-2" /> <span className="hidden sm:inline">Clear</span>
              </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Trend Chart */}
      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><TrendingUp className="h-5 w-5" /> Metric Trends</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/90">Trendlines for selected metrics from submitted visits.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Metric Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
            {METRIC_CONFIGS.map(metric => (
              <label key={metric.key} className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  id={`metric-${metric.key}`}
                  checked={activeMetrics[metric.key]}
                  onCheckedChange={() => handleMetricToggle(metric.key)}
                  style={{ accentColor: metric.color }}
                />
                <span className="text-sm font-medium" style={{ color: metric.color }}>
                  {metric.label}
                </span>
              </label>
            ))}
          </div>

          {metricTrendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={metricTrendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(tick) => format(parseISO(tick), 'MMM d')}
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  orientation="left"
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  yAxisId="right"
                  stroke="hsl(var(--muted-foreground))"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg bg-white p-3 shadow-lg">
                          <div className="text-sm font-semibold mb-2">{format(parseISO(label), 'yyyy-MM-dd')}</div>
                          <div className="space-y-1.5">
                            {payload.map((entry, idx) => (
                              <div
                                key={entry.dataKey || idx}
                                className="flex justify-between items-center text-sm"
                              >
                                <span className="flex items-center">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  {entry.name}
                                </span>
                                <span className="text-muted-foreground ml-4">
                                  {entry.value !== null ? `${entry.value}${METRIC_CONFIGS.find(m => m.label === entry.name)?.key.toString().includes('percentage') ? '%' : ''}` : 'N/A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {METRIC_CONFIGS.map(metric => activeMetrics[metric.key] && (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key.toString()}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2}
                    yAxisId={metric.yAxisId || 'left'}
                    connectNulls
                    dot={{ r: 3, fill: metric.color, stroke: 'white', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: metric.color, stroke: 'white', strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="shadow-lg flex items-center justify-center min-h-[300px]">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="mx-auto h-12 w-12 mb-2" />
                <div className="text-lg font-semibold text-slate-700 mb-1.5">No Metric Data</div>
                <div className="text-sm text-slate-500 max-w-xs">Try adjusting your filters or check if data has been submitted for the selected criteria.</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics by Branch Category Chart */}
      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><BarChartBig className="h-5 w-5" />Metrics by Branch Category</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/90">Comparison of key metrics across different branch categories, reflecting all active filters and the global timeframe.</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsByBranchCategoryChartData.labels.length > 0 ? (
            <div className="relative w-full h-[400px] p-4">
              <Bar
                data={metricsByBranchCategoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                  },
                  plugins: {
                    legend: {
                      display: true, // Show legend for metrics
                      position: 'top',
                      labels: {
                        color: '#666', // Legend text color
                        font: {
                          size: 12
                        }
                      }
                    },
                    tooltip: {
                      backgroundColor: '#0E2B72', // Example color from VHR
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
                      displayColors: true,
                      callbacks: {
                        label: (context) => {
                          const label = context.dataset.label || '';
                          const value = context.parsed.y;
                          // Find the corresponding metric config to check if it's a percentage
                          const metricConfig = METRIC_CONFIGS.find(m => m.label === label);
                          const isPercentage = metricConfig?.key.toString().includes('percentage');
                          return `${label}: ${value}${isPercentage ? '%' : ''}`;
                        },
                        title: (items) => items[0].label // Category name
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
                      type: 'linear' as const,
                      position: 'left' as const,
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
                        callback: function (value) { return typeof value === 'number' ? Math.round(value).toString() : value + '%' }
                      },
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Percentage (%)',
                        color: '#666666',
                        font: { size: 12, weight: 'bold' }
                      },
                      max: 100 // Assuming percentage metrics don't exceed 100
                    },
                     y1: { // Second Y-axis for CWT Cases
                      type: 'linear' as const,
                      position: 'right' as const,
                      grid: {
                        drawOnChartArea: false, // Only draw grid lines for the left Y-axis
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
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'CWT Cases',
                        color: '#666666',
                        font: { size: 12, weight: 'bold' }
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="shadow-lg flex items-center justify-center min-h-[300px]">
              <div className="text-center text-muted-foreground">
                <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                <div className="text-lg font-semibold text-slate-700 mb-1.5">No metric data by branch category to display.</div>
                <div className="text-sm text-slate-500 max-w-xs">Try adjusting filters or check if data has been submitted for the selected criteria.</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4x4 Grid for other charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Qualitative Assessment Chart */}
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><ShieldQuestion className="h-5 w-5" />Qualitative Assessment</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">Average scores for qualitative questions from submitted visits (0-5 scale), reflecting all active filters and the global timeframe.</CardDescription>
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
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 12,
                      fontWeight: 500
                    }}
                    axisLine={{ stroke: 'hsl(var(--border)/0.7)' }}
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
                  <RechartsTooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const entry = payload[0]; // Get the first (and usually only) data entry for the hovered point
                        const data = entry.payload; // Access the original data point object
                        return (
                          <div className="rounded-lg bg-white p-3 shadow-lg">
                            <div className="text-base font-semibold mb-2">{data.subject}</div>
                            <div
                              key={entry.name}
                              className="flex items-center gap-2 text-sm"
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
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {QUALITATIVE_QUESTIONS_CONFIG.map((config) => (
                    <Radar
                      key={config.key}
                      dataKey="score"
                      name={config.label}
                      stroke={config.color}
                      fill={config.color}
                      fillOpacity={0.15}
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
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <ShieldQuestion className="mx-auto h-12 w-12 mb-2" />
                  <p>No qualitative data to display.</p>
                  <p className="text-xs">Try adjusting filters.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Structure Chart */}
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><Users className="h-5 w-5" /> Visits by Team Structure</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">Distribution of submitted visits across BHRs reporting to you, reflecting active filters.</CardDescription>
          </CardHeader>
          <CardContent>
            {visitsByEntityChartData.length > 0 ? (
              <div className="relative w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const totalVisits = visitsByEntityChartData.reduce((sum, item) => sum + item.value, 0);
                          return (
                            <div className="rounded-lg bg-white p-3 shadow-lg">
                              <div className="text-base font-semibold mb-1">{data.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {data.value} visits ({((data.value / totalVisits) * 100).toFixed(1)}%)
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Pie
                      data={visitsByEntityChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                    >
                      {visitsByEntityChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fill}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {visitsByEntityChartData.reduce((sum, item) => sum + item.value, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Visits</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-2" />
                  <div className="text-lg font-semibold text-slate-700 mb-1.5">No visit data by BHR to display.</div>
                  <div className="text-sm text-slate-500 max-w-xs">Try adjusting filters.</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branch Category Distribution Chart */}
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
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
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
                            fill={categoryColors[entry.name.toLowerCase() as keyof typeof categoryColors] || '#4A5859'}
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
              <div className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <PieChartIcon className="mx-auto h-12 w-12 mb-2" />
                <div className="text-lg font-semibold text-slate-700 mb-1.5">No Category Data</div>
                <div className="text-sm text-slate-500 max-w-xs">No visit data found for branch categories under the current filter combination.</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Branches by Visits Chart */}
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><BarChartBig className="h-5 w-5" />Top Branches by Visits</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">Branches with the most submitted HR visits.</CardDescription>
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
                          const colors = [ // Using a blue palette similar to CHR top branches
                            '#0E2B72',  // HDFC Navy Blue
                            '#2D4B73',  // Steel Blue
                            '#00A3E0',  // HDFC Light Blue
                            '#1B4D89',  // Royal Blue
                            '#386FA4',  // Sapphire Blue
                            '#133C55',  // Deep Ocean Blue
                            '#5D4E6D',  // Elegant Purple (optional, for variation)
                            '#7E6B8F',  // Dusty Purple (optional)
                            '#4A5859',  // Slate Gray (optional)
                            '#3F4E4F'   // Charcoal (optional)
                          ];
                          return colors[index % colors.length];
                        },
                        hoverBackgroundColor: (context) => {
                          const index = context.dataIndex;
                          const colors = [ // Using a lighter blue palette for hover
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
                        backgroundColor: '#0E2B72', // Consistent tooltip style
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
                          label: (context) => `${Math.round(context.parsed.y as number)} visits`,
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
              <div className="shadow-lg flex items-center justify-center min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                <p className="text-lg font-semibold text-slate-700 mb-1.5">No Branch Visit Data</p>
                <p className="text-sm text-slate-500 max-w-xs">No data available for top branches by visits with the current filters.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}