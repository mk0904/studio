
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, Visit } from '@/types';
import { mockBranches, mockVisits, getVisibleBranchesForBHR, getVisibleVisits } from '@/lib/mock-data';
import { Building, CalendarCheck, ListChecks, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const branchColumns: ColumnConfig<Branch>[] = [
  { accessorKey: 'name', header: 'Branch Name' },
  { accessorKey: 'location', header: 'Location' },
];

const visitColumns: ColumnConfig<Visit>[] = [
  { accessorKey: 'branch_name', header: 'Branch' },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => new Date(row.visit_date).toLocaleDateString(),
  },
  { 
    accessorKey: 'notes', 
    header: 'Summary',
    cell: (row) => <p className="truncate max-w-xs">{row.notes}</p>
  },
];

export default function BHRDashboardPage() {
  const { user } = useAuth();
  const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);

  useEffect(() => {
    if (user && user.role === 'BHR') {
      setAssignedBranches(getVisibleBranchesForBHR(user.id));
      const bhrVisits = getVisibleVisits(user).sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
      setRecentVisits(bhrVisits.slice(0, 5)); // Display top 5 recent visits
    }
  }, [user]);

  if (!user) return null; // Or loading state

  return (
    <div className="space-y-8">
      <PageTitle title="BHR Dashboard" description={`Welcome back, ${user.name}!`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard 
          title="Assigned Branches" 
          value={assignedBranches.length} 
          icon={Building}
          description="Total branches under your responsibility."
        />
        <StatCard 
          title="Total Visits Logged" 
          value={getVisibleVisits(user).length} 
          icon={CalendarCheck}
          description="All visits you have recorded."
        />
         <Link href="/bhr/new-visit" passHref>
            <Card className="flex flex-col items-center justify-center h-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors cursor-pointer shadow-lg">
              <CardHeader className="pb-2">
                <PlusCircle className="h-10 w-10" />
              </CardHeader>
              <CardContent className="text-center">
                <CardTitle className="text-lg font-semibold">Log New Visit</CardTitle>
                <CardDescription className="text-accent-foreground/80">Quickly add a new branch visit report.</CardDescription>
              </CardContent>
            </Card>
          </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataTable
          columns={branchColumns}
          data={assignedBranches}
          title="My Assigned Branches"
          emptyStateMessage="No branches assigned to you yet."
        />
        <DataTable
          columns={visitColumns}
          data={recentVisits}
          title="Recent Visits Summary"
          emptyStateMessage="No visits logged yet."
        />
      </div>
    </div>
  );
}
