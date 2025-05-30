
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, BarChartHorizontalBig, Users, Percent } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ChartData } from '@/types';
import { StatCard } from '@/components/shared/stat-card';

export default function BHRAnalyticsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [submittedVisits, setSubmittedVisits] = useState<Visit[]>([]);
  const [visitsByMonthData, setVisitsByMonthData] = useState<ChartData[]>([]);
  const [performanceDistributionData, setPerformanceDistributionData] = useState<ChartData[]>([]);
  const [hrConnectStats, setHrConnectStats] = useState({
    totalConducted: 0,
    averageParticipationRate: 0,
    totalParticipants: 0,
    totalInvited: 0,
  });

  useEffect(() => {
    if (user && user.role === 'BHR') {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('visits')
            .select('*')
            .eq('bhr_id', user.id)
            .eq('status', 'submitted');

          if (error) throw error;
          setSubmittedVisits(data || []);

          // Process data for charts
          const monthlyCounts: Record<string, number> = {};
          const performanceCounts: Record<string, number> = {};
          let connectConducted = 0;
          let connectParticipants = 0;
          let connectInvited = 0;

          (data || []).forEach(visit => {
            // Monthly visits
            const monthYear = format(parseISO(visit.visit_date), 'MMM yyyy');
            monthlyCounts[monthYear] = (monthlyCounts[monthYear] || 0) + 1;

            // Performance levels
            if (visit.performance_level) {
              performanceCounts[visit.performance_level] = (performanceCounts[visit.performance_level] || 0) + 1;
            }

            // HR Connect
            if (visit.hr_connect_conducted) {
              connectConducted++;
              connectInvited += visit.hr_connect_employees_invited || 0;
              connectParticipants += visit.hr_connect_participants || 0;
            }
          });

          setVisitsByMonthData(
            Object.entries(monthlyCounts).map(([name, value], index) => ({
              name,
              value,
              fill: `hsl(var(--chart-${(index % 5) + 1}))`,
            })).sort((a,b) => new Date(a.name).getTime() - new Date(b.name).getTime()) // Sort by date
          );

          setPerformanceDistributionData(
            Object.entries(performanceCounts).map(([name, value], index) => ({
              name,
              value,
              fill: `hsl(var(--chart-${(index % 5) + 1}))`,
            }))
          );

          setHrConnectStats({
            totalConducted: connectConducted,
            averageParticipationRate: connectInvited > 0 ? Math.round((connectParticipants / connectInvited) * 100) : 0,
            totalParticipants: connectParticipants,
            totalInvited: connectInvited,
          });

        } catch (error: any) {
          console.error("Error fetching BHR analytics data:", error);
          // Handle error (e.g., show toast)
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
        setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (submittedVisits.length === 0 && !isLoading) {
    return (
      <div className="space-y-8">
        <PageTitle title="My Analytics" description="Visualize your submitted visit data and performance." />
        <Card className="shadow-md">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <BarChartHorizontalBig className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-xl font-semibold">No Submitted Visits Found</h3>
            <p className="text-muted-foreground max-w-md">
              Once you submit visit reports, your analytics will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="My Analytics" description="Visualize your submitted visit data and performance." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <StatCard
          title="HR Connect Sessions"
          value={hrConnectStats.totalConducted}
          icon={Users}
          description={`Invited: ${hrConnectStats.totalInvited}, Participated: ${hrConnectStats.totalParticipants}`}
          className="lg:col-span-1"
        />
         <StatCard
          title="Avg. HR Connect Participation"
          value={`${hrConnectStats.averageParticipationRate}%`}
          icon={Percent}
          description="Based on conducted sessions"
          className="lg:col-span-1"
        />
         <StatCard
          title="Total Submitted Visits"
          value={submittedVisits.length}
          icon={BarChartHorizontalBig}
          description="Overall submitted visit reports"
          className="lg:col-span-1"
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderBarChart
          data={visitsByMonthData}
          title="Monthly Submitted Visit Trend"
          description="Number of submitted visits each month."
          xAxisKey="name"
          dataKey="value"
        />
        <PlaceholderPieChart
          data={performanceDistributionData}
          title="Branch Performance Distribution"
          description="Distribution of performance levels from your visits."
          dataKey="value"
          nameKey="name"
        />
      </div>
       <Card className="shadow-md">
        <CardHeader>
            <CardTitle>Raw Data Overview (Last 5 Visits)</CardTitle>
            <CardDescription>A quick look at your most recent submitted visits.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Branch ID</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Visit Date</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Performance</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">HR Connect</th>
                        </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-border">
                        {submittedVisits.slice(0, 5).map(visit => (
                            <tr key={visit.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{visit.branch_id}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{format(parseISO(visit.visit_date), 'PPP')}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{visit.performance_level || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{visit.hr_connect_conducted ? 'Yes' : 'No'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
