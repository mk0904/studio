
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, RadarChart } from 'recharts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, CalendarDays, ShieldQuestion, Target, PieChart as PieChartIcon } from 'lucide-react';
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
import type { ChartData } from '@/types';


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

type ChartDataPoint = {
  date: string;
  [key: string]: any;
};

interface QualitativeQuestionConfig {
    key: keyof Visit;
    label: string;
    positiveIsYes: boolean;
}

const QUALITATIVE_QUESTIONS_CONFIG: QualitativeQuestionConfig[] = [
    { key: 'qual_aligned_conduct', label: 'Leaders Aligned with Code', positiveIsYes: true },
    { key: 'qual_safe_secure', label: 'Employees Feel Safe', positiveIsYes: true },
    { key: 'qual_motivated', label: 'Employees Feel Motivated', positiveIsYes: true },
    { key: 'qual_abusive_language', label: 'Leaders Use Abusive Language', positiveIsYes: false },
    { key: 'qual_comfortable_escalate', label: 'Comfortable with Escalation', positiveIsYes: true },
    { key: 'qual_inclusive_culture', label: 'Inclusive Culture', positiveIsYes: true },
];

type SpiderChartDataPoint = {
    subject: string;
    score: number;
    fullMark: number;
};

// Helper component for Timeframe Buttons
interface TimeframeButtonsProps {
  selectedTimeframe: TimeframeKey;
  onTimeframeChange: (timeframe: TimeframeKey) => void;
}

const TimeframeButtons: React.FC<TimeframeButtonsProps> = ({ selectedTimeframe, onTimeframeChange }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {TIMEFRAME_OPTIONS.map(tf => (
        <Button
          key={tf.key}
          variant={selectedTimeframe === tf.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTimeframeChange(tf.key)}
        >
          {tf.label}
        </Button>
      ))}
    </div>
  );
};


