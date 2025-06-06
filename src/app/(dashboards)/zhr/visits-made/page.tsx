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
import { format, parseISO, isWithinInterval, formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, Search, XCircle, Users, Building2, Calendar, FileQuestion } from 'lucide-react';
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
        return <span className="font-medium text-slate-700">{bhr ? bhr.name : visit.bhr_id}</span>;
      }
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch Name',
      cell: (visit) => {
        const branch = branchOptions.find(b => b.id === visit.branch_id);
        return <span className="font-medium text-slate-700">{branch ? branch.name : visit.branch_id}</span>;
      }
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => {
        const date = parseISO(visit.visit_date);
        return (
          <div className="flex flex-col space-y-0.5">
            <span className="text-slate-700">{format(date, 'PPP')}</span>
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(date, { addSuffix: true })}
            </span>
          </div>
        );
      }
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
    try {
      const { data: bhrsData, error: bhrsError } = await supabase
        .from('users')
        .select('id, name, e_code, email, role')
        .eq('role', 'BHR')
        .eq('reports_to', user.id);

      if (bhrsError) throw bhrsError;
      setBhrOptions(bhrsData || []);

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location, category, code');
      if (branchesError) throw branchesError;
      setBranchOptions(branchesData || []);

      if (bhrsData && bhrsData.length > 0) {
        const bhrIds = bhrsData.map(bhr => bhr.id);
        const { data: visitsData, error: visitsError } = await supabase
          .from('visits')
          .select('*')
          .in('bhr_id', bhrIds)
          .eq('status', 'submitted')
          .order('visit_date', { ascending: false });
        if (visitsError) throw visitsError;
        setAllVisits((visitsData as Visit[]) || []);
      } else {
        setAllVisits([]);
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
      setAllVisits([]);
      setBhrOptions([]);
      setBranchOptions([]);
    } finally {
      setIsLoading(false);
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
        searchCriteriaMatch = (
          (bhr?.name && bhr.name.toLowerCase().includes(lowerSearchTerm)) ||
          (branch?.name && branch.name.toLowerCase().includes(lowerSearchTerm)) ||
          (bhr?.e_code && bhr.e_code.toLowerCase().includes(lowerSearchTerm)) ||
          (branch?.location && branch.location.toLowerCase().includes(lowerSearchTerm))
        );
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
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
      <PageTitle 
        title="Submitted Visits in Zone" 
        description="View and filter visits by BHRs in your zone"
        className="mb-0 sm:mb-0" // Removed default bottom margin to match previous custom block
      />

      <Card className="border-0 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="px-4 sm:px-6 pb-6 pt-6 space-y-5 sm:space-y-6">
          {/* Filter Layout Container - Responsive */}
          <div className="space-y-4 md:space-y-6">
            {/* Row 1: Search + Clear (Mobile & Desktop) */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#004C8F]" />
                </div>
                <Input
                  placeholder="Search BHR, Branch, E-Code, Location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 sm:h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200 w-full"
                />
              </div>
              <Button
                onClick={handleClearFilters}
                className="h-9 sm:h-10 bg-white border border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600 focus:ring-1 focus:ring-offset-1 focus:ring-red-500 text-sm shadow-sm rounded-lg transition-all duration-200 flex items-center justify-center p-2 sm:px-4 shrink-0"
              >
                <XCircle className="h-4 w-4 text-red-600 sm:mr-2" /> <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>

            {/* Row 2: Other Filters (Responsive) */}
            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
              {/* BHR Filter */}
              <div className="w-full md:w-auto">
                <Select value={bhrFilter} onValueChange={setBhrFilter} disabled={bhrOptions.length === 0}>
                  <SelectTrigger className="w-full h-9 sm:h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200">
                    <Users className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#004C8F]" />
                    <SelectValue placeholder="Filter by BHR" />
                  </SelectTrigger>
                  <SelectContent className="border-0 shadow-md">
                    <SelectItem value="all">All BHRs</SelectItem>
                    {bhrOptions.map(bhr => <SelectItem key={bhr.id} value={bhr.id}>{bhr.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Branches Filter */}
              <div className="w-full md:w-auto">
                <Select value={branchFilter} onValueChange={setBranchFilter} disabled={branchOptions.length === 0}>
                  <SelectTrigger className="w-full h-9 sm:h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200">
                      <Building2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#004C8F]" />
                    <SelectValue placeholder="Filter by Branch" />
                  </SelectTrigger>
                  <SelectContent className="border-0 shadow-md">
                    <SelectItem value="all">All Branches</SelectItem>
                    {branchOptions.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Picker */}
              <div className="w-full md:w-auto">
                <DatePickerWithRange
                  date={dateRange}
                  onDateChange={setDateRange}
                  className="h-9 sm:h-10 [&>button]:bg-white/80 [&>button]:backdrop-blur-sm [&>button]:border-slate-200/70 [&>button]:hover:bg-slate-50/50 [&>button]:text-sm [&>button]:shadow-sm [&>button]:focus:ring-1 [&>button]:focus:ring-[#004C8F]/20 [&>button]:focus:ring-offset-1 [&>button]:rounded-lg [&>button]:transition-all [&>button]:duration-200"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#004C8F]/60" />
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/80 rounded-full p-4 sm:p-5 mb-4 sm:mb-5 shadow-sm ring-1 ring-slate-100">
                  <FileQuestion className="h-8 w-8 sm:h-9 sm:w-9 text-[#004C8F]/60" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">No visits found</h3>
                <p className="text-sm sm:text-base text-slate-600 max-w-sm">
                  {allVisits.length === 0 ? "No submitted visits by BHRs in your zone yet." : "Try adjusting your filters."}
                </p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={filteredVisits}
                tableClassName="[&_thead_th]:bg-slate-50/80 [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:text-slate-600 [&_thead_th]:h-14 [&_thead_th]:px-6 [&_thead]:border-b [&_thead]:border-slate-200/60 [&_tbody_td]:px-6 [&_tbody_td]:py-4 [&_tbody_td]:text-sm [&_tbody_tr:hover]:bg-blue-50/30 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100/60 [&_tr]:transition-colors [&_td]:align-middle [&_tbody_tr:last-child]:border-0"
              />
            )}
          </div>
        </CardContent>
      </Card>

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
