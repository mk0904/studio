
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { getVisibleVisits, getVisibleUsers, mockBranches, mockUsers } from '@/lib/mock-data'; // CHR sees all
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';

const visitColumns: ColumnConfig<Visit>[] = [
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


export default function CHRAnalyticsPage() {
  const { user } = useAuth();
  
  const [vhrFilter, setVhrFilter] = useState<string>('');
  const [zhrFilter, setZhrFilter] = useState<string>('');
  const [bhrFilter, setBhrFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const [vhrOptions, setVhrOptions] = useState<User[]>([]);
  const [zhrOptions, setZhrOptions] = useState<User[]>([]);
  const [bhrOptions, setBhrOptions] = useState<User[]>([]);
  const [branchOptions, setBranchOptions] = useState<Branch[]>([]);
  
  const [chartData1, setChartData1] = useState<{ name: string; value: number }[]>([]);
  const [chartData2, setChartData2] = useState<{ name: string; value: number }[]>([]);


  useEffect(() => {
    if (user && user.role === 'CHR') {
      setVhrOptions(mockUsers.filter(u => u.role === 'VHR'));
      setZhrOptions(mockUsers.filter(u => u.role === 'ZHR')); // Initially all ZHRs
      setBhrOptions(mockUsers.filter(u => u.role === 'BHR')); // Initially all BHRs
      setBranchOptions(mockBranches);
    }
  }, [user]);

  useEffect(() => {
    if (vhrFilter) {
        setZhrOptions(mockUsers.filter(u => u.role === 'ZHR' && u.reports_to === vhrFilter));
        setBhrOptions([]); // Clear BHRs when VHR changes
        setBhrFilter(''); 
    } else {
        setZhrOptions(mockUsers.filter(u => u.role === 'ZHR')); // All ZHRs if no VHR selected
    }
    setZhrFilter(''); // Clear ZHR filter when VHR changes
  }, [vhrFilter]);

  useEffect(() => {
    if (zhrFilter) {
        setBhrOptions(mockUsers.filter(u => u.role === 'BHR' && u.reports_to === zhrFilter));
    } else if (vhrFilter) { // if VHR is selected but ZHR is not, show all BHRs under that VHR
        const zhrIdsUnderVhr = mockUsers.filter(u=>u.role === 'ZHR' && u.reports_to === vhrFilter).map(u=>u.id);
        setBhrOptions(mockUsers.filter(u => u.role === 'BHR' && zhrIdsUnderVhr.includes(u.reports_to || '')));
    } else {
        setBhrOptions(mockUsers.filter(u => u.role === 'BHR')); // All BHRs if no ZHR/VHR selected
    }
    setBhrFilter(''); // Clear BHR filter when ZHR changes
  }, [zhrFilter, vhrFilter]);


  const filteredVisits = useMemo(() => {
    if (!user) return [];
    let visits = mockVisits; // CHR sees all visits initially

    if (bhrFilter) {
      visits = visits.filter(v => v.bhr_id === bhrFilter);
    } else if (zhrFilter) {
      const bhrIdsUnderZhr = mockUsers.filter(u => u.role === 'BHR' && u.reports_to === zhrFilter).map(u => u.id);
      visits = visits.filter(v => bhrIdsUnderZhr.includes(v.bhr_id));
    } else if (vhrFilter) {
      const zhrIdsUnderVhr = mockUsers.filter(u => u.role === 'ZHR' && u.reports_to === vhrFilter).map(u => u.id);
      const bhrIdsUnderVhrSourcedZhrs = mockUsers.filter(u => u.role === 'BHR' && zhrIdsUnderVhr.includes(u.reports_to || '')).map(u => u.id);
      visits = visits.filter(v => bhrIdsUnderVhrSourcedZhrs.includes(v.bhr_id));
    }

    if (branchFilter) {
      visits = visits.filter(v => v.branch_id === branchFilter);
    }
    if (dateRange?.from && dateRange?.to) {
      visits = visits.filter(v => isWithinInterval(parseISO(v.visit_date), { start: dateRange.from!, end: dateRange.to! }));
    } else if (dateRange?.from) {
       visits = visits.filter(v => parseISO(v.visit_date) >= dateRange.from!);
    }
    return visits.sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
  }, [user, vhrFilter, zhrFilter, bhrFilter, branchFilter, dateRange]);


  useEffect(() => {
    // Update chart data based on filteredVisits
    const visitsPerSelectedHierarchy = filteredVisits.reduce((acc, visit) => {
      let key = 'Overall';
      if (bhrFilter) key = mockUsers.find(u=>u.id === visit.bhr_id)?.name || 'Unknown BHR';
      else if (zhrFilter) key = mockUsers.find(u=>u.id === visit.bhr_id)?.reports_to === zhrFilter ? mockUsers.find(u=>u.id === zhrFilter)?.name || 'Unknown ZHR' : 'Other'; // simplified
      else if (vhrFilter) key = mockUsers.find(u=>u.id === visit.bhr_id && u.reports_to && mockUsers.find(z=>z.id === u.reports_to)?.reports_to === vhrFilter) ? mockUsers.find(u=>u.id === vhrFilter)?.name || 'Unknown VHR': 'Other'; // simplified
      
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    setChartData1(Object.entries(visitsPerSelectedHierarchy).map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` })));

    const visitsPerMonth = filteredVisits.reduce((acc, visit) => {
      const monthYear = format(parseISO(visit.visit_date), 'MMM yyyy');
      acc[monthYear] = (acc[monthYear] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    setChartData2(Object.entries(visitsPerMonth).map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` })).sort((a,b)=> new Date(a.name).getTime() - new Date(b.name).getTime()));

  }, [filteredVisits, bhrFilter, zhrFilter, vhrFilter]);


  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="CHR Global Analytics" description="Comprehensive analytics across all HR levels and branches." />

      <Card className="shadow-lg">
        <CardHeader className="border-b !pb-4">
            <CardTitle>Global Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <Select value={vhrFilter} onValueChange={setVhrFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter by VHR..." /></SelectTrigger>
                    <SelectContent><SelectItem value="">All VHRs</SelectItem>{vhrOptions.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={zhrFilter} onValueChange={setZhrFilter} disabled={zhrOptions.length === 0 && !!vhrFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter by ZHR..." /></SelectTrigger>
                    <SelectContent><SelectItem value="">All ZHRs</SelectItem>{zhrOptions.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={bhrFilter} onValueChange={setBhrFilter} disabled={bhrOptions.length === 0 && (!!zhrFilter || !!vhrFilter)}>
                    <SelectTrigger><SelectValue placeholder="Filter by BHR..." /></SelectTrigger>
                    <SelectContent><SelectItem value="">All BHRs</SelectItem>{bhrOptions.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter by Branch..." /></SelectTrigger>
                    <SelectContent><SelectItem value="">All Branches</SelectItem>{branchOptions.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full"/>
                <Button onClick={() => { setVhrFilter(''); setZhrFilter(''); setBhrFilter(''); setBranchFilter(''); setDateRange(undefined); }} variant="outline" className="w-full">
                    Clear Filters
                </Button>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderBarChart data={chartData1} title="Visits Overview (Filtered)" xAxisKey="name" dataKey="value" />
        <PlaceholderPieChart data={chartData2} title="Monthly Visit Trend (Filtered)" dataKey="value" nameKey="name" />
      </div>
      
      <DataTable
        title="Filtered Visit Data"
        columns={visitColumns}
        data={filteredVisits}
        emptyStateMessage="No visits match current filters."
       />
    </div>
  );
}

