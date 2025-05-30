
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, RadarChart } from 'recharts'; // Removed BarChart, Bar
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, ShieldQuestion, Target, PieChart as PieChartIcon, BarChartBig } from 'lucide-react';
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
  <div className="flex flex-wrap gap-2 mb-4">
    {TIMEFRAME_OPTIONS.map(tf => (
      <Button key={tf.key} variant={selectedTimeframe === tf.key ? 'default' : 'outline'} size="sm" onClick={() => onTimeframeChange(tf.key)}>
        {tf.label}
      </Button>
    ))}
  </div>
);

export default function CHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);
  // const [allUsers, setAllUsers] = useState<User[]>([]); // Not needed if all data is global for CHR analytics
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
    METRIC_CONFIGS.reduce((acc, metric) => ({ ...acc, [metric.key]: metric.key === 'manning_percentage' }), {})
  );
  
  const [trendlineTimeframe, setTrendlineTimeframe] = useState<TimeframeKey>('past_month');
  const [qualitativeTimeframe, setQualitativeTimeframe] = useState<TimeframeKey>('past_month');
  const [categoryPieTimeframe, setCategoryPieTimeframe] = useState<TimeframeKey>('past_month');
  const [topBranchesTimeframe, setTopBranchesTimeframe] = useState<TimeframeKey>('past_month');

  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // Fetch all users (needed for VHR vertical mapping if we re-add that specific chart)
          // For now, mainly for context if any other user-related detail becomes necessary.
          // const { data: usersData, error: usersError } = await supabase.from('users').select('id, name, role, reports_to');
          // if (usersError) throw usersError;
          // setAllUsers(usersData || []);

          const { data: branchesData, error: branchesError } = await supabase
            .from('branches')
            .select('id, name, category, location');
          if (branchesError) throw branchesError;
          setAllBranches(branchesData || []);

          const { data: visitsData, error: visitsError } = await supabase
            .from('visits')
            .select('bhr_id, branch_id, visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases, qual_aligned_conduct, qual_safe_secure, qual_motivated, qual_abusive_language, qual_comfortable_escalate, qual_inclusive_culture')
            .eq('status', 'submitted');
          if (visitsError) throw visitsError;
          setAllSubmittedVisits(visitsData || []);

        } catch (error: any) {
          console.error("CHR Analytics: Error fetching global data:", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
          setAllSubmittedVisits([]);
          // setAllUsers([]);
          setAllBranches([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);
  
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
    const filtered = filterVisitsByTimeframe(allSubmittedVisits, trendlineTimeframe);
    if (filtered.length === 0) return [];
    const aggregatedData: Record<string, { [key: string]: { sum: number; count: number } }> = {};
    let minDate = new Date();
    let maxDate = new Date(1970,0,1);

    filtered.forEach(visit => {
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
    if (filtered.length === 0 || !isValid(minDate) || !isValid(maxDate) || minDate > maxDate ) return [];
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
  }, [allSubmittedVisits, trendlineTimeframe]);

  const qualitativeSpiderChartData = useMemo(() => {
    const filtered = filterVisitsByTimeframe(allSubmittedVisits, qualitativeTimeframe);
    if (filtered.length === 0) return QUALITATIVE_QUESTIONS_CONFIG.map(q => ({ subject: q.label, score: 0, fullMark: 5 }));
    const scores: Record<string, { totalScore: number; count: number }> = {};
    QUALITATIVE_QUESTIONS_CONFIG.forEach(q => { scores[q.key] = { totalScore: 0, count: 0 }; });
    filtered.forEach(visit => {
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
  }, [allSubmittedVisits, qualitativeTimeframe]);

  const branchCategoryPieChartData = useMemo(() => {
    const filtered = filterVisitsByTimeframe(allSubmittedVisits, categoryPieTimeframe);
    if (filtered.length === 0 || allBranches.length === 0) return [];
    const categoryCounts: Record<string, number> = {};
    const branchCategoryMap = new Map(allBranches.map(b => [b.id, b.category]));
    filtered.forEach(visit => {
        const category = branchCategoryMap.get(visit.branch_id);
        if (category) { categoryCounts[category] = (categoryCounts[category] || 0) + 1; }
    });
    return Object.entries(categoryCounts).map(([name, value], index) => ({ name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))` })).sort((a, b) => b.value - a.value);
  }, [allSubmittedVisits, categoryPieTimeframe, allBranches]);

  const topPerformingBranchesChartData = useMemo(() => {
    const filtered = filterVisitsByTimeframe(allSubmittedVisits, topBranchesTimeframe);
    if (filtered.length === 0 || allBranches.length === 0) return [];
    const visitsPerBranch: Record<string, number> = {};
    const branchNameMap = new Map(allBranches.map(b => [b.id, b.name]));
    filtered.forEach(visit => {
      const branchName = branchNameMap.get(visit.branch_id) || 'Unknown Branch';
      visitsPerBranch[branchName] = (visitsPerBranch[branchName] || 0) + 1;
    });
    return Object.entries(visitsPerBranch)
      .map(([name, value], index) => ({ name, value, fill: `hsl(var(--chart-${(index % 5) + 1}))` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allSubmittedVisits, topBranchesTimeframe, allBranches]);
  
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
  if (!user || user.role !== 'CHR') {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="CHR Global Analytics" description="Analyze key metrics, qualitative assessments, and visit distributions across all verticals." />

      <Card className="shadow-xl">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Global Metric Trends</CardTitle>
            <CardDescription>Trendlines for selected metrics from all submitted visits.</CardDescription>
        </CardHeader>
        <CardContent>
          <TimeframeButtons selectedTimeframe={trendlineTimeframe} onTimeframeChange={setTrendlineTimeframe} />
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
          ) : ( <div className="flex flex-col items-center justify-center h-96 text-center p-4"><TrendingUp className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No global metric data available.</p></div> )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>Global Qualitative Assessment</CardTitle>
            <CardDescription>Average scores for qualitative questions from all submitted visits (0-5 scale).</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeframeButtons selectedTimeframe={qualitativeTimeframe} onTimeframeChange={setQualitativeTimeframe} />
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
            ) : ( <div className="flex flex-col items-center justify-center h-80 text-center p-4"><ShieldQuestion className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No global qualitative data.</p></div>)}
          </CardContent>
        </Card>

        <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-primary"/>Global Branch Category Visits</CardTitle>
                <CardDescription>Distribution of all submitted visits by branch category.</CardDescription>
            </CardHeader>
            <CardContent>
                <TimeframeButtons selectedTimeframe={categoryPieTimeframe} onTimeframeChange={setCategoryPieTimeframe} />
                {branchCategoryPieChartData.length > 0 ? (
                    <PlaceholderPieChart data={branchCategoryPieChartData} title="" dataKey="value" nameKey="name"/>
                ) : ( <div className="flex flex-col items-center justify-center h-80 text-center p-4"><PieChartIcon className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No global category data.</p></div>)}
            </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 gap-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChartBig className="h-5 w-5 text-primary"/>Global Top Branches by Visits</CardTitle>
            <CardDescription>Branches with the most submitted HR visits globally.</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeframeButtons selectedTimeframe={topBranchesTimeframe} onTimeframeChange={setTopBranchesTimeframe} />
            {topPerformingBranchesChartData.length > 0 ? (
                <PlaceholderBarChart data={topPerformingBranchesChartData} title="" xAxisKey="name" dataKey="value" />
            ) : ( <div className="flex flex-col items-center justify-center h-80 text-center p-4"><BarChartBig className="w-16 h-16 text-muted-foreground mb-4" /><p className="text-muted-foreground font-semibold">No global branch visit data.</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
