'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, RadarChart, PieChart, Pie, Cell, BarChart, Bar as RechartsBar } from 'recharts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, ShieldQuestion, Target, PieChart as PieChartIcon, BarChartBig, Filter as FilterIcon, ChevronsUpDown, XCircle, CalendarDays } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartJSTitle,
  Tooltip as ChartJSTooltip,
  Legend as ChartJSLegend,
  ChartData as ChartJSData,
  ChartOptions as ChartJSOptions,
  TooltipItem,
  ChartType
} from 'chart.js/auto';

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

export default function CHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    selectedVhrIds: globalSelectedVhrIds, vhrOptions: globalVhrOptions,
    setSelectedVhrIds,
    allUsersForContext, isLoadingAllUsers 
  } = useChrFilter();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  
  const [allSubmittedVisitsGlobal, setAllSubmittedVisitsGlobal] = useState<Visit[]>([]);
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
    METRIC_CONFIGS.reduce((acc, metric, index) => ({ ...acc, [metric.key]: index < 3 }), {})
  );
  
  const [globalTimeframe, setGlobalTimeframe] = useState<TimeframeKey>('past_month');


  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchData = async () => {
        if (isLoadingAllUsers) return; 
        setIsLoadingPageData(true);
        try {
          const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name, category, location, code');
          if (branchesError) throw branchesError;
          setAllBranchesGlobal(branchesData || []);
          setBranchOptions((branchesData || []).map(b => ({ value: b.id, label: `${b.name} (${b.code})` }))); 
          setIsLoadingBranchOptions(false);

          const { data: visitsData, error: visitsError } = await supabase
            .from('visits')
            .select('id, bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases, qual_aligned_conduct, qual_safe_secure, qual_motivated, qual_abusive_language, qual_comfortable_escalate, qual_inclusive_culture')
            .eq('status', 'submitted');
          if (visitsError) throw visitsError;
          setAllSubmittedVisitsGlobal(visitsData || []);

        } catch (error: any) {
          console.error("CHR Analytics: Error fetching page data (branches/visits):", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
        } finally {
          setIsLoadingPageData(false);
        }
      };
      fetchData();
    } else {
      setIsLoadingPageData(false);
    }
  }, [user, toast, isLoadingAllUsers]);

  useEffect(() => {
    setIsLoadingZhrOptions(true);
    if (allUsersForContext.length > 0) {
      let potentialZhrs = allUsersForContext.filter(u => u.role === 'ZHR');
      if (globalSelectedVhrIds.length > 0) {
        potentialZhrs = potentialZhrs.filter(zhr => zhr.reports_to && globalSelectedVhrIds.includes(zhr.reports_to));
      }
      setZhrOptions(potentialZhrs.map(z => ({ value: z.id, label: z.name })));
    } else {
      setZhrOptions([]);
    }
    setSelectedZhrIds([]); 
    setIsLoadingZhrOptions(false);
  }, [globalSelectedVhrIds, allUsersForContext]);

  useEffect(() => {
    setIsLoadingBhrOptions(true);
    if (allUsersForContext.length > 0) {
      let potentialBhrs = allUsersForContext.filter(u => u.role === 'BHR');
      if (selectedZhrIds.length > 0) {
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
      } else if (globalSelectedVhrIds.length > 0) { 
        const zhrsUnderSelectedVhrs = allUsersForContext
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
  }, [selectedZhrIds, globalSelectedVhrIds, allUsersForContext]);
  
  useEffect(() => {
    setSelectedBranchIds([]);
  }, [selectedBhrIds, selectedZhrIds, globalSelectedVhrIds]);


  const filteredVisitsData = useMemo(() => {
    let visits = allSubmittedVisitsGlobal;
    
    let relevantBhrIds = new Set<string>();

    if (selectedBhrIds.length > 0) {
        selectedBhrIds.forEach(id => relevantBhrIds.add(id));
    } else if (selectedZhrIds.length > 0) {
        allUsersForContext
            .filter(u => u.role === 'BHR' && u.reports_to && selectedZhrIds.includes(u.reports_to))
            .forEach(b => relevantBhrIds.add(b.id));
    } else if (globalSelectedVhrIds.length > 0) {
        const zhrsInSelectedVhrs = allUsersForContext
            .filter(u => u.role === 'ZHR' && u.reports_to && globalSelectedVhrIds.includes(u.reports_to))
            .map(z => z.id);
        allUsersForContext
            .filter(u => u.role === 'BHR' && u.reports_to && zhrsInSelectedVhrs.includes(u.reports_to))
            .forEach(b => relevantBhrIds.add(b.id));
    } else {
        allUsersForContext.filter(u => u.role === 'BHR').forEach(b => relevantBhrIds.add(b.id));
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

  const filterVisitsByTimeframe = (visits: Visit[], timeframe: TimeframeKey): Visit[] => {
      const today = new Date();
      let startDate: Date | null = null;

    switch (timeframe) {
        case 'past_week':
          startDate = subDays(today, 7);
          break;
        case 'past_month':
          startDate = subMonths(today, 1);
          break;
        case 'last_3_months':
          startDate = subMonths(today, 3);
          break;
        case 'last_6_months':
          startDate = subMonths(today, 6);
          break;
        case 'last_year':
          startDate = subYears(today, 1);
          break;
        case 'last_3_years':
          startDate = subYears(today, 3);
          break;
        default:
          return visits;
      }
    
    return visits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
        return isValid(visitDate) && isWithinInterval(visitDate, { start: startDate!, end: today });
    });
  };

    return filterVisitsByTimeframe(visits, globalTimeframe);

  }, [allSubmittedVisitsGlobal, allUsersForContext, selectedBhrIds, selectedZhrIds, globalSelectedVhrIds, selectedBranchIds, globalTimeframe]);


  const metricTrendChartData = useMemo(() => {
    const filteredByAllSelections = filteredVisitsData;
    if (filteredByAllSelections.length === 0) return [];
    const aggregatedData: Record<string, { [key: string]: { sum: number; count: number } }> = {};
    let minDate = new Date();
    let maxDate = new Date(1970, 0, 1);

    filteredByAllSelections.forEach(visit => {
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
    if (filteredByAllSelections.length === 0 || !isValid(minDate) || !isValid(maxDate) || minDate > maxDate) return [];
    
    let dateRangeForChart: Date[] = [];
    try {
       dateRangeForChart = eachDayOfInterval({ start: startOfDay(minDate), end: endOfDay(maxDate) });
    } catch (e) { 
      console.error("Error in eachDayOfInterval for CHR chart:", e);
      return [];
    }
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
    const filteredByAllSelections = filteredVisitsData;
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
    const filteredByAllSelections = filteredVisitsData;
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
    const filteredByAllSelections = filteredVisitsData;
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
  
  const selectedHierarchyDetailsText = useMemo(() => {
    let name = "Global";
    let descriptionSuffix = "across all verticals";

    if (globalSelectedVhrIds.length > 0) {
      if (globalSelectedVhrIds.length === 1) {
        const vhr = globalVhrOptions.find(opt => opt.value === globalSelectedVhrIds[0]);
        name = vhr ? vhr.label : "Selected Vertical";
      } else {
        name = `${globalSelectedVhrIds.length} Verticals`;
      }
      descriptionSuffix = `for the selected vertical(s)`;
    } else if (selectedZhrIds.length > 0) {
      if (selectedZhrIds.length === 1) {
        const zhr = zhrOptions.find(opt => opt.value === selectedZhrIds[0]);
        name = zhr ? zhr.label : "Selected ZHR";
      } else {
        name = `${selectedZhrIds.length} ZHRs`;
      }
      descriptionSuffix = `for the selected ZHR(s)`;
    } else if (selectedBhrIds.length > 0) {
      if (selectedBhrIds.length === 1) {
        const bhr = bhrOptions.find(opt => opt.value === selectedBhrIds[0]);
        name = bhr ? bhr.label : "Selected BHR";
      } else {
        name = `${selectedBhrIds.length} BHRs`;
      }
      descriptionSuffix = `for the selected BHR(s)`;
    } else if (selectedBranchIds.length > 0) {
      if (selectedBranchIds.length === 1) {
        const branch = branchOptions.find(opt => opt.value === selectedBranchIds[0]);
        name = branch ? branch.label : "Selected Branch";
      } else {
        name = `${selectedBranchIds.length} Branches`;
      }
      descriptionSuffix = `for the selected branch(es)`;
    }

    return { name, descriptionSuffix };
  }, [globalSelectedVhrIds, globalVhrOptions, selectedZhrIds, zhrOptions, selectedBhrIds, bhrOptions, selectedBranchIds, branchOptions]);


  const visitsByEntityChartData = useMemo(() => {
    if (isLoadingAllUsers) return [];

    let visitsToProcess = filteredVisitsData;
    let entityNameMap = new Map<string, string>();

    // Determine which level of hierarchy to display based on filters
    // If ZHRs are selected, show visits per selected ZHRs (or all ZHRs under selected VHRs if no specific ZHRs are selected)
    // If no ZHRs selected but VHRs are selected, show visits per selected VHRs
    // If no VHRs selected, show visits per top-level VHRs globally

    const bhrToZhrMap = new Map(allUsersForContext.filter(u => u.role === 'BHR' && u.reports_to).map(u => [u.id, u.reports_to!]));
    const zhrToVhrMap = new Map(allUsersForContext.filter(u => u.role === 'ZHR' && u.reports_to).map(u => [u.id, u.reports_to!]));

    const visitsPerEntity: Record<string, number> = {};

    if (selectedZhrIds.length > 0) {
      // Show visits per selected BHRs under selected ZHRs (if any BHR filter is applied)
      // or visits per selected ZHRs (if no BHR filter)
      const targetZhrIds = new Set(selectedZhrIds);
      visitsToProcess.forEach(visit => {
        const zhrId = bhrToZhrMap.get(visit.bhr_id);
        if (zhrId && targetZhrIds.has(zhrId)) {
          const entityName = allUsersForContext.find(u => u.id === zhrId)?.name || `ZHR ID: ${zhrId.substring(0, 6)}`;
          visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
        }
      });

    } else if (globalSelectedVhrIds.length > 0) {
      // Show visits per ZHR under selected VHRs
      const targetVhrIds = new Set(globalSelectedVhrIds);
      allUsersForContext.filter(u => u.role === 'ZHR' && u.reports_to && targetVhrIds.has(u.reports_to)).forEach(zhr => entityNameMap.set(zhr.id, zhr.name));

      visitsToProcess.forEach(visit => {
        const zhrId = bhrToZhrMap.get(visit.bhr_id);
        if (zhrId && entityNameMap.has(zhrId)) {
          const entityName = entityNameMap.get(zhrId) || `ZHR ID: ${zhrId.substring(0, 6)}`;
          visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
        }
      });

    } else {
      // Show visits per VHR globally
      allUsersForContext.filter(u => u.role === 'VHR').forEach(vhr => entityNameMap.set(vhr.id, vhr.name));
      visitsToProcess.forEach(visit => {
        const zhrId = bhrToZhrMap.get(visit.bhr_id);
        if (zhrId) {
          const vhrId = zhrToVhrMap.get(zhrId);
          if (vhrId && entityNameMap.has(vhrId)) {
            const entityName = entityNameMap.get(vhrId) || `VHR ID: ${vhrId.substring(0, 6)}`;
            visitsPerEntity[entityName] = (visitsPerEntity[entityName] || 0) + 1;
          }
        }
      });
    }

    return Object.entries(visitsPerEntity).map(([name, value], index) => ({
      name,
      value,
      fill: [ // Royal Blue Palette
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
    })).sort((a, b) => b.value - a.value);
  }, [allUsersForContext, filteredVisitsData, selectedZhrIds, globalSelectedVhrIds, isLoadingAllUsers]);

  const metricsByBranchCategoryChartData = useMemo(() => {
    const visitsToProcess = filteredVisitsData;
    if (visitsToProcess.length === 0 || allBranchesGlobal.length === 0) return { labels: [], datasets: [] };

    const branchCategoryMap = new Map(allBranchesGlobal.map(b => [b.id, b.category]));
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
          const value = visit[m.key] as number | undefined;
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

  }, [filteredVisitsData, allBranchesGlobal]);

  const isLoading = isLoadingAllUsers || isLoadingPageData || isLoadingZhrOptions || isLoadingBhrOptions || isLoadingBranchOptions;

  if (isLoading && user?.role === 'CHR') {
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
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageTitle title={`CHR Analytics (${selectedHierarchyDetailsText.name})`} description={`Deep dive into analytics ${selectedHierarchyDetailsText.descriptionSuffix}.`} />
        
        {/* VHR Filter */}
        <div className="w-full sm:w-auto relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[200px] h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                <div className="flex items-center overflow-hidden">
                  <span className="truncate">
                    {globalVhrOptions.length > 0 ? globalSelectedVhrIds.length === 0 ? "All VHRs" : globalSelectedVhrIds.length === 1 ? globalVhrOptions.find(opt => opt.value === globalSelectedVhrIds[0])?.label : `${globalSelectedVhrIds.length} VHRs Selected` : isLoadingAllUsers ? "Loading VHRs..." : "No VHRs found"}
                  </span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
              {globalVhrOptions.length === 0 && !isLoadingAllUsers && <DropdownMenuLabel>No VHRs found</DropdownMenuLabel>}
              {isLoadingAllUsers && <DropdownMenuLabel className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading VHRs...</DropdownMenuLabel>}
              {globalVhrOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={globalSelectedVhrIds.includes(option.value)}
                  onCheckedChange={() => {
                    if (globalSelectedVhrIds.includes(option.value)) {
                      setSelectedVhrIds(globalSelectedVhrIds.filter(id => id !== option.value));
                    } else {
                      setSelectedVhrIds([...globalSelectedVhrIds, option.value]);
                    }
                  }}
                  className="capitalize"
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {globalSelectedVhrIds.length > 0 && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedVhrIds([]); }} aria-label="Clear VHR filter">
              <XCircle className="h-4 w-4 text-red-600 hover:text-red-700" />
            </Button>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardContent className="space-y-6">
          {/* Hierarchy Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ZHR Filter */}
            <div className="space-y-2 relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                    <div className="flex items-center overflow-hidden">
                      <span className="truncate">
                        {zhrOptions.length > 0 ? selectedZhrIds.length === 0 ? "All ZHRs" : selectedZhrIds.length === 1 ? zhrOptions.find(opt => opt.value === selectedZhrIds[0])?.label : `${selectedZhrIds.length} ZHRs Selected` : isLoadingZhrOptions ? "Loading ZHRs..." : "No ZHRs found"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  {zhrOptions.length === 0 && !isLoadingZhrOptions && <DropdownMenuLabel>No ZHRs found</DropdownMenuLabel>}
                  {isLoadingZhrOptions && <DropdownMenuLabel className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading ZHRs...</DropdownMenuLabel>}
                  {zhrOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedZhrIds.includes(option.value)}
                      onCheckedChange={() => {
                        if (selectedZhrIds.includes(option.value)) {
                          setSelectedZhrIds((prev: string[]) => prev.filter((id: string) => id !== option.value));
                        } else {
                          setSelectedZhrIds((prev: string[]) => [...prev, option.value]);
                        }
                      }}
                      className="capitalize"
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedZhrIds.length > 0 && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedZhrIds([]); }} aria-label="Clear ZHR filter">
                  <XCircle className="h-4 w-4 text-red-600 hover:text-red-700" />
                  </Button>
              )}
            </div>

            {/* BHR Filter */}
            <div className="space-y-2 relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full h-9 sm:h-10 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm shadow-sm focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 rounded-lg transition-all duration-200 flex items-center justify-between text-left pl-3 pr-10">
                    <div className="flex items-center overflow-hidden">
                      <span className="truncate">
                        {bhrOptions.length > 0 ? selectedBhrIds.length === 0 ? "All BHRs" : selectedBhrIds.length === 1 ? bhrOptions.find(opt => opt.value === selectedBhrIds[0])?.label : `${selectedBhrIds.length} BHRs Selected` : isLoadingBhrOptions ? "Loading BHRs..." : "No BHRs found"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  {bhrOptions.length === 0 && !isLoadingBhrOptions && <DropdownMenuLabel>No BHRs found</DropdownMenuLabel>}
                  {isLoadingBhrOptions && <DropdownMenuLabel className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading BHRs...</DropdownMenuLabel>}
                  {bhrOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBhrIds.includes(option.value)}
                      onCheckedChange={() => {
                        if (selectedBhrIds.includes(option.value)) {
                          setSelectedBhrIds((prev: string[]) => prev.filter((id: string) => id !== option.value));
                        } else {
                          setSelectedBhrIds((prev: string[]) => [...prev, option.value]);
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
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBhrIds([]); }} aria-label="Clear BHR filter">
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
                        {branchOptions.length > 0 ? selectedBranchIds.length === 0 ? "All Branches" : selectedBranchIds.length === 1 ? branchOptions.find(opt => opt.value === selectedBranchIds[0])?.label : `${selectedBranchIds.length} Branches Selected` : isLoadingBranchOptions ? "Loading Branches..." : "No Branches found"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  {branchOptions.length === 0 && !isLoadingBranchOptions && <DropdownMenuLabel>No Branches found</DropdownMenuLabel>}
                  {isLoadingBranchOptions && <DropdownMenuLabel className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Branches...</DropdownMenuLabel>}
                  {branchOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBranchIds.includes(option.value)}
                      onCheckedChange={() => {
                        if (selectedBranchIds.includes(option.value)) {
                          setSelectedBranchIds((prev: string[]) => prev.filter((id: string) => id !== option.value));
                        } else {
                          setSelectedBranchIds((prev: string[]) => [...prev, option.value]);
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
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBranchIds([]); }} aria-label="Clear Branch filter">
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
              {(selectedZhrIds.length > 0 || selectedBhrIds.length > 0 || selectedBranchIds.length > 0 || globalTimeframe !== 'past_month') && (
          <Button 
            variant="outline" 
                  onClick={() => {
                    setSelectedZhrIds([]);
                    setSelectedBhrIds([]);
                    setSelectedBranchIds([]);
                    setGlobalTimeframe('past_month');
                  }}
                  className="h-9 sm:h-10 bg-white border border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600 focus:ring-1 focus:ring-offset-1 focus:ring-red-500 text-sm shadow-sm rounded-lg transition-all duration-200 flex items-center justify-center p-2 sm:px-4 shrink-0">
                  <XCircle className="h-4 w-4 text-red-600 sm:mr-2" /> <span className="hidden sm:inline">Clear</span>
          </Button>
              )}
            </div>
          </div>



        </CardContent>
      </Card>

      {/* Metric Trends Chart Section */}
      <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><TrendingUp className="h-5 w-5" /> Metric Trends</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/90">Trendlines for selected metrics from submitted visits, reflecting all active filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {METRIC_CONFIGS.map(metric => (
              <label key={metric.key} className="flex items-center space-x-2 cursor-pointer">
                <Checkbox id={`metric-chr-${metric.key}`} checked={activeMetrics[metric.key]} onCheckedChange={() => setActiveMetrics(prev => ({ ...prev, [metric.key]: !prev[metric.key] }))} style={{ accentColor: metric.color } as React.CSSProperties} />
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
                                <span className="text-muted-foreground ml-4">{entry.value}{METRIC_CONFIGS.find(m => m.label === entry.name)?.key.toString().includes('percentage') ? '%' : ''}</span>
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
                 {METRIC_CONFIGS.map(metric => activeMetrics[metric.key] && (
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
                      backgroundColor: '#004C8F', // Example color from VHR
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

      {/* Group Qualitative Assessment, Submitted Visits by Entity, and Branch Specific Charts into 2x2 Grid on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Qualitative Assessment Chart Section */}
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><Target className="h-5 w-5"/>Qualitative Assessment</CardTitle>
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

        {/* Submitted Visits by Entity Chart */}
        <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
                <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><BarChartBig className="h-5 w-5" />Team Structure</CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90">
              Total submitted visits, reflecting current filters.
            </CardDescription>
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
                     labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                   >
                     {visitsByEntityChartData.map((entry, index) => (
                       <Cell
                         key={`cell-${index}`}
                         fill={entry.fill}
                         stroke="none"
                         strokeWidth={0}
                       />
                     ))}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="text-center">
                   <div className="text-3xl font-bold text-primary cursor-help group relative"
                        title={`Total visits across ${visitsByEntityChartData.length} entities`}
                   >
                     {visitsByEntityChartData.reduce((sum, item) => sum + item.value, 0)}
                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white rounded-lg shadow-lg text-sm font-normal text-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                       Total visits across {visitsByEntityChartData.length} entities
                     </div>
                   </div>
                   <div className="text-sm text-muted-foreground">Total Visits</div>
                 </div>
               </div>
             </div>
           ) : (
             <div className="shadow-lg flex items-center justify-center min-h-[300px]">
               <div className="text-center text-muted-foreground">
                 <BarChartBig className="mx-auto h-12 w-12 mb-2" />
                 <div className="text-lg font-semibold text-slate-700 mb-1.5">No visit data to display for {selectedHierarchyDetailsText.name}.</div>
                 <div className="text-sm text-slate-500 max-w-xs">Try adjusting filters.</div>
               </div>
             </div>
           )}
         </CardContent>
       </Card>

        {/* Branch Specific Charts */}
        {showBranchSpecificCharts ? (
          <>
            {/* Branch Category Visits Chart */}
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
                        <div className="text-3xl font-bold text-primary cursor-help group relative"
                             title={`Total visits across ${branchCategoryPieChartData.length} categories`}
                          >
                          {branchCategoryPieChartData.reduce((sum, item) => sum + item.value, 0)}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-white rounded-lg shadow-lg text-sm font-normal text-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            Total visits across {branchCategoryPieChartData.length} categories
                          </div>
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

            {/* Top Branches by Visits Chart */}
            <Card className="shadow-lg border-slate-200/50 hover:shadow-xl transition-shadow duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-[#004C8F]"><BarChartBig className="h-5 w-5" />Top Branches by Visits</CardTitle>
                <CardDescription className="text-sm text-muted-foreground/90">Branches with the most submitted HR visits, reflecting current filters and global timeframe (hidden if specific branches are selected).</CardDescription>
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
                      } as ChartJSOptions<'bar'>}
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
          </>
        ) : null}
          </div>
    </div>
  );
}
    

    
