
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { getVisibleVisits, getVisibleUsers, mockBranches } from '@/lib/mock-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function VHRAnalyticsPage() {
  const { user } = useAuth();
  
  const [zhrFilter, setZhrFilter] = useState<string>('');
  const [bhrFilter, setBhrFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const [zhrOptions, setZhrOptions] = useState<User[]>([]);
  const [bhrOptions, setBhrOptions] = useState<User[]>([]);
  const [branchOptions, setBranchOptions] = useState<Branch[]>([]);

  const [visitsByBranchData, setVisitsByBranchData] = useState<{ name: string; value: number }[]>([]);
  const [visitTrendsData, setVisitTrendsData] = useState<{ name: string; value: number }[]>([]);


  useEffect(() => {
    if (user && user.role === 'VHR') {
      const usersInVertical = getVisibleUsers(user);
      const zhrs = usersInVertical.filter(u => u.role === 'ZHR' && u.reports_to === user.id);
      setZhrOptions(zhrs);
      
      // Populate BHR options based on initial ZHR filter (which is empty or 'all')
      if (zhrFilter && zhrFilter !== 'all') {
        setBhrOptions(usersInVertical.filter(u => u.role === 'BHR' && u.reports_to === zhrFilter));
      } else {
        setBhrOptions(usersInVertical.filter(u => u.role === 'BHR'));
      }
      setBranchOptions(mockBranches); // For simplicity, all branches. Could be filtered by ZHR/BHR assignments.
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'VHR') {
      const usersInVertical = getVisibleUsers(user);
      if (zhrFilter && zhrFilter !== 'all') {
        setBhrOptions(usersInVertical.filter(u => u.role === 'BHR' && u.reports_to === zhrFilter));
      } else {
        // If ZHR is "All" or not set, show all BHRs in the VHR's vertical
        setBhrOptions(usersInVertical.filter(u => u.role === 'BHR'));
      }
    }
  }, [user, zhrFilter]);


  const filteredVisits = useMemo(() => {
    if (!user) return [];
    let visits = getVisibleVisits(user);

    if (bhrFilter && bhrFilter !== 'all') {
      visits = visits.filter(v => v.bhr_id === bhrFilter);
    } else if (zhrFilter && zhrFilter !== 'all') {
      // Filter by BHRs under the selected ZHR if no specific BHR is chosen
      const bhrIdsUnderSelectedZhr = getVisibleUsers(user).filter(u => u.role === 'BHR' && u.reports_to === zhrFilter).map(u => u.id);
      visits = visits.filter(v => bhrIdsUnderSelectedZhr.includes(v.bhr_id));
    }
    // If bhrFilter is 'all' or empty, and zhrFilter is 'all' or empty, no user-based filtering is done here,
    // as getVisibleVisits(user) already scopes to the VHR's vertical.

    if (branchFilter && branchFilter !== 'all') {
      visits = visits.filter(v => v.branch_id === branchFilter);
    }

    if (dateRange?.from && dateRange?.to) {
      visits = visits.filter(v => isWithinInterval(parseISO(v.visit_date), { start: dateRange.from!, end: dateRange.to! }));
    } else if (dateRange?.from) {
      visits = visits.filter(v => parseISO(v.visit_date) >= dateRange.from!);
    }
    return visits;
  }, [user, zhrFilter, bhrFilter, branchFilter, dateRange]);


  useEffect(() => {
    const visitsPerBranch = filteredVisits.reduce((acc, visit) => {
      acc[visit.branch_name] = (acc[visit.branch_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    setVisitsByBranchData(
      Object.entries(visitsPerBranch).map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` }))
    );

    const visitsPerMonth = filteredVisits.reduce((acc, visit) => {
      const monthYear = format(parseISO(visit.visit_date), 'MMM yyyy');
      acc[monthYear] = (acc[monthYear] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    setVisitTrendsData(
      Object.entries(visitsPerMonth).map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` })).sort((a,b)=> new Date(a.name).getTime() - new Date(b.name).getTime())
    );

  }, [filteredVisits]);


  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="VHR Analytics" description="Dive deep into visit data across your vertical." />

      <Card className="shadow-lg">
        <CardHeader className="border-b !pb-4">
            <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                <Select value={zhrFilter} onValueChange={(value) => {setZhrFilter(value); setBhrFilter('');}}>
                    <SelectTrigger><SelectValue placeholder="Filter by ZHR..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All ZHRs</SelectItem>
                        {zhrOptions.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={bhrFilter} onValueChange={setBhrFilter} disabled={bhrOptions.length === 0 && (!!zhrFilter && zhrFilter !== 'all') }>
                    <SelectTrigger><SelectValue placeholder="Filter by BHR..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All BHRs</SelectItem>
                        {bhrOptions.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter by Branch..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {branchOptions.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full"/>
                
                <Button onClick={() => { setZhrFilter(''); setBhrFilter(''); setBranchFilter(''); setDateRange(undefined); }} variant="outline" className="w-full">
                    Clear Filters
                </Button>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderBarChart
          data={visitTrendsData}
          title="Visit Trends Over Time"
          description="Monthly visit counts across the vertical."
          xAxisKey="name"
          dataKey="value"
          fillColor="var(--color-accent)"
        />
        <PlaceholderPieChart
          data={visitsByBranchData}
          title="Visits by Branch"
          description="Distribution of visits across different branches."
          dataKey="value"
          nameKey="name"
        />
      </div>
    </div>
  );
}
