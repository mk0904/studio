
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO, isWithinInterval, isValid, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, Search, XCircle, Filter as FilterIcon, ChevronsUpDown, Users, Building2, Calendar, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import { useVhrFilter } from '@/contexts/vhr-filter-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface FilterOption { value: string; label: string; }

export default function VHRBranchVisitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    selectedZhrIds: globalSelectedZhrIds,
    zhrOptions: globalZhrOptions,
    allBhrsInVhrVertical,
    isLoadingBhrsInVhrVertical
  } = useVhrFilter();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [allVisitsForVhr, setAllVisitsForVhr] = useState<Visit[]>([]);
  const [allBranchesForLookup, setAllBranchesForLookup] = useState<Branch[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [localSelectedBhrIds, setLocalSelectedBhrIds] = useState<string[]>([]);
  const [localBhrOptions, setLocalBhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingLocalBhrOptions, setIsLoadingLocalBhrOptions] = useState(false);

  const [localSelectedBranchIds, setLocalSelectedBranchIds] = useState<string[]>([]);
  const [localBranchOptions, setLocalBranchOptions] = useState<FilterOption[]>([]);
  const [isLoadingLocalBranchOptions, setIsLoadingLocalBranchOptions] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'VHR' || isLoadingBhrsInVhrVertical) {
      setIsLoadingPageData(false);
      return;
    }
    setIsLoadingPageData(true);
    try {
      const bhrIdsInEntireVertical = allBhrsInVhrVertical.map(b => b.id);

      if (bhrIdsInEntireVertical.length === 0) {
        setAllVisitsForVhr([]);
        setAllBranchesForLookup([]);
        setLocalBranchOptions([]);
        setIsLoadingPageData(false);
        return;
      }

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, category, code, location');
      if (branchesError) throw branchesError;
      setAllBranchesForLookup(branchesData || []);
      setLocalBranchOptions((branchesData || []).map(b => ({ value: b.id, label: `${b.name} (${b.code})` })));
      setIsLoadingLocalBranchOptions(false);

      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .in('bhr_id', bhrIdsInEntireVertical)
        .eq('status', 'submitted')
        .order('visit_date', { ascending: false });
      if (visitsError) throw visitsError;
      setAllVisitsForVhr((visitsData as Visit[]) || []);

    } catch (error: any) {
      console.error("VHRBranchVisitsPage: Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load branch visits: ${error.message}`, variant: "destructive" });
      setAllVisitsForVhr([]);
      setAllBranchesForLookup([]);
      setLocalBranchOptions([]);
    } finally {
      setIsLoadingPageData(false);
    }
  }, [user, toast, allBhrsInVhrVertical, isLoadingBhrsInVhrVertical]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setIsLoadingLocalBhrOptions(true);
    if (allBhrsInVhrVertical.length > 0) {
      let potentialBhrs = allBhrsInVhrVertical;
      if (globalSelectedZhrIds.length > 0) {
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && globalSelectedZhrIds.includes(bhr.reports_to));
      }
      setLocalBhrOptions(potentialBhrs.map(b => ({ value: b.id, label: `${b.name} (${b.e_code || 'N/A'})` })));
    } else {
      setLocalBhrOptions([]);
    }
    setLocalSelectedBhrIds([]);
    setIsLoadingLocalBhrOptions(false);
  }, [globalSelectedZhrIds, allBhrsInVhrVertical]);

  useEffect(() => {
    setLocalSelectedBranchIds([]);
  },[localSelectedBhrIds, globalSelectedZhrIds])


  const filteredVisits = useMemo(() => {
    let visits = allVisitsForVhr;

    if (globalSelectedZhrIds.length > 0) {
      const bhrIdsUnderSelectedGlobalZhrs = allBhrsInVhrVertical
        .filter(bhr => bhr.reports_to && globalSelectedZhrIds.includes(bhr.reports_to))
        .map(bhr => bhr.id);
      visits = visits.filter(visit => bhrIdsUnderSelectedGlobalZhrs.includes(visit.bhr_id));
    }

    if (localSelectedBhrIds.length > 0) {
      visits = visits.filter(visit => localSelectedBhrIds.includes(visit.bhr_id));
    }

    if (localSelectedBranchIds.length > 0) {
      visits = visits.filter(visit => localSelectedBranchIds.includes(visit.branch_id));
    }

    if (dateRange?.from || dateRange?.to) {
      visits = visits.filter(visit => {
        const visitDate = parseISO(visit.visit_date);
        if (!isValid(visitDate)) return false;
        const from = dateRange.from ? startOfDay(dateRange.from) : null;
        const to = dateRange.to ? endOfDay(dateRange.to) : null;
        if (from && to) return isWithinInterval(visitDate, { start: from, end: to });
        if (from) return visitDate >= from;
        if (to) return visitDate <= to;
        return true;
      });
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    if (lowerSearchTerm) {
      visits = visits.filter(visit => {
        const bhr = allBhrsInVhrVertical.find(u => u.id === visit.bhr_id);
        const branch = allBranchesForLookup.find(b => b.id === visit.branch_id);
        return (
          bhr?.name?.toLowerCase().includes(lowerSearchTerm) ||
          branch?.name?.toLowerCase().includes(lowerSearchTerm) ||
          bhr?.e_code?.toLowerCase().includes(lowerSearchTerm) ||
          branch?.location?.toLowerCase().includes(lowerSearchTerm) ||
          branch?.code?.toLowerCase().includes(lowerSearchTerm)
        );
      });
    }
    return visits;
  }, [allVisitsForVhr, globalSelectedZhrIds, localSelectedBhrIds, localSelectedBranchIds, dateRange, searchTerm, allBhrsInVhrVertical, allBranchesForLookup]);

  const columns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id',
      header: 'BHR Name (E-Code)',
      cell: (visit) => {
          const bhr = allBhrsInVhrVertical.find(u => u.id === visit.bhr_id);
          return bhr ? `${bhr.name} (${bhr.e_code || 'N/A'})` : 'N/A';
      }
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch Name (Code)',
      cell: (visit) => {
          const branch = allBranchesForLookup.find(b => b.id === visit.branch_id);
          return branch ? `${branch.name} (${branch.code || 'N/A'})` : 'N/A';
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
          const branch = allBranchesForLookup.find(b => b.id === visit.branch_id);
          const bhr = allBhrsInVhrVertical.find(u => u.id === visit.bhr_id);
          const enrichedVisit: EnrichedVisitForModal = {
            ...(visit as Visit),
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
  ], [allBhrsInVhrVertical, allBranchesForLookup]);

  const getMultiSelectButtonText = (
    options: FilterOption[],
    selectedIds: string[],
    defaultText: string,
    singularName: string,
    pluralName: string,
    isLoadingOptions: boolean
  ) => {
    if (isLoadingOptions) return `Loading ${pluralName}...`;
    if (selectedIds.length === 0) return defaultText;
    if (selectedIds.length === 1) {
      const selectedOption = options.find(opt => opt.value === selectedIds[0]);
      return selectedOption ? selectedOption.label : `1 ${singularName} Selected`;
    }
    return `${selectedIds.length} ${pluralName} Selected`;
  };

  const handleMultiSelectChange = (
    id: string,
    currentSelectedIds: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const newSelectedIds = currentSelectedIds.includes(id)
      ? currentSelectedIds.filter(selectedId => selectedId !== id)
      : [...currentSelectedIds, id];
    setter(newSelectedIds);
  };

  const handleClearLocalFilters = () => {
    setSearchTerm('');
    setLocalSelectedBhrIds([]);
    setLocalSelectedBranchIds([]);
    setDateRange(undefined);
  };

  const isLoadingCombined = isLoadingBhrsInVhrVertical || isLoadingPageData || isLoadingLocalBhrOptions || isLoadingLocalBranchOptions;

  const pageTitleText = useMemo(() => {
    let title = "Submitted Visits";
    let subtitle = "Visits across your vertical";

    if (globalSelectedZhrIds.length > 0) {
      if (globalSelectedZhrIds.length === 1) {
        const zhrName = globalZhrOptions.find(z => z.value === globalSelectedZhrIds[0])?.label || "Selected ZHR";
        subtitle = `for ${zhrName}`;
      } else {
        subtitle = `for ${globalSelectedZhrIds.length} ZHRs`;
      }
    }
    if (localSelectedBhrIds.length > 0 || localSelectedBranchIds.length > 0 || searchTerm || dateRange?.from) {
      subtitle += " (locally filtered)";
    }
    return { title, subtitle };
  }, [globalSelectedZhrIds, globalZhrOptions, localSelectedBhrIds, localSelectedBranchIds, searchTerm, dateRange]);


  if (!user) return null;

  if (isLoadingCombined && user.role === 'VHR' && allVisitsForVhr.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading submitted branch visits...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title={pageTitleText.title} description={pageTitleText.subtitle} />

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FilterIcon className="h-5 w-5 text-primary"/>Local Filters</CardTitle>
          <CardDescription>Refine visits by BHR, Branch, Date Range, and Search Term. Applied with global ZHR filter from header.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex gap-2 items-center w-full lg:flex-1">
                <div className="relative flex-1 w-full">
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
                  onClick={handleClearLocalFilters}
                  variant="outline"
                  className="h-9 sm:h-10 text-xs sm:text-sm font-medium border-slate-200/70 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:bg-slate-100 transition-all duration-200 whitespace-nowrap rounded-lg px-3 sm:px-4 inline-flex items-center gap-1.5 sm:gap-2 shadow-sm"
                >
                  <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Clear</span>
                  <span className="sm:hidden">×</span>
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:flex-shrink-0">
                <div className="flex-1 lg:min-w-[180px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between pr-3 h-9 sm:h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200">
                        <Users className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#004C8F]" />
                        {getMultiSelectButtonText(localBhrOptions, localSelectedBhrIds, "All BHRs", "BHR", "BHRs", isLoadingLocalBhrOptions)}
                        <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-72 overflow-y-auto">
                      <DropdownMenuLabel>Filter by BHR</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isLoadingLocalBhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                      localBhrOptions.length > 0 ? localBhrOptions.map(option => (
                        <DropdownMenuCheckboxItem
                          key={option.value}
                          checked={localSelectedBhrIds.includes(option.value)}
                          onCheckedChange={() => handleMultiSelectChange(option.value, localSelectedBhrIds, setLocalSelectedBhrIds)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      )) : <DropdownMenuLabel>No BHRs match ZHR filter.</DropdownMenuLabel>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex-1 lg:min-w-[180px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between pr-3 h-9 sm:h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200">
                        <Building2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#004C8F]" />
                        {getMultiSelectButtonText(localBranchOptions, localSelectedBranchIds, "All Branches", "Branch", "Branches", isLoadingLocalBranchOptions)}
                        <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-72 overflow-y-auto">
                      <DropdownMenuLabel>Filter by Branch</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isLoadingLocalBranchOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                      localBranchOptions.length > 0 ? localBranchOptions.map(option => (
                        <DropdownMenuCheckboxItem
                          key={option.value}
                          checked={localSelectedBranchIds.includes(option.value)}
                          onCheckedChange={() => handleMultiSelectChange(option.value, localSelectedBranchIds, setLocalSelectedBranchIds)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      )) : <DropdownMenuLabel>No branches available.</DropdownMenuLabel>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex-1 lg:min-w-[200px] lg:w-auto">
                  <DatePickerWithRange
                    date={dateRange}
                    onDateChange={setDateRange}
                    className="h-9 sm:h-10 [&>button]:bg-white/80 [&>button]:backdrop-blur-sm [&>button]:border-slate-200/70 [&>button]:hover:bg-slate-50/50 [&>button]:text-sm [&>button]:shadow-sm [&>button]:focus:ring-1 [&>button]:focus:ring-[#004C8F]/20 [&>button]:focus:ring-offset-1 [&>button]:rounded-lg [&>button]:transition-all [&>button]:duration-200"
                  />
                </div>
              </div>
            </div>
        </CardContent>
      </Card>
      
      {isLoadingCombined && allVisitsForVhr.length === 0 ? (
         <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading visits...</p>
        </div>
      ) : filteredVisits.length === 0 && !isLoadingCombined ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 mt-8">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/80 rounded-full p-4 sm:p-5 mb-4 sm:mb-5 shadow-sm ring-1 ring-slate-100">
            <FileQuestion className="h-8 w-8 sm:h-9 sm:w-9 text-[#004C8F]/60" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">No visits found</h3>
          <p className="text-sm sm:text-base text-slate-600 max-w-sm">
            {allVisitsForVhr.length === 0 ? "No submitted visits in your vertical yet." : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-sm mt-8">
          <DataTable
            columns={columns}
            data={filteredVisits}
            tableClassName="[&_thead_th]:bg-slate-50/80 [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:text-slate-600 [&_thead_th]:h-14 [&_thead_th]:px-6 [&_thead]:border-b [&_thead]:border-slate-200/60 [&_tbody_td]:px-6 [&_tbody_td]:py-4 [&_tbody_td]:text-sm [&_tbody_tr:hover]:bg-blue-50/30 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100/60 [&_tr]:transition-colors [&_td]:align-middle [&_tbody_tr:last-child]:border-0"
          />
        </div>
      )}

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

