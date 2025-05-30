
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { VisitSummaryAi } from '@/components/chr/visit-summary-ai';
import { mockVisits, mockUsers, mockBranches, getVisibleVisits } from '@/lib/mock-data'; 
import type { VisitReportInput } from '@/types';
import { StatCard } from '@/components/shared/stat-card';
import { Users, Building, CalendarCheck, BarChartHorizontalBig, CheckCircle2 } from 'lucide-react';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { Visit } from '@/types';
import { format } from 'date-fns';

const recentVisitsColumns: ColumnConfig<Visit>[] = [
  { 
    accessorKey: 'bhr_id', 
    header: 'BHR',
    cell: (row) => mockUsers.find(u=>u.id === row.bhr_id)?.name || 'N/A'
  },
  { 
    accessorKey: 'branch_id', 
    header: 'Branch',
    cell: (row) => mockBranches.find(b=>b.id === row.branch_id)?.name || 'N/A'
  },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => format(new Date(row.visit_date), 'PPP')
  },
  { 
    accessorKey: 'additional_remarks', 
    header: 'Summary',
    cell: (row) => <p className="truncate max-w-xs">{row.additional_remarks}</p>
  },
];

export default function CHRGlobalOverviewPage() {
  const { user } = useAuth();
  const [reportsToSummarize, setReportsToSummarize] = useState<VisitReportInput[]>([]);
  const [keyStats, setKeyStats] = useState({
    totalUsers: 0,
    totalBranches: 0,
    totalSubmittedVisits: 0,
    avgSubmittedVisitsPerBranch: "0.0"
  });
  const [recentSubmittedActivity, setRecentSubmittedActivity] = useState<Visit[]>([]);


  useEffect(() => {
    if (user && user.role === 'CHR') {
      const submittedVisits = getVisibleVisits(user); 
      
      const reportsForAI = submittedVisits.map(v => {
        const bhr = mockUsers.find(u => u.id === v.bhr_id);
        const branch = mockBranches.find(b => b.id === v.branch_id);
        return {
          branch: branch?.name || 'Unknown Branch',
          visitDate: v.visit_date,
          notes: v.additional_remarks || '',
          bhr: bhr?.name || 'Unknown BHR',
        };
      });
      setReportsToSummarize(reportsForAI);

      const totalUsers = mockUsers.length;
      const totalBranches = mockBranches.length;
      const totalVisitsCount = submittedVisits.length;
      const avgVisits = totalBranches > 0 ? (totalVisitsCount / totalBranches).toFixed(1) : "0.0";
      setKeyStats({ 
        totalUsers, 
        totalBranches, 
        totalSubmittedVisits: totalVisitsCount, 
        avgSubmittedVisitsPerBranch: avgVisits 
      });

      const sortedRecentVisits = [...submittedVisits].sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()).slice(0,5);
      setRecentSubmittedActivity(sortedRecentVisits);
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="CHR Global Overview (Submitted Data)" description="Holistic summary of all branches, users, and AI-powered insights from submitted reports." />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Employees" value={keyStats.totalUsers} icon={Users} description="All personnel in the system."/>
        <StatCard title="Total Branches" value={keyStats.totalBranches} icon={Building} description="Nationwide branch network."/>
        <StatCard title="Total Submitted Visits" value={keyStats.totalSubmittedVisits} icon={CalendarCheck} description="Across all branches."/>
        <StatCard title="Avg Submitted Visits/Branch" value={keyStats.avgSubmittedVisitsPerBranch} icon={BarChartHorizontalBig} description="Average engagement per branch."/>
      </div>

      <VisitSummaryAi visitReports={reportsToSummarize} />

      <div className="mt-8">
        <DataTable
            title="Most Recent Submitted Activity"
            columns={recentVisitsColumns}
            data={recentSubmittedActivity}
            emptyStateMessage="No recent submitted activity recorded."
        />
      </div>
      <div className="mt-8 p-6 bg-card rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-primary mb-3 flex items-center"><CheckCircle2 className="w-6 h-6 mr-2 text-green-500"/> System Status</h3>
        <p className="text-muted-foreground">All systems operational. Data up-to-date as of {new Date().toLocaleDateString()}.</p>
      </div>
    </div>
  );
}
