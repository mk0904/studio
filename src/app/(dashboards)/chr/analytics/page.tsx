
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User, VisitStatus } from '@/types'; // Import VisitStatus
import { mockBranches, mockUsers, mockVisits } from '@/lib/mock-data'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';

const visitColumns: ColumnConfig<Visit>[] = [
  { accessorKey: 'bhr_name', header: 'BHR' },
  { accessorKey: 'branch_name', header: 'Branch' },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => format(new Date(row.visit_date), 'PPP')
  },
  { 
    accessorKey: 'status', 
    header: 'Status',
    cell: (row) => {
      if (!row.status) return <Badge variant="outline">Unknown</Badge>;
      let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
      if (row.status === 'submitted') variant = 'secondary'; 
      return <Badge variant={variant} className="capitalize">{row.status}</Badge>;
    }
  },
  { 
    accessorKey: 'additional_remarks', 
    header: 'Summary',
    cell: (row) => <p className="truncate max-w-xs">{row.additional_remarks || row.notes || 'N/A'}</p>
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
      setZhrOptions(mockUsers.filter(u => u.role === 'ZHR')); 
      setBhrOptions(mockUsers.filter(u => u.role === 'BHR')); 
      setBranchOptions(mockBranches);
    }
  }, [user]);

  useEffect(() => {
    if (vhrFilter && vhrFilter !== 'all') {
        setZhrOptions(mockUsers.filter(u => u.role === 'ZHR' && u.reports_to === vhrFilter));
        setBhrOptions([]); 
        setBhrFilter(''); 
    } else {
        setZhrOptions(mockUsers.filter(u => u.role === 'ZHR')); 
        setBhrOptions(mockUsers.filter(u => u.role === 'BHR'));
    }
    if (vhrFilter === 'all' || !vhrFilter) { 
      setZhrFilter('');
    }
  }, [vhrFilter]);

  useEffect(() => {
    if (zhrFilter && zhrFilter !== 'all') {
        setBhrOptions(mockUsers.filter(u => u.role === 'BHR' && u.reports_to === zhrFilter));
    } else if (vhrFilter && vhrFilter !== 'all') { 
        const zhrIdsUnderVhr = mockUsers.filter(u=>u.role === 'ZHR' && u.reports_to === vhrFilter).map(u=>u.id);
        setBhrOptions(mockUsers.filter(u => u.role === 'BHR' && zhrIdsUnderVhr.includes(u.reports_to || '')));
    } else {
        setBhrOptions(mockUsers.filter(u => u.role === 'BHR')); 
    }
    if (zhrFilter === 'all' || !zhrFilter) { 
      setBhrFilter('');
    }
  }, [zhrFilter, vhrFilter]);


  const filteredVisits = useMemo(() => {
    if (!user) return [];
    let visits = mockVisits; 

    if (bhrFilter && bhrFilter !== 'all') {
      visits = visits.filter(v => v.bhr_id === bhrFilter);
    } else if (zhrFilter && zhrFilter !== 'all') {
      const bhrIdsUnderZhr = mockUsers.filter(u => u.role === 'BHR' && u.reports_to === zhrFilter).map(u => u.id);
      visits = visits.filter(v => bhrIdsUnderZhr.includes(v.bhr_id));
    } else if (vhrFilter && vhrFilter !== 'all') {
      const zhrIdsUnderVhr = mockUsers.filter(u => u.role === 'ZHR' && u.reports_to === vhrFilter).map(u => u.id);
      const bhrIdsUnderVhrSourcedZhrs = mockUsers.filter(u => u.role === 'BHR' && zhrIdsUnderVhr.includes(u.reports_to || '')).map(u => u.id);
      visits = visits.filter(v => bhrIdsUnderVhrSourcedZhrs.includes(v.bhr_id));
    }

    if (branchFilter && branchFilter !== 'all') {
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
    const visitsPerSelectedHierarchy = filteredVisits.reduce((acc, visit) => {
      let key = 'Overall'; 
      const bhrUser = mockUsers.find(u=>u.id === visit.bhr_id);

      if (bhrFilter && bhrFilter !== 'all' && bhrUser?.id === bhrFilter) {
          key = bhrUser.name;
      } else if (zhrFilter && zhrFilter !== 'all' && bhrUser?.reports_to === zhrFilter) {
          const zhrUser = mockUsers.find(u=>u.id === zhrFilter);
          key = zhrUser ? zhrUser.name : `BHRs under ZHR ${zhrFilter}`;
      } else if (vhrFilter && vhrFilter !== 'all') {
          const zhrUser = mockUsers.find(u=>u.id === bhrUser?.reports_to);
          if (zhrUser?.reports_to === vhrFilter) {
            const vhrUser = mockUsers.find(u=>u.id === vhrFilter);
            key = vhrUser ? vhrUser.name : `ZHRs under VHR ${vhrFilter}`;
          } else {
            key = "Other Verticals"; 
          }
      }
      
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
                    <SelectContent><SelectItem value="all">All VHRs</SelectItem>{vhrOptions.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={zhrFilter} onValueChange={setZhrFilter} disabled={vhrFilter && vhrFilter !== 'all' && zhrOptions.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Filter by ZHR..." /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All ZHRs</SelectItem>{zhrOptions.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={bhrFilter} onValueChange={setBhrFilter} disabled={(vhrFilter && vhrFilter !== 'all' || zhrFilter && zhrFilter !== 'all') && bhrOptions.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Filter by BHR..." /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All BHRs</SelectItem>{bhrOptions.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter by Branch..." /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Branches</SelectItem>{branchOptions.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
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
