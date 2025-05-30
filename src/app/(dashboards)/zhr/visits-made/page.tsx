
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { getVisibleVisits, getVisibleUsers, mockBranches, getVisibleBranchesForZHR } from '@/lib/mock-data';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/shared/date-range-picker'; // Assuming this component exists or will be created
import type { DateRange } from 'react-day-picker';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const columns: ColumnConfig<Visit>[] = [
  { accessorKey: 'bhr_name', header: 'BHR Name' },
  { accessorKey: 'branch_name', header: 'Branch Name' },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => format(new Date(row.visit_date), 'PPP') 
  },
  { 
    accessorKey: 'notes', 
    header: 'Notes',
    cell: (row) => <p className="max-w-md whitespace-pre-wrap break-words">{row.notes}</p>
  },
];

export default function ZHRVisitsMadePage() {
  const { user } = useAuth();
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [bhrFilter, setBhrFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const [bhrOptions, setBhrOptions] = useState<User[]>([]);
  const [branchOptions, setBranchOptions] = useState<Branch[]>([]);

  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const visits = getVisibleVisits(user).sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
      setAllVisits(visits);
      
      const bhrsInZone = getVisibleUsers(user).filter(u => u.role === 'BHR' && u.reports_to === user.id);
      setBhrOptions(bhrsInZone);

      const branchesInZone = getVisibleBranchesForZHR(user.id);
      setBranchOptions(branchesInZone);
    }
  }, [user]);

  const filteredVisits = useMemo(() => {
    return allVisits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      const dateMatch = !dateRange || (dateRange.from && dateRange.to && isWithinInterval(visitDate, { start: dateRange.from, end: dateRange.to })) || (dateRange.from && !dateRange.to && visitDate >= dateRange.from) ;

      return (
        (bhrFilter === '' || visit.bhr_id === bhrFilter) &&
        (branchFilter === '' || visit.branch_id === branchFilter) &&
        dateMatch
      );
    });
  }, [allVisits, bhrFilter, branchFilter, dateRange]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="Visits Made in Zone" description="Browse and filter all visits conducted by BHRs in your zone." />
      
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-4 !pb-4 border-b">
            <h3 className="text-lg font-semibold">Filters</h3>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Select value={bhrFilter} onValueChange={setBhrFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by BHR..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="">All BHRs</SelectItem>
                    {bhrOptions.map(bhr => <SelectItem key={bhr.id} value={bhr.id}>{bhr.name}</SelectItem>)}
                </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger><SelectValue placeholder="Filter by Branch..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="">All Branches</SelectItem>
                    {branchOptions.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
                </Select>
                
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full"/>

                <Button onClick={() => { setBhrFilter(''); setBranchFilter(''); setDateRange(undefined); }} variant="outline">
                Clear Filters
                </Button>
            </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredVisits}
        emptyStateMessage="No visits match your current filters."
      />
    </div>
  );
}
