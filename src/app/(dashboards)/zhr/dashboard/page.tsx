
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Visit } from '@/types';
import { mockUsers, mockBranches, mockVisits, getVisibleUsers, getVisibleVisits, getVisibleBranchesForZHR } from '@/lib/mock-data';
import { Users, Building, CalendarDays, Activity } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { format } from 'date-fns';


const recentVisitsColumns: ColumnConfig<Visit>[] = [
  { accessorKey: 'bhr_name', header: 'BHR Name' },
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

export default function ZHRDashboardPage() {
  const { user } = useAuth();
  const [bhrCount, setBhrCount] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [assignedBranchesCount, setAssignedBranchesCount] = useState(0);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [visitsByBHRData, setVisitsByBHRData] = useState<{name: string, value: number}[]>([]);

  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const visibleUsers = getVisibleUsers(user);
      const bhrsUnderZhr = visibleUsers.filter(u => u.role === 'BHR' && u.reports_to === user.id);
      setBhrCount(bhrsUnderZhr.length);

      const visitsInZone = getVisibleVisits(user);
      setTotalVisits(visitsInZone.length);
      setRecentVisits(visitsInZone.sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()).slice(0,5));
      
      const branchesInZone = getVisibleBranchesForZHR(user.id);
      setAssignedBranchesCount(branchesInZone.length);

      // Data for chart: Visits per BHR
      const visitsPerBhrMap = new Map<string, number>();
      visitsInZone.forEach(visit => {
        visitsPerBhrMap.set(visit.bhr_name, (visitsPerBhrMap.get(visit.bhr_name) || 0) + 1);
      });
      setVisitsByBHRData(Array.from(visitsPerBhrMap).map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` })));

    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="ZHR Dashboard" description={`Zone overview for ${user.name}.`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="BHRs in Zone" value={bhrCount} icon={Users} description="Total BHRs reporting to you." />
        <StatCard title="Total Visits in Zone" value={totalVisits} icon={CalendarDays} description="Visits recorded by your BHRs." />
        <StatCard title="Branches in Zone" value={assignedBranchesCount} icon={Building} description="Total branches managed by your BHRs." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderBarChart
            data={visitsByBHRData}
            title="Visits per BHR"
            description="Number of visits conducted by each BHR in your zone."
            xAxisKey="name"
            dataKey="value"
        />
        {/* Could add another chart, e.g., visits by branch pie chart */}
         <DataTable
          columns={recentVisitsColumns}
          data={recentVisits}
          title="Recent Visits in Your Zone"
          emptyStateMessage="No recent visits in your zone."
        />
      </div>
    </div>
  );
}
