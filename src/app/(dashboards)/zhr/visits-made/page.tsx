
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
import { Loader2, Eye, Search, XCircle } from 'lucide-react';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function ZHRVisitsMadePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [bhrFilter, setBhrFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  const [bhrOptions, setBhrOptions] = useState<User[]>([]);
  const [branchOptions, setBranchOptions] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  const columns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id',
      header: 'BHR Name',
      cell: (visit) => {
        const bhr = bhrOptions.find(b => b.id === visit.bhr_id);
        return bhr ? bhr.name : visit.bhr_id;
      }
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch Name',
      cell: (visit) => {
        const branch = branchOptions.find(b => b.id === visit.branch_id);
        return branch ? branch.name : visit.branch_id;
      }
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP')
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (visit) => {
        const handleViewClick = () => {
          const branch = branchOptions.find(b => b.id === visit.branch_id);
          const bhr = bhrOptions.find(u => u.id === visit.bhr_id);
          const enrichedVisit: EnrichedVisitForModal = {
            ...visit,
            branch_name_display: branch?.name || visit.branch_id,
            branch_category_display: branch?.category,
            branch_code_display: branch?.code,
            bhr_name_display: bhr?.name || visit.bhr_id,
          };
          setSelectedVisitForView(enrichedVisit);
          setIsViewModalOpen(true);
        };
        return (
          <Button
            onClick={handleViewClick}
            className="h-9 px-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-colors duration-150"
          >
            <Eye className="mr-1.5 h-4 w-4 text-slate-500" /> View
          </Button>
        );
      }
    }
  ], [bhrOptions, branchOptions]);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'ZHR') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    console.log("ZHRVisitsMadePage: Fetching data for ZHR:", user.id);

    try {
      const { data: bhrsData, error: bhrsError } = await supabase
        .from('users')
        .select('id, name, e_code')
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

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location, category, code');

      if (branchesError) {
        console.error("ZHRVisitsMadePage: Error fetching branches:", branchesError);
        toast({ title: "Error", description: `Failed to fetch branches: ${branchesError.message}`, variant: "destructive" });
        setBranchOptions([]);
      } else {
        setBranchOptions(branchesData || []);
        console.log("ZHRVisitsMadePage: Fetched Branches:", branchesData);
      }

      if (bhrsData && bhrsData.length > 0) {
        const bhrIds = bhrsData.map(bhr => bhr.id);
        const { data: visitsData, error: visitsError } = await supabase
          .from('visits')
          .select('*')
          .in('bhr_id', bhrIds)
          .eq('status', 'submitted')
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
        setAllVisits([]);
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
    const lowerSearchTerm = searchTerm.toLowerCase();

    return allVisits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      const dateMatch = !dateRange ||
                        (dateRange.from && !dateRange.to && visitDate >= dateRange.from) ||
                        (dateRange.from && dateRange.to && isWithinInterval(visitDate, { start: dateRange.from, end: dateRange.to }));

      const bhrMatch = (bhrFilter === 'all' || visit.bhr_id === bhrFilter);
      const branchMatch = (branchFilter === 'all' || visit.branch_id === branchFilter);

      let searchCriteriaMatch = true;
      if (lowerSearchTerm) {
        const bhr = bhrOptions.find(b => b.id === visit.bhr_id);
        const branch = branchOptions.find(b => b.id === visit.branch_id);
        searchCriteriaMatch = (bhr?.name?.toLowerCase().includes(lowerSearchTerm) ||
                               branch?.name?.toLowerCase().includes(lowerSearchTerm) ||
                               (bhr?.e_code && bhr.e_code.toLowerCase().includes(lowerSearchTerm)) ||
                               (branch?.location && branch.location.toLowerCase().includes(lowerSearchTerm)));
      }

      return bhrMatch && branchMatch && dateMatch && searchCriteriaMatch;
    });
  }, [allVisits, bhrFilter, branchFilter, dateRange, searchTerm, bhrOptions, branchOptions]);

  const handleClearFilters = () => {
    setBhrFilter('all');
    setBranchFilter('all');
    setDateRange(undefined);
    setSearchTerm('');
  };

  if (!user) return null;

  if (isLoading && user.role === 'ZHR' && allVisits.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading submitted visits for your zone...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Submitted Visits in Zone" description="Browse and filter all submitted visits conducted by BHRs in your zone." />

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-4 !pb-4 border-b">
            <h3 className="text-lg font-semibold">Filters</h3>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <Label htmlFor="search-visits" className="sr-only">Search</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-visits"
                  placeholder="Search by BHR, Branch, E-Code, Location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
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
              <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full lg:col-span-1"/>
              <Button onClick={handleClearFilters} variant="outline" className="w-full lg:col-span-2">
                <XCircle className="mr-2 h-4 w-4" /> Clear All Filters
              </Button>
            </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredVisits}
        tableClassName="[&_thead_th]:bg-slate-50/80 [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:text-slate-600 [&_thead_th]:h-14 [&_thead_th]:px-6 [&_thead]:border-b [&_thead]:border-slate-200/60 [&_tbody_td]:px-6 [&_tbody_td]:py-4 [&_tbody_td]:text-sm [&_tbody_tr:hover]:bg-blue-50/30 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100/60 [&_tr]:transition-colors [&_td]:align-middle [&_tbody_tr:last-child]:border-0"
        emptyStateMessage={isLoading ? "Loading visits..." : (allVisits.length === 0 ? "No submitted visits found for BHRs in your zone." : "No submitted visits match your current filters.")}
      />
      {selectedVisitForView && (
        <ViewVisitDetailsModal
            visit={selectedVisitForView}
            isOpen={isViewModalOpen}
            onClose={() => {
                setIsViewModalOpen(false);
                setSelectedVisitForView(null);
            }}
        />
      )}
    </div>
  );
}