export default function ZHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [allZoneVisits, setAllZoneVisits] = useState<Visit[]>([]);
  const [allBranchesForCategoryLookup, setAllBranchesForCategoryLookup] = useState<Pick<Branch, 'id' | 'category'>[]>([]);
  
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
    METRIC_CONFIGS.reduce((acc, metric) => ({ ...acc, [metric.key]: metric.key === 'manning_percentage' }), {})
  );

  // Separate timeframe states for each chart
  const [trendlineTimeframe, setTrendlineTimeframe] = useState<TimeframeKey>('past_month');
  const [spiderChartTimeframe, setSpiderChartTimeframe] = useState<TimeframeKey>('past_month');
  const [categoryPieChartTimeframe, setCategoryPieChartTimeframe] = useState<TimeframeKey>('past_month');


  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const fetchData = async () => {
        console.log("ZHR Analytics: fetchData initiated");
        setIsLoading(true);
        try {
          const { data: bhrUsersData, error: bhrError } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'BHR')
            .eq('reports_to', user.id);

          if (bhrError) throw bhrError;
          const bhrIds = (bhrUsersData || []).map(bhr => bhr.id);

          if (bhrIds.length === 0) {
            setAllZoneVisits([]);
            setAllBranchesForCategoryLookup([]);
            setIsLoading(false);
            console.log("ZHR Analytics: No BHRs found for this ZHR.");
            return;
          }

          // Fetch visits
          const { data: visitsData, error: visitsError } = await supabase
            .from('visits')
            .select('branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases, qual_aligned_conduct, qual_safe_secure, qual_motivated, qual_abusive_language, qual_comfortable_escalate, qual_inclusive_culture')
            .in('bhr_id', bhrIds)
            .eq('status', 'submitted');

          if (visitsError) throw visitsError;
          console.log("ZHR Analytics: Raw visitsData fetched from Supabase:", visitsData);
          setAllZoneVisits(visitsData || []);

          // Fetch branches for category lookup
          const { data: branchesData, error: branchesError } = await supabase
            .from('branches')
            .select('id, category');

          if (branchesError) {
            console.error("ZHR Analytics: Error fetching branches for category lookup:", branchesError);
            toast({ title: "Error", description: `Failed to load branch categories: ${branchesError.message}`, variant: "destructive" });
          } else {
            setAllBranchesForCategoryLookup(branchesData || []);
            console.log("ZHR Analytics: Fetched branches for category lookup:", branchesData);
          }

        } catch (error: any) {
          console.error("ZHR Analytics: Error fetching data:", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
          setAllZoneVisits([]);
          setAllBranchesForCategoryLookup([]);
        } finally {
          setIsLoading(false);
          console.log("ZHR Analytics: fetchData finished");
        }
      };
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  const chartDisplayData = useMemo(() => {
    if (allZoneVisits.length === 0) return [];
    console.log("ZHR Analytics - Trend Data: Processing allZoneVisits for trend chart. Count:", allZoneVisits.length, "Selected Timeframe:", trendlineTimeframe);

    const now = new Date();
    let startDateFilter: Date;
    const endDateFilter: Date = endOfDay(now);

    switch (trendlineTimeframe) {
      case 'past_week': startDateFilter = startOfDay(subDays(now, 6)); break;
      case 'past_month': startDateFilter = startOfDay(subMonths(now, 1)); break;
      case 'last_3_months': startDateFilter = startOfDay(subMonths(now, 3)); break;
      case 'last_6_months': startDateFilter = startOfDay(subMonths(now, 6)); break;
      case 'last_year': startDateFilter = startOfDay(subYears(now, 1)); break;
      case 'last_3_years': startDateFilter = startOfDay(subYears(now, 3)); break;
      default: startDateFilter = startOfDay(subMonths(now, 1));
    }

    if (!isValid(startDateFilter) || !isValid(endDateFilter) || startDateFilter > endDateFilter) {
        console.warn("ZHR Analytics - Trend Data: Invalid date range for filtering.", {startDateFilter, endDateFilter});
        return [];
    }

    const filteredVisits = allZoneVisits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      return isValid(visitDate) && isWithinInterval(visitDate, { start: startDateFilter, end: endDateFilter });
    });
    console.log("ZHR Analytics - Trend Data: Filtered visits for trend chart. Count:", filteredVisits.length);

    if (filteredVisits.length === 0) return [];

    const aggregatedData: Record<string, { [key: string]: { sum: number; count: number } }> = {};

    filteredVisits.forEach(visit => {
      const day = format(parseISO(visit.visit_date), 'yyyy-MM-dd');
      if (!aggregatedData[day]) {
        aggregatedData[day] = {};
        METRIC_CONFIGS.forEach(m => {
          aggregatedData[day][m.key] = { sum: 0, count: 0 };
        });
      }

      METRIC_CONFIGS.forEach(m => {
        const value = visit[m.key] as number | undefined;
        if (typeof value === 'number' && !isNaN(value)) {
          aggregatedData[day][m.key].sum += value;
          aggregatedData[day][m.key].count += 1;
        }
      });
    });

    let dateRangeForChart: Date[] = [];
    try {
        dateRangeForChart = eachDayOfInterval({ start: startDateFilter, end: endDateFilter });
    } catch (e) {
        console.error("ZHR Analytics - Trend Data: Error creating date interval for chart:", e, {startDateFilter, endDateFilter});
        return [];
    }

    const trendChartData = dateRangeForChart.map(dayDate => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const dayData = aggregatedData[dayKey];
      const point: ChartDataPoint = { date: dayKey };

      METRIC_CONFIGS.forEach(m => {
        if (dayData && dayData[m.key] && dayData[m.key].count > 0) {
          if (m.key === 'cwt_cases') {
            point[m.key] = dayData[m.key].sum;
          } else {
            point[m.key] = parseFloat((dayData[m.key].sum / dayData[m.key].count).toFixed(2));
          }
        }
      });
      return point;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    console.log("ZHR Analytics - Trend Data: Final trendChartData. Count:", trendChartData.length, "First item:", trendChartData[0]);
    return trendChartData;

  }, [allZoneVisits, trendlineTimeframe]);


  const qualitativeDataForSpiderChart = useMemo(() => {
    if (allZoneVisits.length === 0) {
        console.log("ZHR Analytics - Spider Data: allZoneVisits is empty, returning empty spider data.");
        return [];
    }
    console.log("ZHR Analytics - Spider Data: Processing allZoneVisits for spider chart. Count:", allZoneVisits.length, "Selected Timeframe:", spiderChartTimeframe);

    const now = new Date();
    let startDateFilter: Date;
    const endDateFilter: Date = endOfDay(now);

    switch (spiderChartTimeframe) {
        case 'past_week': startDateFilter = startOfDay(subDays(now, 6)); break;
        case 'past_month': startDateFilter = startOfDay(subMonths(now, 1)); break;
        case 'last_3_months': startDateFilter = startOfDay(subMonths(now, 3)); break;
        case 'last_6_months': startDateFilter = startOfDay(subMonths(now, 6)); break;
        case 'last_year': startDateFilter = startOfDay(subYears(now, 1)); break;
        case 'last_3_years': startDateFilter = startOfDay(subYears(now, 3)); break;
        default: startDateFilter = startOfDay(subMonths(now, 1));
    }

    if (!isValid(startDateFilter) || !isValid(endDateFilter) || startDateFilter > endDateFilter) {
      console.warn("ZHR Analytics - Spider Data: Invalid date range for qualitative filtering.", {startDateFilter, endDateFilter});
      return [];
    }

    const filteredVisitsForQualitative = allZoneVisits.filter(visit => {
        const visitDate = parseISO(visit.visit_date);
        return isValid(visitDate) && isWithinInterval(visitDate, { start: startDateFilter, end: endDateFilter });
    });
    console.log("ZHR Analytics - Spider Data: filteredVisitsForQualitative. Count:", filteredVisitsForQualitative.length);


    if (filteredVisitsForQualitative.length === 0) {
        console.log("ZHR Analytics - Spider Data: No visits after timeframe filtering for qualitative data.");
        return QUALITATIVE_QUESTIONS_CONFIG.map(q => ({ subject: q.label, score: 0, fullMark: 5 }));
    }

    const scores: Record<string, { totalScore: number; count: number }> = {};
    QUALITATIVE_QUESTIONS_CONFIG.forEach(q => {
        scores[q.key] = { totalScore: 0, count: 0 };
    });

    filteredVisitsForQualitative.forEach(visit => {
        QUALITATIVE_QUESTIONS_CONFIG.forEach(qConfig => {
            const value = visit[qConfig.key] as 'yes' | 'no' | undefined;
            if (value === 'yes' || value === 'no') {
                const scoreValue = value === 'yes' ? (qConfig.positiveIsYes ? 5 : 0) : (qConfig.positiveIsYes ? 0 : 5);
                scores[qConfig.key].totalScore += scoreValue;
                scores[qConfig.key].count += 1;
            }
        });
    });
    console.log("ZHR Analytics - Spider Data: aggregated scores", scores);

    const spiderChartFormattedData = QUALITATIVE_QUESTIONS_CONFIG.map(qConfig => {
        const aggregate = scores[qConfig.key];
        const averageScore = aggregate.count > 0 ? parseFloat((aggregate.totalScore / aggregate.count).toFixed(2)) : 0;
        return {
            subject: qConfig.label,
            score: averageScore,
            fullMark: 5,
        };
    });
    console.log("ZHR Analytics - Spider Data: spiderChartFormattedData", spiderChartFormattedData);
    return spiderChartFormattedData;

  }, [allZoneVisits, spiderChartTimeframe]);


  const branchCategoryDistributionChartData = useMemo(() => {
    if (allZoneVisits.length === 0 || allBranchesForCategoryLookup.length === 0) {
        console.log("ZHR Analytics - Category Pie: allZoneVisits or allBranchesForCategoryLookup is empty.");
        return [];
    }
    console.log("ZHR Analytics - Category Pie: Processing. Visits:", allZoneVisits.length, "Branches:", allBranchesForCategoryLookup.length, "Timeframe:", categoryPieChartTimeframe);

    const now = new Date();
    let startDateFilter: Date;
    const endDateFilter: Date = endOfDay(now);

    switch (categoryPieChartTimeframe) {
        case 'past_week': startDateFilter = startOfDay(subDays(now, 6)); break;
        case 'past_month': startDateFilter = startOfDay(subMonths(now, 1)); break;
        case 'last_3_months': startDateFilter = startOfDay(subMonths(now, 3)); break;
        case 'last_6_months': startDateFilter = startOfDay(subMonths(now, 6)); break;
        case 'last_year': startDateFilter = startOfDay(subYears(now, 1)); break;
        case 'last_3_years': startDateFilter = startOfDay(subYears(now, 3)); break;
        default: startDateFilter = startOfDay(subMonths(now, 1));
    }
    
    if (!isValid(startDateFilter) || !isValid(endDateFilter) || startDateFilter > endDateFilter) {
      console.warn("ZHR Analytics - Category Pie: Invalid date range for filtering.", {startDateFilter, endDateFilter});
      return [];
    }

    const filteredVisitsForCategoryPie = allZoneVisits.filter(visit => {
        const visitDate = parseISO(visit.visit_date);
        return isValid(visitDate) && isWithinInterval(visitDate, { start: startDateFilter, end: endDateFilter });
    });
    console.log("ZHR Analytics - Category Pie: Filtered visits. Count:", filteredVisitsForCategoryPie.length);

    if (filteredVisitsForCategoryPie.length === 0) return [];

    const categoryCounts: Record<string, number> = {};
    const branchCategoryMap = new Map(allBranchesForCategoryLookup.map(b => [b.id, b.category]));

    filteredVisitsForCategoryPie.forEach(visit => {
        const category = branchCategoryMap.get(visit.branch_id);
        if (category) {
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        } else {
            console.warn(`ZHR Analytics - Category Pie: No category found for branch_id: ${visit.branch_id}`);
        }
    });
    console.log("ZHR Analytics - Category Pie: Aggregated categoryCounts:", categoryCounts);

    const distributionData: ChartData[] = Object.entries(categoryCounts)
        .map(([name, value], index) => ({
            name,
            value,
            fill: `hsl(var(--chart-${(index % 5) + 1}))`, 
        }))
        .sort((a, b) => b.value - a.value); 
        
    console.log("ZHR Analytics - Category Pie: Final distributionData:", distributionData);
    return distributionData;

  }, [allZoneVisits, categoryPieChartTimeframe, allBranchesForCategoryLookup]);


  const handleMetricToggle = (metricKey: string) => {
    setActiveMetrics(prev => ({ ...prev, [metricKey]: !prev[metricKey] }));
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

  console.log("ZHR Analytics: qualitativeSpiderData before render", qualitativeDataForSpiderChart);

  return (
    <div className="space-y-8">
      <PageTitle title="Zonal Performance Trends" description="Analyze key metrics and qualitative assessments from submitted visits in your zone over time." />

      <Card className="shadow-xl">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Metric Trends</CardTitle>
            <CardDescription>Trendlines for selected metrics and timeframe.</CardDescription>
        </CardHeader>
        <CardContent>
          <TimeframeButtons selectedTimeframe={trendlineTimeframe} onTimeframeChange={setTrendlineTimeframe} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
            {METRIC_CONFIGS.map(metric => (
              <div key={metric.key} className="flex items-center space-x-2">
                <Checkbox
                  id={`metric-${metric.key}`}
                  checked={!!activeMetrics[metric.key]}
                  onCheckedChange={() => handleMetricToggle(metric.key)}
                  style={{ accentColor: metric.color } as React.CSSProperties}
                />
                <Label htmlFor={`metric-${metric.key}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" style={{ color: metric.color }}>
                  {metric.label}
                </Label>
              </div>
            ))}
          </div>
          {chartDisplayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartDisplayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
                    boxShadow: 'var(--shadow-md)'
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
                      type="monotone"
                      dataKey={metric.key.toString()}
                      name={metric.label}
                      stroke={metric.color}
                      strokeWidth={2}
                      yAxisId={metric.yAxisId || 'left'}
                      dot={{ r: 2, fill: metric.color }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  )
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center p-4">
                <TrendingUp className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-semibold">No data available for the selected timeframe or metrics.</p>
                <p className="text-xs text-muted-foreground">Try adjusting the filters or ensure BHRs have submitted visits with these metrics.</p>
            </div>
          )}
        </CardContent>
      </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>Qualitative Assessment Overview</CardTitle>
            <CardDescription>Average scores for qualitative questions from visits in the selected timeframe (0-5 scale).</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeframeButtons selectedTimeframe={spiderChartTimeframe} onTimeframeChange={setSpiderChartTimeframe} />
            {qualitativeDataForSpiderChart.length > 0 && qualitativeDataForSpiderChart.some(d => d.score > 0) ? (
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={qualitativeDataForSpiderChart}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <Radar name="Average Score" dataKey="score" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
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
              <div className="flex flex-col items-center justify-center h-96 text-center p-4">
                <ShieldQuestion className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground font-semibold">No qualitative assessment data available.</p>
                <p className="text-xs text-muted-foreground">Ensure BHRs have submitted visits with qualitative answers within the selected timeframe.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary"/>Branch Category Distribution</CardTitle>
                <CardDescription>Distribution of submitted visits by branch category in the selected timeframe.</CardDescription>
            </CardHeader>
            <CardContent>
                <TimeframeButtons selectedTimeframe={categoryPieChartTimeframe} onTimeframeChange={setCategoryPieChartTimeframe} />
                {branchCategoryDistributionChartData.length > 0 ? (
                    <PlaceholderPieChart
                        data={branchCategoryDistributionChartData}
                        title=""
                        dataKey="value"
                        nameKey="name"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-center p-4">
                        <PieChartIcon className="w-16 h-16 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground font-semibold">No branch category data available.</p>
                        <p className="text-xs text-muted-foreground">Ensure BHRs have submitted visits and branches have categories assigned within the selected timeframe.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>


    </div>
  );
}

