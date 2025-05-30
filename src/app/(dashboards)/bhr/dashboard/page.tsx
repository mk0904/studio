
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import { Users, Building2, ClipboardCheck, Loader2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isSameMonth, parseISO, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import type { ChartData } from '@/types';

export default function BHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [assignedBranchesCount, setAssignedBranchesCount] = useState<number>(0);
  const [branchesCoveredThisMonth, setBranchesCoveredThisMonth] = useState<number>(0);
  const [totalVisitsThisMonth, setTotalVisitsThisMonth] = useState<number>(0);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [branchCategoryDistribution, setBranchCategoryDistribution] = useState<ChartData[]>([]);
  
  // Mocked data for Visit Metrics (can be fetched live later if needed)
  const visitMetrics = {
    hrConnectSessions: "0/0", // Example: Actual/Planned
    averageParticipation: "0%",
    employeeCoverage: "0%",
  };

  useEffect(() => {
    if (user && user.role === 'BHR') {
      const fetchData = async () => {
        console.log("BHRDashboard: fetchData initiated");
        setIsLoading(true);
        try {
          // 1. Fetch assigned branches count
          const { count: assignmentsCount, error: assignmentsError } = await supabase
            .from('assignments')
            .select('branch_id', { count: 'exact', head: true })
            .eq('bhr_id', user.id);

          if (assignmentsError) throw assignmentsError;
          setAssignedBranchesCount(assignmentsCount || 0);
          console.log("BHRDashboard: Assigned branches count:", assignmentsCount);


          // 2. Fetch submitted visits for this BHR
          const { data: submittedVisits, error: visitsError } = await supabase
            .from('visits')
            .select('branch_id, visit_date')
            .eq('bhr_id', user.id)
            .eq('status', 'submitted');

          if (visitsError) throw visitsError;
          console.log("BHRDashboard: All submittedVisits raw:", submittedVisits);


          const today = new Date();
          const currentMonthStart = startOfMonth(today);

          const visitsThisMonth = (submittedVisits || []).filter(visit =>
            isSameMonth(parseISO(visit.visit_date), currentMonthStart)
          );
          console.log("BHRDashboard: visitsThisMonth (filtered for current month):", visitsThisMonth);
          setTotalVisitsThisMonth(visitsThisMonth.length);

          const uniqueBranchesVisitedThisMonth = new Set(visitsThisMonth.map(visit => visit.branch_id));
          setBranchesCoveredThisMonth(uniqueBranchesVisitedThisMonth.size);
          
          if ((assignmentsCount || 0) > 0) {
            setCompletionRate(Math.round((uniqueBranchesVisitedThisMonth.size / (assignmentsCount || 1)) * 100));
          } else {
            setCompletionRate(0);
          }

          // 3. Fetch all branches for category lookup
          const { data: allBranches, error: branchesError } = await supabase
            .from('branches')
            .select('id, category');

          if (branchesError) {
            console.error("BHRDashboard: Error fetching branches for category lookup", branchesError);
            throw branchesError;
          }
          console.log("BHRDashboard: allBranches for category lookup:", allBranches);


          const branchCategoryMap = new Map<string, string>();
          (allBranches || []).forEach(branch => {
            if (branch.id && branch.category) { // Ensure category is not null/undefined
              branchCategoryMap.set(branch.id, branch.category);
            }
          });
          console.log("BHRDashboard: branchCategoryMap created:", branchCategoryMap);


          // 4. Calculate branch category distribution for visits this month
          const categoryCounts: Record<string, number> = {};
          visitsThisMonth.forEach(visit => {
            const category = branchCategoryMap.get(visit.branch_id);
            console.log(`BHRDashboard: Processing visit to branch ${visit.branch_id}, category from map: ${category}`);
            if (category) {
              categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            } else {
              console.warn(`BHRDashboard: No category found for branch_id: ${visit.branch_id}`);
            }
          });
          console.log("BHRDashboard: categoryCounts aggregated:", categoryCounts);


          const distributionData: ChartData[] = Object.entries(categoryCounts).map(([name, value], index) => ({
            name,
            value,
            fill: `hsl(var(--chart-${(index % 5) + 1}))`, 
          }));
          console.log("BHRDashboard: final distributionData for chart:", distributionData);
          setBranchCategoryDistribution(distributionData);

        } catch (error: any) {
          console.error("BHRDashboard: Error fetching BHR dashboard data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setAssignedBranchesCount(0);
          setTotalVisitsThisMonth(0);
          setBranchesCoveredThisMonth(0);
          setCompletionRate(0);
          setBranchCategoryDistribution([]); 
        } finally {
          setIsLoading(false);
          console.log("BHRDashboard: fetchData finished");
        }
      };
      fetchData();
    } else {
        setIsLoading(false); 
    }
  }, [user, toast]);

  if (!user) return null; 

  if (isLoading && user.role === 'BHR' && assignedBranchesCount === 0 && totalVisitsThisMonth === 0) { // More specific loading condition
    return (
      <div className="space-y-8">
        <PageTitle 
          title={`Welcome back, ${user.name}!`} 
          description="Loading your dashboard overview..." 
        />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <PageTitle 
        title={`Welcome back, ${user.name}!`} 
        description="Here's an overview of your branch visits and performance metrics for this month." 
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"> 
        <Card className="shadow-md bg-blue-50 dark:bg-blue-900/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">Assigned Branches</CardTitle>
            <Users className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{assignedBranchesCount}</div>
            <p className="text-xs text-muted-foreground pt-1">Total branches under your supervision</p>
          </CardContent>
        </Card>

        <Card className="shadow-md bg-purple-50 dark:bg-purple-900/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400">Branches Covered</CardTitle>
            <Building2 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{branchesCoveredThisMonth}</div>
            <p className="text-xs text-muted-foreground pt-1">Unique branches visited</p>
            <Badge variant="outline" className="text-xs mt-1 bg-purple-100 dark:bg-purple-800/50 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300">this month</Badge>
          </CardContent>
        </Card>

        <Card className="shadow-md bg-green-50 dark:bg-green-900/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400">Total Visits</CardTitle>
            <ClipboardCheck className="h-5 w-5 text-green-500 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalVisitsThisMonth}</div>
            <p className="text-xs text-muted-foreground pt-1">Total visits made</p>
             <Badge variant="outline" className="text-xs mt-1 bg-green-100 dark:bg-green-800/50 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300">this month</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className="shadow-md lg:col-span-1"> 
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" /> {/* Changed from TrendingUp to BarChart3 to match imports */}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{completionRate}%</div>
            <p className="text-xs text-muted-foreground pt-1">Of assigned branches visited</p>
             <Badge variant="outline" className="text-xs mt-1">this month</Badge>
          </CardContent>
        </Card>
         <div className="lg:col-span-2 hidden md:block"> 
            <Card className="shadow-md h-full flex items-center justify-center bg-muted/30">
                <p className="text-muted-foreground">Future content area</p>
            </Card>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Branch Visit Progress</CardTitle>
            <CardDescription>Distribution of submitted visits by branch category this month.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && branchCategoryDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : branchCategoryDistribution.length > 0 ? (
              <PlaceholderPieChart
                data={branchCategoryDistribution}
                title="" 
                dataKey="value"
                nameKey="name"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                <ClipboardCheck className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No Submitted Visits This Month</p>
                <p className="text-xs text-muted-foreground">Visit data by branch category will appear here once visits are submitted for the current month.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Visit Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">HR Connect Sessions</p>
              <p className="text-sm font-semibold text-foreground">{visitMetrics.hrConnectSessions}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Average Participation</p>
              <p className="text-sm font-semibold text-foreground">{visitMetrics.averageParticipation}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Employee Coverage</p>
              <p className="text-sm font-semibold text-foreground">{visitMetrics.employeeCoverage}</p>
            </div>
             <div className="mt-4 h-20 flex items-center justify-center border-2 border-dashed rounded-md">
              <p className="text-muted-foreground">More metrics coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
