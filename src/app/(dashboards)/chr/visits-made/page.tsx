
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { format, parseISO, isWithinInterval, isValid, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, Search, XCircle, Filter as FilterIcon, ChevronsUpDown } from 'lucide-react';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useChrFilter } from '@/contexts/chr-filter-context';

interface FilterOption { value: string; label: string; }

export default function CHRVisitsMadePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedVhrIds: globalSelectedVhrIds, vhrOptions: globalVhrOptions } = useChrFilter();

  const [isLoading, setIsLoading] = useState(true);
  const [allSubmittedVisitsGlobal, setAllSubmittedVisitsGlobal] = useState<Visit[]>([]);
  const [allUsersGlobal, setAllUsersGlobal] = useState<User[]>([]);
  const [allBranchesGlobal, setAllBranchesGlobal] = useState<Branch[]>([]);

  const [selectedZhrIds, setSelectedZhrIds] = useState<string[]>([]);
  const [zhrOptions, setZhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingZhrOptions, setIsLoadingZhrOptions] = useState(false);

  const [selectedBhrIds, setSelectedBhrIds] = useState<string[]>([]);
  const [bhrOptions, setBhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingBhrOptions, setIsLoadingBhrOptions] = useState(false);

  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<FilterOption[]>([]);
  const [isLoadingBranchOptions, setIsLoadingBranchOptions] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  // Fetch global data
  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchGlobalData = async () => {
        setIsLoading(true);
        try {
          const [usersRes, branchesRes, visitsRes] = await Promise.all([
            supabase.from('users').select('id, name, role, reports_to, e_code'),
            supabase.from('branches').select('id, name, category, code, location'),
            supabase.from('visits').select('*').eq('status', 'submitted').order('visit_date', { ascending: false })
          ]);

          if (usersRes.error) throw usersRes.error;
          setAllUsersGlobal(usersRes.data || []);

          if (branchesRes.error) throw branchesRes.error;
          setAllBranchesGlobal(branchesRes.data || []);
          setBranchOptions((branchesRes.data || []).map(b => ({ value: b.id, label: `${b.name} (${b.code})` })));
          setIsLoadingBranchOptions(false);

          if (visitsRes.error) throw visitsRes.error;
          setAllSubmittedVisitsGlobal(visitsRes.data as Visit[] || []);

        } catch (error: any) {
          console.error("CHR Visits Made: Error fetching global data:", error);
          toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchGlobalData();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  // Populate ZHR options based on global VHR selection
  useEffect(() => {
    setIsLoadingZhrOptions(true);
    if (allUsersGlobal.length > 0) {
      let potentialZhrs = allUsersGlobal.filter(u => u.role === 'ZHR');
      if (globalSelectedVhrIds.length > 0) {
        potentialZhrs = potentialZhrs.filter(zhr => zhr.reports_to && globalSelectedVhrIds.includes(zhr.reports_to));
      }
      setZhrOptions(potentialZhrs.map(z => ({ value: z.id, label: z.name })));
    } else {
      setZhrOptions([]);
    }
    setSelectedZhrIds([]);
    setIsLoadingZhrOptions(false);
  }, [globalSelectedVhrIds, allUsersGlobal]);

  // Populate BHR options based on local ZHR selection (and global VHR if ZHRs empty)
  useEffect(() => {
    setIsLoadingBhrOptions(true);
    if (allUsersGlobal.length > 0) {
      let potentialBhrs = allUsersGlobal.filter(u => u.role === 'BHR');
      if (selectedZhrIds.length > 0) {
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
      } else if (globalSelectedVhrIds.length > 0) {
        const zhrsUnderSelectedVhrs = allUsersGlobal
          .filter(u => u.role === 'ZHR' && u.reports_to && globalSelectedVhrIds.includes(u.reports_to))
          .map(z => z.id);
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && zhrsUnderSelectedVhrs.includes(bhr.reports_to));
      }
      setBhrOptions(potentialBhrs.map(b => ({ value: b.id, label: b.name })));
    } else {
      setBhrOptions([]);
    }
    setSelectedBhrIds([]);
    setIsLoadingBhrOptions(false);
  }, [selectedZhrIds, globalSelectedVhrIds, allUsersGlobal]);

  // Reset branch selection if higher filters change
  useEffect(() => {
    setSelectedBranchIds([]);
  }, [selectedBhrIds, selectedZhrIds, globalSelectedVhrIds]);


  const filteredVisits = useMemo(() => {
    let visits = allSubmittedVisitsGlobal;

    // Hierarchical BHR ID determination
    let relevantBhrIds = new Set<string>();
    if (selectedBhrIds.length > 0) {
        selectedBhrIds.forEach(id => relevantBhrIds.add(id));
    } else if (selectedZhrIds.length > 0) {
        allUsersGlobal
            .filter(u => u.role === 'BHR' && u.reports_to && selectedZhrIds.includes(u.reports_to))
            .forEach(b => relevantBhrIds.add(b.id));
    } else if (globalSelectedVhrIds.length > 0) {
        const zhrsInSelectedVhrs = allUsersGlobal
            .filter(u => u.role === 'ZHR' && u.reports_to && globalSelectedVhrIds.includes(u.reports_to))
            .map(z => z.id);
        allUsersGlobal
            .filter(u => u.role === 'BHR' && u.reports_to && zhrsInSelectedVhrs.includes(u.reports_to))
            .forEach(b => relevantBhrIds.add(b.id));
    } else { // No VHR, ZHR, BHR selected - consider all BHRs
        allUsersGlobal.filter(u => u.role === 'BHR').forEach(b => relevantBhrIds.add(b.id));
    }

    // Filter by relevant BHRs (if any specific hierarchy selected, otherwise all BHRs)
    if (relevantBhrIds.size > 0 || selectedBhrIds.length > 0 || selectedZhrIds.length > 0 || globalSelectedVhrIds.length > 0) {
      if (relevantBhrIds.size === 0 && (selectedBhrIds.length > 0 || selectedZhrIds.length > 0 || globalSelectedVhrIds.length > 0)) {
         // A filter is active but no BHRs match it (e.g., selected ZHR has no BHRs)
        visits = [];
      } else if (relevantBhrIds.size > 0) {
        visits = visits.filter(visit => relevantBhrIds.has(visit.bhr_id));
      }
    }
    
    // Filter by selected branches
    if (selectedBranchIds.length > 0) {
      visits = visits.filter(visit => selectedBranchIds.includes(visit.branch_id));
    }

    // Filter by date range
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
    
    // Filter by search term (BHR name, Branch name, BHR e-code, Branch location/code)
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (lowerSearchTerm) {
      visits = visits.filter(visit => {
        const bhr = allUsersGlobal.find(u => u.id === visit.bhr_id);
        const branch = allBranchesGlobal.find(b => b.id === visit.branch_id);
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
  }, [
    allSubmittedVisitsGlobal, 
    allUsersGlobal, 
    allBranchesGlobal, 
    globalSelectedVhrIds, 
    selectedZhrIds, 
    selectedBhrIds, 
    selectedBranchIds, 
    dateRange,
    searchTerm
  ]);
  
  const columns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id',
      header: 'BHR Name',
      cell: (visit) => allUsersGlobal.find(u => u.id === visit.bhr_id)?.name || 'N/A'
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch Name',
      cell: (visit) => allBranchesGlobal.find(b => b.id === visit.branch_id)?.name || 'N/A'
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
          const branch = allBranchesGlobal.find(b => b.id === visit.branch_id);
          const bhr = allUsersGlobal.find(u => u.id === visit.bhr_id);
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
        return <Button variant="outline" size="sm" onClick={handleViewClick}><Eye className="mr-2 h-4 w-4" /> View</Button>;
      }
    }
  ], [allUsersGlobal, allBranchesGlobal]);

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
  
  const handleClearAllLocalFilters = () => {
    setSelectedZhrIds([]);
    setSelectedBhrIds([]);
    setSelectedBranchIds([]);
    setDateRange(undefined);
    setSearchTerm('');
  };

  if (isLoading && !user) { // Initial load before user is confirmed
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!user || user.role !== 'CHR') {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }
  
  const pageTitleText = useMemo(() => {
    let title = "Submitted Visits";
    if (globalSelectedVhrIds.length > 0) {
      if (globalSelectedVhrIds.length === 1) {
        const vhrName = globalVhrOptions.find(v => v.value === globalSelectedVhrIds[0])?.label || "Selected VHR";
        title += ` (${vhrName})`;
      } else {
        title += ` (${globalSelectedVhrIds.length} VHRs)`;
      }
    } else {
      title += " (Global)";
    }
    return title;
  }, [globalSelectedVhrIds, globalVhrOptions]);

  return (
    <div className="space-y-8">
      <PageTitle title={pageTitleText} description="View and filter all submitted branch visits across the organization." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FilterIcon className="h-5 w-5 text-primary"/>Filters</CardTitle>
          <CardDescription>Refine visits by ZHR, BHR, Branch, Date Range, and Search Term. Applied with global VHR filter.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ZHR Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(zhrOptions, selectedZhrIds, "All ZHRs", "ZHR", "ZHRs", isLoadingZhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by ZHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingZhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                  zhrOptions.length > 0 ? zhrOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedZhrIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedZhrIds, setSelectedZhrIds)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No ZHRs match current VHR filter.</DropdownMenuLabel>}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedZhrIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedZhrIds([]); }} aria-label="Clear ZHR filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
            {/* BHR Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(bhrOptions, selectedBhrIds, "All BHRs", "BHR", "BHRs", isLoadingBhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by BHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                  bhrOptions.length > 0 ? bhrOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBhrIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedBhrIds, setSelectedBhrIds)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No BHRs match current ZHR/VHR filter.</DropdownMenuLabel>}
                </DropdownMenuContent>
              </DropdownMenu>
               {selectedBhrIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBhrIds([]); }} aria-label="Clear BHR filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
            {/* Branch Filter */}
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(branchOptions, selectedBranchIds, "All Branches", "Branch", "Branches", isLoadingBranchOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by Branch</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBranchOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> : 
                  branchOptions.length > 0 ? branchOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBranchIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedBranchIds, setSelectedBranchIds)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No branches available.</DropdownMenuLabel>}
                </DropdownMenuContent>
              </DropdownMenu>
               {selectedBranchIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBranchIds([]); }} aria-label="Clear Branch filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
                <Label htmlFor="search-visits-made" className="sr-only">Search</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-visits-made"
                  placeholder="Search by BHR, Branch, E-Code, Location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
            </div>
            <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full"/>
          </div>
          <Button variant="outline" onClick={handleClearAllLocalFilters} className="w-full md:w-auto mt-4">
            <XCircle className="mr-2 h-4 w-4" /> Clear All Local Filters & Dates
          </Button>
        </CardContent>
      </Card>
      
      {isLoading && allSubmittedVisitsGlobal.length === 0 ? (
         <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading visits...</p>
        </div>
      ) : (
        <DataTable
            columns={columns}
            data={filteredVisits}
            emptyStateMessage={
                allSubmittedVisitsGlobal.length === 0 && !isLoading
                ? "No submitted visits found in the system." 
                : (isLoading ? "Loading visits..." : "No submitted visits match your current filter combination.")
            }
        />
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

