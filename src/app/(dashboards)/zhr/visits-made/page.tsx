
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ZHRVisitsMadePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [bhrFilter, setBhrFilter] = useState<string>('all'); 
  const [branchFilter, setBranchFilter] = useState<string>('all'); 
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const [bhrOptions, setBhrOptions] = useState<User[]>([]);
  const [branchOptions, setBranchOptions] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const columns: ColumnConfig<Visit>[] = [
    { 
      accessorKey: 'bhr_id', 
      header: 'BHR Name',
      cell: (visit) => {
        const bhr = bhrOptions.find(b => b.id === visit.bhr_id);
        return bhr ? bhr.name : visit.bhr_id; // Fallback to ID if name not found
      }
    },
    { 
      accessorKey: 'branch_id', 
      header: 'Branch Name',
      cell: (visit) => {
        const branch = branchOptions.find(b => b.id === visit.branch_id);
        return branch ? branch.name : visit.branch_id; // Fallback to ID
      }
    },
    { 
      accessorKey: 'visit_date', 
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP') 
    },
    // Removed 'Notes' column
  ];

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'ZHR') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    console.log("ZHRVisitsMadePage: Fetching data for ZHR:", user.id);

    try {
      // 1. Fetch BHRs that report to the current ZHR
      const { data: bhrsData, error: bhrsError } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'BHR')
        .eq('reports_to', user.id);

      if (bhrsError) {
        console.error("ZHRVisitsMadePage: Error fetching BHRs:", bhrsError);
        toast({ title: "Error", description: `Failed to fetch BHRs: ${bhrsError.message}`, variant: "destructive" });
        setBhrOptions([]);
      } else {
        setBhrOptions(bhrsData || []);
        console.log("ZHRVisitsMadePage: Fetched BHRs:", bhrsData);
      }

      // 2. Fetch all branches for filter and name lookup
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location'); 

      if (branchesError) {
        console.error("ZHRVisitsMadePage: Error fetching branches:", branchesError);
        toast({ title: "Error", description: `Failed to fetch branches: ${branchesError.message}`, variant: "destructive" });
        setBranchOptions([]);
      } else {
        setBranchOptions(branchesData || []);
        console.log("ZHRVisitsMadePage: Fetched Branches:", branchesData);
      }
      
      // 3. Fetch visits made by these BHRs
      if (bhrsData && bhrsData.length > 0) {
        const bhrIds = bhrsData.map(bhr => bhr.id);
        const { data: visitsData, error: visitsError } = await supabase
          .from('visits')
          .select('*')
          .in('bhr_id', bhrIds)
          .order('visit_date', { ascending: false });

        if (visitsError) {
          console.error("ZHRVisitsMadePage: Error fetching visits:", visitsError);
          toast({ title: "Error", description: `Failed to fetch visits: ${visitsError.message}`, variant: "destructive" });
          setAllVisits([]);
        } else {
          setAllVisits((visitsData as Visit[]) || []);
          console.log("ZHRVisitsMadePage: Fetched Visits:", visitsData);
        }
      } else {
        setAllVisits([]); // No BHRs, so no visits
        console.log("ZHRVisitsMadePage: No BHRs found for this ZHR, so no visits fetched.");
      }

    } catch (error: any) {
      console.error("ZHRVisitsMadePage: General error in fetchData:", error);
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
      setAllVisits([]);
      setBhrOptions([]);
      setBranchOptions([]);
    } finally {
      setIsLoading(false);
      console.log("ZHRVisitsMadePage: Fetching data finished.");
    }
  }, [user, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredVisits = useMemo(() => {
    return allVisits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      const dateMatch = !dateRange || 
                        (dateRange.from && !dateRange.to && visitDate >= dateRange.from) ||
                        (dateRange.from && dateRange.to && isWithinInterval(visitDate, { start: dateRange.from, end: dateRange.to }));

      const bhrMatch = (bhrFilter === 'all' || visit.bhr_id === bhrFilter);
      const branchMatch = (branchFilter === 'all' || visit.branch_id === branchFilter);

      return bhrMatch && branchMatch && dateMatch;
    });
  }, [allVisits, bhrFilter, branchFilter, dateRange]);

  if (!user) return null;

  if (isLoading && user.role === 'ZHR') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading visits for your zone...</p>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <PageTitle title="Visits Made in Zone" description="Browse and filter all visits conducted by BHRs in your zone." />
      
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-4 !pb-4 border-b">
            <h3 className="text-lg font-semibold">Filters</h3>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Select value={bhrFilter} onValueChange={setBhrFilter} disabled={bhrOptions.length === 0}>
                <SelectTrigger><SelectValue placeholder="Filter by BHR..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All BHRs</SelectItem>
                    {bhrOptions.map(bhr => <SelectItem key={bhr.id} value={bhr.id}>{bhr.name}</SelectItem>)}
                </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter} disabled={branchOptions.length === 0}>
                <SelectTrigger><SelectValue placeholder="Filter by Branch..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branchOptions.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                </SelectContent>
                </Select>
                
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full"/>

                <Button onClick={() => { setBhrFilter('all'); setBranchFilter('all'); setDateRange(undefined); }} variant="outline">
                Clear Filters
                </Button>
            </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredVisits}
        emptyStateMessage={isLoading ? "Loading visits..." : (allVisits.length === 0 ? "No visits found for BHRs in your zone." : "No visits match your current filters.")}
      />
    </div>
  );
}
