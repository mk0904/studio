
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, Visit } from '@/types';
import { mockBranches, mockVisits, getVisibleBranchesForBHR, getVisibleVisits } from '@/lib/mock-data';
import { Users, Building2, ClipboardCheck, CalendarCheck2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isSameMonth, parseISO, startOfMonth } from 'date-fns';

export default function BHRDashboardPage() {
  const { user } = useAuth();
  const [assignedBranchesCount, setAssignedBranchesCount] = useState<number>(0);
  const [branchesCoveredThisMonth, setBranchesCoveredThisMonth] = useState<number>(0);
  const [totalVisitsThisMonth, setTotalVisitsThisMonth] = useState<number>(0);
  const [approvedReportsCount, setApprovedReportsCount] = useState<number>(0); // Mocked
  const [completionRate, setCompletionRate] = useState<number>(0);
  
  // Mocked data for Visit Metrics
  const visitMetrics = {
    hrConnectSessions: "0/0",
    averageParticipation: "0%",
    employeeCoverage: "0%",
  };

  useEffect(() => {
    if (user && user.role === 'BHR') {
      const assignedBHRBranches = getVisibleBranchesForBHR(user.id);
      setAssignedBranchesCount(assignedBHRBranches.length);

      const bhrVisits = getVisibleVisits(user);
      const today = new Date();
      const currentMonthStart = startOfMonth(today);

      const visitsThisMonth = bhrVisits.filter(visit => 
        isSameMonth(parseISO(visit.visit_date), currentMonthStart)
      );
      setTotalVisitsThisMonth(visitsThisMonth.length);

      const uniqueBranchesVisitedThisMonth = new Set(visitsThisMonth.map(visit => visit.branch_id));
      setBranchesCoveredThisMonth(uniqueBranchesVisitedThisMonth.size);
      
      if (assignedBHRBranches.length > 0) {
        setCompletionRate(Math.round((uniqueBranchesVisitedThisMonth.size / assignedBHRBranches.length) * 100));
      } else {
        setCompletionRate(0);
      }

      // Mock approved reports
      setApprovedReportsCount(0); 
    }
  }, [user]);

  if (!user) return null; // Or loading state

  return (
    <div className="space-y-8">
      <PageTitle 
        title={`Welcome back, ${user.name}!`} 
        description="Here's an overview of your branch visits and performance metrics for this month." 
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-xs text-muted-foreground pt-1">Branches visited this month</p>
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

        <Card className="shadow-md bg-orange-50 dark:bg-orange-900/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">Approved Reports</CardTitle>
            <CalendarCheck2 className="h-5 w-5 text-orange-500 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{approvedReportsCount}</div>
            <p className="text-xs text-muted-foreground pt-1">Total approved this month</p>
            <Badge variant="outline" className="text-xs mt-1 bg-orange-100 dark:bg-orange-800/50 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300">this month</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3"> {/* Changed grid to allow 1/3 for completion rate */}
        <Card className="shadow-md lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            <TrendingUp className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{completionRate}%</div>
            <p className="text-xs text-muted-foreground pt-1">Of assigned branches visited</p>
             <Badge variant="outline" className="text-xs mt-1">this month</Badge>
          </CardContent>
        </Card>
        {/* Placeholder for future cards taking up remaining 2/3 space */}
         <div className="lg:col-span-2"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Branch Visit Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Branch Categories</p>
            {/* Placeholder for chart or detailed list */}
            <div className="mt-4 h-32 flex items-center justify-center border-2 border-dashed rounded-md">
              <p className="text-muted-foreground">Chart/Data coming soon</p>
            </div>
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
             {/* Placeholder for more metrics or detailed view */}
             <div className="mt-4 h-20 flex items-center justify-center border-2 border-dashed rounded-md">
              <p className="text-muted-foreground">More metrics coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    