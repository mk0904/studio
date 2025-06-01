
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import { Users, Building2, ClipboardCheck, Loader2, BarChart3, PlusCircle, ArrowUpRight, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format, isSameMonth, parseISO, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { DonutChart } from '@/components/charts/donut-chart';
import { cn } from '@/lib/utils';
import type { ChartData } from '@/types';
import Link from 'next/link';

export default function BHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [assignedBranchesCount, setAssignedBranchesCount] = useState<number>(0);
  const [branchesCoveredThisMonth, setBranchesCoveredThisMonth] = useState<number>(0);
  const [totalVisitsThisMonth, setTotalVisitsThisMonth] = useState<number>(0);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [branchCategoryDistribution, setBranchCategoryDistribution] = useState<ChartData[]>([]);
  const [lastMonthDistribution, setLastMonthDistribution] = useState<ChartData[]>([]);
  const [lastMonthVisitsCount, setLastMonthVisitsCount] = useState<number>(0);
  

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
          const lastMonthStart = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1));

          const visitsThisMonth = (submittedVisits || []).filter(visit =>
            isSameMonth(parseISO(visit.visit_date), currentMonthStart)
          );

          const visitsLastMonth = (submittedVisits || []).filter(visit =>
            isSameMonth(parseISO(visit.visit_date), lastMonthStart)
          );
          setLastMonthVisitsCount(visitsLastMonth.length);
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
            if (branch.id && branch.category) { 
              branchCategoryMap.set(branch.id, branch.category);
            }
          });
          console.log("BHRDashboard: branchCategoryMap created:", branchCategoryMap);


          // 4. Calculate branch category distribution for visits this month
          // Calculate this month's distribution
          const categoryCounts: Record<string, number> = {};
          const lastMonthCounts: Record<string, number> = {};
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


          // Map category colors based on type
          const categoryColors = {
            premium: 'hsl(265, 89%, 78%)', // Purple for premium
            regular: 'hsl(151, 65%, 76%)', // Emerald for regular
            small: 'hsl(199, 95%, 74%)',   // Sky Blue for small
            rural: 'hsl(45, 93%, 77%)',    // Amber for rural
            urban: 'hsl(231, 48%, 71%)',   // Indigo for urban
            uncategorized: 'hsl(148, 8%, 75%)' // Slate for uncategorized
          };

          const distributionData: ChartData[] = Object.entries(categoryCounts).map(([name, value]) => ({
            name,
            value,
            fill: categoryColors[name.toLowerCase() as keyof typeof categoryColors] || categoryColors.uncategorized
          }));

          // Calculate last month's distribution
          visitsLastMonth.forEach(visit => {
            const category = branchCategoryMap.get(visit.branch_id);
            if (category) {
              lastMonthCounts[category] = (lastMonthCounts[category] || 0) + 1;
            }
          });

          const lastMonthData: ChartData[] = Object.entries(lastMonthCounts).map(([name, value]) => ({
            name,
            value,
            fill: categoryColors[name.toLowerCase() as keyof typeof categoryColors] || categoryColors.uncategorized
          }));

          console.log("BHRDashboard: final distributionData for charts:", { current: distributionData, last: lastMonthData });
          setBranchCategoryDistribution(distributionData);
          setLastMonthDistribution(lastMonthData);

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

  if (isLoading && user.role === 'BHR' && assignedBranchesCount === 0 && totalVisitsThisMonth === 0) { 
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
    <div className="flex min-h-full w-full flex-col items-center bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">

        <div className="flex flex-col space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#004C8F] to-[#0070CC]">
                Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground/90 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#004C8F]/70" />
                Branch visit overview for {format(new Date(), 'MMMM yyyy')}
              </p>
            </div>
            <Button asChild className="bg-[#004C8F] hover:bg-[#004C8F]/90 transition-all duration-200 text-white h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm shadow hover:shadow-md w-full sm:w-auto">
              <Link href="/bhr/new-visit" className="inline-flex items-center justify-center gap-1.5 sm:gap-2">
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Log New Visit</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 w-full">
          <Card className="relative overflow-hidden border border-indigo-500/10 bg-gradient-to-br from-white to-indigo-500/5 transition-all duration-200 hover:border-indigo-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="p-3 sm:p-4 pb-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-indigo-600">Assigned Branches</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/70">Total branches assigned to you</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-2 flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-start flex-1">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{assignedBranchesCount}</div>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-xs text-muted-foreground/70">{branchesCoveredThisMonth} visited</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-[#004C8F]/10 bg-gradient-to-br from-white to-[#004C8F]/5 transition-all duration-200 hover:border-[#004C8F]/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-1 group">
            <CardHeader className="p-3 sm:p-4 pb-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-[#004C8F]">Monthly Progress</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/70">Branch coverage this month</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-2 flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-start flex-1">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{completionRate}%</div>
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#004C8F]" />
                <span className="text-xs sm:text-sm text-muted-foreground/70">{branchesCoveredThisMonth} of {assignedBranchesCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-emerald-500/10 bg-gradient-to-br from-white to-emerald-500/5 transition-all duration-200 hover:border-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5 flex flex-col col-span-2 sm:col-span-1 group">
            <CardHeader className="p-3 sm:p-4 pb-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-emerald-600">Total Visits</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/70">Branch visits completed this month</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-2 flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-start flex-1">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold">{totalVisitsThisMonth}</div>
              <div className="flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs text-muted-foreground/70">completed visits</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full">
          <Card className="border border-slate-200/50 bg-white/95 backdrop-blur-sm transition-all duration-200 hover:border-slate-300/50 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
            <div className="flex flex-col min-h-[400px]">
              <div className="flex-grow p-6 sm:p-8">
                <div className="flex flex-col items-center justify-center h-full">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center min-h-[280px] sm:min-h-[320px] text-center p-4">
                      <Loader2 className="h-8 w-8 animate-spin text-[#004C8F]" />
                    </div>
                  ) : branchCategoryDistribution.length > 0 ? (
                    <div className="w-full">

                      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 items-center justify-center">
                        <div className="w-full sm:w-[280px] bg-white/50 rounded-lg p-4 shadow-sm border border-slate-100">
                          <DonutChart
                            data={branchCategoryDistribution}
                            title={`${totalVisitsThisMonth}`}
                            description="This Month"
                          />
                        </div>
                        <div className="w-full sm:w-[280px] bg-white/50 rounded-lg p-4 shadow-sm border border-slate-100">
                          <DonutChart
                            data={lastMonthDistribution}
                            title={`${lastMonthVisitsCount}`}
                            description="Last Month"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <ClipboardCheck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="font-medium text-muted-foreground">No Visits This Month</p>
                      <p className="text-sm text-muted-foreground/80 max-w-[260px] mx-auto mt-2">Visit data will appear here once you start logging visits.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/50 to-white p-4 sm:p-6">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" asChild className="text-[#004C8F] hover:text-[#004C8F]/90 hover:bg-[#004C8F]/10">
                    <Link href="/bhr/my-visits" className="inline-flex items-center gap-1.5">
                      View All Visits
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
