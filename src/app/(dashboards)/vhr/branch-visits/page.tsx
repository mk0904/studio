
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { format, parseISO, isWithinInterval, isValid, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, Search, XCircle, Filter as FilterIcon, ChevronsUpDown } from 'lucide-react';
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

interface FilterOption { value: string; label: string; }

export default function VHRBranchVisitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    selectedZhrIds: globalSelectedZhrIds, // ZHRs selected in header
    zhrOptions: globalZhrOptions,         // All ZHRs available to VHR
    allBhrsInVhrVertical, 
    isLoadingBhrsInVhrVertical 
  } = useVhrFilter();

  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [allVisitsForVhr, setAllVisitsForVhr] = useState<Visit[]>([]);
  const [allBranchesForLookup, setAllBranchesForLookup] = useState<Branch[]>([]);

  // Local filters state
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

  // Populate local BHR options based on global ZHR selection
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
    setLocalSelectedBhrIds([]); // Reset local BHR selection when global ZHR changes
    setIsLoadingLocalBhrOptions(false);
  }, [globalSelectedZhrIds, allBhrsInVhrVertical]);
  
  useEffect(() => { // Reset local branch selection if BHR or global ZHR changes
    setLocalSelectedBranchIds([]);
  },[localSelectedBhrIds, globalSelectedZhrIds])


  const filteredVisits = useMemo(() => {
    let visits = allVisitsForVhr;

    // Apply global ZHR filter (implicitly done by how allVisitsForVhr is constructed if selectedZhrIds is used in its fetch,
    // or filter here if allVisitsForVhr contains all vertical visits)
    if (globalSelectedZhrIds.length > 0) {
      const bhrIdsUnderSelectedGlobalZhrs = allBhrsInVhrVertical
        .filter(bhr => bhr.reports_to && globalSelectedZhrIds.includes(bhr.reports_to))
        .map(bhr => bhr.id);
      visits = visits.filter(visit => bhrIdsUnderSelectedGlobalZhrs.includes(visit.bhr_id));
    }
    
    // Apply local BHR filter
    if (localSelectedBhrIds.length > 0) {
      visits = visits.filter(visit => localSelectedBhrIds.includes(visit.bhr_id));
    }
    
    // Apply local Branch filter
    if (localSelectedBranchIds.length > 0) {
      visits = visits.filter(visit => localSelectedBranchIds.includes(visit.branch_id));
    }

    // Apply date range filter
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
    
    // Apply search term filter
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
          <Button variant="outline" size="sm" onClick={handleViewClick} >
            <Eye className="mr-2 h-4 w-4" /> View
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

  const isLoading = isLoadingBhrsInVhrVertical || isLoadingPageData || isLoadingLocalBhrOptions || isLoadingLocalBranchOptions;
  
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

  if (isLoading && user.role === 'VHR' && allVisitsForVhr.length === 0) {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* BHR Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(localBhrOptions, localSelectedBhrIds, "All BHRs", "BHR", "BHRs", isLoadingLocalBhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
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
                  )) : <DropdownMenuLabel>No BHRs match current ZHR filter.</DropdownMenuLabel>}
                </DropdownMenuContent>
              </DropdownMenu>
               {localSelectedBhrIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setLocalSelectedBhrIds([]); }} aria-label="Clear BHR filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
            {/* Branch Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(localBranchOptions, localSelectedBranchIds, "All Branches", "Branch", "Branches", isLoadingLocalBranchOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
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
               {localSelectedBranchIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setLocalSelectedBranchIds([]); }} aria-label="Clear Branch filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
                <Label htmlFor="search-vhr-visits" className="sr-only">Search</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-vhr-visits"
                  placeholder="Search by BHR, Branch, E-Code, Location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
            </div>
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full"/>
          </div>
          <Button variant="outline" onClick={handleClearLocalFilters} className="w-full md:w-auto mt-4">
            <XCircle className="mr-2 h-4 w-4" /> Clear All Local Filters & Dates
          </Button>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredVisits}
        emptyStateMessage={isLoading ? "Loading visits..." : (allVisitsForVhr.length === 0 && !isLoading ? "No submitted visits found in your vertical." : "No submitted visits match your current filter combination.")}
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

