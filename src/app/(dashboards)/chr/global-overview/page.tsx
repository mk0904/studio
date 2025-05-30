
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { VisitSummaryAi } from '@/components/chr/visit-summary-ai';
import { mockVisitReportInputs, mockVisits, mockUsers, mockBranches } from '@/lib/mock-data'; // Using mockVisitReportInputs
import type { VisitReportInput } from '@/types';
import { StatCard } from '@/components/shared/stat-card';
import { Users, Building, CalendarCheck, BarChartHorizontalBig, CheckCircle2 } from 'lucide-react';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { Visit } from '@/types';
import { format } from 'date-fns';

const recentVisitsColumns: ColumnConfig<Visit>[] = [
  { accessorKey: 'bhr_name', header: 'BHR' },
  { accessorKey: 'branch_name', header: 'Branch' },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => format(new Date(row.visit_date), 'PPP')
  },
  { 
    accessorKey: 'notes', 
    header: 'Summary',
    cell: (row) => <p className="truncate max-w-xs">{row.notes}</p>
  },
];

export default function CHRGlobalOverviewPage() {
  const { user } = useAuth();
  const [reportsToSummarize, setReportsToSummarize] = useState<VisitReportInput[]>([]);
  const [keyStats, setKeyStats] = useState({
    totalUsers: 0,
    totalBranches: 0,
    totalVisits: 0,
    avgVisitsPerBranch: "0.0"
  });
  const [recentActivity, setRecentActivity] = useState<Visit[]>([]);


  useEffect(() => {
    if (user && user.role === 'CHR') {
      // For CHR, all visits are relevant for summary.
      setReportsToSummarize(mockVisitReportInputs);

      const totalUsers = mockUsers.length;
      const totalBranches = mockBranches.length;
      const totalVisits = mockVisits.length;
      const avgVisits = totalBranches > 0 ? (totalVisits / totalBranches).toFixed(1) : "0.0";
      setKeyStats({ totalUsers, totalBranches, totalVisits, avgVisitsPerBranch: avgVisits });

      const sortedRecentVisits = [...mockVisits].sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()).slice(0,5);
      setRecentActivity(sortedRecentVisits);
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="CHR Global Overview" description="Holistic summary of all branches, users, and AI-powered insights." />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Employees" value={keyStats.totalUsers} icon={Users} description="All personnel in the system."/>
        <StatCard title="Total Branches" value={keyStats.totalBranches} icon={Building} description="Nationwide branch network."/>
        <StatCard title="Total Visits Logged" value={keyStats.totalVisits} icon={CalendarCheck} description="Across all branches."/>
        <StatCard title="Avg Visits/Branch" value={keyStats.avgVisitsPerBranch} icon={BarChartHorizontalBig} description="Average engagement per branch."/>
      </div>

      <VisitSummaryAi visitReports={reportsToSummarize} />

      <div className="mt-8">
        <DataTable
            title="Most Recent Activity"
            columns={recentVisitsColumns}
            data={recentActivity}
            emptyStateMessage="No recent activity recorded."
        />
      </div>
      {/* Placeholder for other global overview elements like compliance status, key alerts etc. */}
       <div className="mt-8 p-6 bg-card rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><CheckCircle2 className="w-6 h-6 mr-2 text-green-500"/> System Status</h3>
        <p className="text-muted-foreground">All systems operational. Data up-to-date as of {new Date().toLocaleDateString()}.</p>
      </div>
    </div>
  );
}
