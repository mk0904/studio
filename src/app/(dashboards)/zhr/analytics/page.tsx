
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, User as AppUser, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, CalendarDays } from 'lucide-react';
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

interface MetricConfig {
  key: keyof Visit;
  label: string;
  color: string;
  yAxisId?: string; // For potential multi-axis charts
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'manning_percentage', label: 'Manning %', color: 'hsl(var(--chart-1))', yAxisId: 'left' },
  { key: 'attrition_percentage', label: 'Attrition %', color: 'hsl(var(--chart-2))', yAxisId: 'left' },
  { key: 'non_vendor_percentage', label: 'Non-Vendor %', color: 'hsl(var(--chart-3))', yAxisId: 'left' },
  { key: 'er_percentage', label: 'ER %', color: 'hsl(var(--chart-4))', yAxisId: 'left' },
  { key: 'cwt_cases', label: 'CWT Cases', color: 'hsl(var(--chart-5))', yAxisId: 'right' }, // Potentially different scale
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
  date: string; // 'YYYY-MM-DD'
  [key: string]: any; // For dynamic metrics
};

export default function ZHRAnalyticsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [allZoneVisits, setAllZoneVisits] = useState<Visit[]>([]);
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
    METRIC_CONFIGS.reduce((acc, metric) => ({ ...acc, [metric.key]: metric.key === 'manning_percentage' }), {}) // Default 'Manning %' to true
  );
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeKey>('past_month');

  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const fetchData = async () => {
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
            setIsLoading(false);
            return;
          }

          const { data: visitsData, error: visitsError } = await supabase
            .from('visits')
            .select('visit_date, manning_percentage, attrition_percentage, non_vendor_percentage, er_percentage, cwt_cases')
            .in('bhr_id', bhrIds)
            .eq('status', 'submitted');

          if (visitsError) throw visitsError;
          setAllZoneVisits(visitsData || []);
        } catch (error: any) {
          console.error("Error fetching ZHR analytics data:", error);
          toast({ title: "Error", description: `Failed to load analytics data: ${error.message}`, variant: "destructive" });
          setAllZoneVisits([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  const chartDisplayData = useMemo(() => {
    if (allZoneVisits.length === 0) return [];

    const today = new Date();
    let startDateFilter: Date;
    const endDateFilter: Date = endOfDay(today);

    switch (selectedTimeframe) {
      case 'past_week':
        startDateFilter = startOfDay(subDays(today, 6));
        break;
      case 'past_month':
        startDateFilter = startOfDay(subMonths(today, 1));
        break;
      case 'last_3_months':
        startDateFilter = startOfDay(subMonths(today, 3));
        break;
      case 'last_6_months':
        startDateFilter = startOfDay(subMonths(today, 6));
        break;
      case 'last_year':
        startDateFilter = startOfDay(subYears(today, 1));
        break;
      case 'last_3_years':
        startDateFilter = startOfDay(subYears(today, 3));
        break;
      default: // Should not happen with typed TimeframeKey
        startDateFilter = startOfDay(subMonths(today, 1)); 
    }
    
    if (!isValid(startDateFilter) || !isValid(endDateFilter) || startDateFilter > endDateFilter) {
        console.warn("Invalid date range for filtering:", {startDateFilter, endDateFilter});
        return [];
    }

    const filteredVisits = allZoneVisits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      return isValid(visitDate) && isWithinInterval(visitDate, { start: startDateFilter, end: endDateFilter });
    });

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
        console.error("Error creating date interval for chart:", e, {startDateFilter, endDateFilter});
        return []; // Prevent crash if interval is invalid
    }

    return dateRangeForChart.map(dayDate => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const dayData = aggregatedData[dayKey];
      const point: ChartDataPoint = { date: dayKey };

      METRIC_CONFIGS.forEach(m => {
        if (dayData && dayData[m.key] && dayData[m.key].count > 0) {
          if (m.key === 'cwt_cases') { // Sum for CWT cases
            point[m.key] = dayData[m.key].sum;
          } else { // Average for percentages
            point[m.key] = parseFloat((dayData[m.key].sum / dayData[m.key].count).toFixed(2));
          }
        } else {
          // point[m.key] = undefined; // Or null if Recharts handles it better for gaps
        }
      });
      return point;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  }, [allZoneVisits, selectedTimeframe]);

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


  return (
    <div className="space-y-8">
      <PageTitle title="Zonal Performance Trends" description="Analyze key metrics from submitted visits in your zone over time." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Select Timeframe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {TIMEFRAME_OPTIONS.map(tf => (
            <Button
              key={tf.key}
              variant={selectedTimeframe === tf.key ? 'default' : 'outline'}
              onClick={() => setSelectedTimeframe(tf.key)}
            >
              {tf.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Select Metrics to Display</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {METRIC_CONFIGS.map(metric => (
            <div key={metric.key} className="flex items-center space-x-2">
              <Checkbox
                id={metric.key}
                checked={!!activeMetrics[metric.key]}
                onCheckedChange={() => handleMetricToggle(metric.key)}
                style={{ accentColor: metric.color } as React.CSSProperties} 
              />
              <Label htmlFor={metric.key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" style={{ color: metric.color }}>
                {metric.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Card className="shadow-xl">
        <CardHeader>
            <CardTitle>Metric Trends</CardTitle>
            <CardDescription>Trendlines for selected metrics and timeframe.</CardDescription>
        </CardHeader>
        <CardContent>
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
                  formatter={(value, name, props) => {
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
    </div>
  );
}

