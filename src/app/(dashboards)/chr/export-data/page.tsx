
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/lib/supabaseClient';
import type { User, Branch, Visit } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Filter as FilterIcon, ListFilter, XCircle, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from 'date-fns';

interface FilterOption { value: string; label: string; }

export default function CHRExportDataPage() {
  const { toast } = useToast();

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  
  const [vhrOptions, setVhrOptions] = useState<FilterOption[]>([]);
  const [zhrOptions, setZhrOptions] = useState<FilterOption[]>([]);
  const [bhrOptions, setBhrOptions] = useState<FilterOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<FilterOption[]>([]);

  const [selectedVhrIds, setSelectedVhrIds] = useState<string[]>([]);
  const [selectedZhrIds, setSelectedZhrIds] = useState<string[]>([]);
  const [selectedBhrIds, setSelectedBhrIds] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [fetchedDataForExport, setFetchedDataForExport] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchInitialFilterData = useCallback(async () => {
    setIsLoadingPage(true);
    setError(null);
    try {
      const [usersRes, branchesRes] = await Promise.all([
        supabase.from('users').select('id, name, role, reports_to, e_code, location'),
        supabase.from('branches').select('id, name, code, location, category')
      ]);

      if (usersRes.error) throw usersRes.error;
      setAllUsers(usersRes.data || []);
      setVhrOptions((usersRes.data || []).filter(u => u.role === 'VHR').map(u => ({ value: u.id, label: u.name })));

      if (branchesRes.error) throw branchesRes.error;
      setAllBranches(branchesRes.data || []);
      setBranchOptions((branchesRes.data || []).map(b => ({ value: b.id, label: `${b.name} (${b.code})` })));

    } catch (e: any) {
      console.error("Error fetching initial filter data:", e);
      toast({ title: "Error", description: `Failed to load filter options: ${e.message}`, variant: "destructive" });
      setError(`Failed to load filter options: ${e.message}`);
    } finally {
      setIsLoadingPage(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialFilterData();
  }, [fetchInitialFilterData]);

  // Update ZHR options based on VHR selection
  useEffect(() => {
    if (allUsers.length === 0) return;
    let zhrs = allUsers.filter(u => u.role === 'ZHR');
    if (selectedVhrIds.length > 0) {
      zhrs = zhrs.filter(zhr => zhr.reports_to && selectedVhrIds.includes(zhr.reports_to));
    }
    setZhrOptions(zhrs.map(u => ({ value: u.id, label: u.name })));
    setSelectedZhrIds([]); // Reset ZHR selection when VHR changes
  }, [selectedVhrIds, allUsers]);

  // Update BHR options based on ZHR (or VHR if no ZHR) selection
  useEffect(() => {
    if (allUsers.length === 0) return;
    let bhrs = allUsers.filter(u => u.role === 'BHR');
    if (selectedZhrIds.length > 0) {
      bhrs = bhrs.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
    } else if (selectedVhrIds.length > 0) {
      const zhrIdsUnderSelectedVhrs = allUsers
        .filter(u => u.role === 'ZHR' && u.reports_to && selectedVhrIds.includes(u.reports_to))
        .map(z => z.id);
      bhrs = bhrs.filter(bhr => bhr.reports_to && zhrIdsUnderSelectedVhrs.includes(bhr.reports_to));
    }
    setBhrOptions(bhrs.map(u => ({ value: u.id, label: `${u.name} (${u.e_code || 'N/A'})` })));
    setSelectedBhrIds([]); // Reset BHR selection
  }, [selectedZhrIds, selectedVhrIds, allUsers]);
  

  const handleFetchDataForExport = async () => {
    setIsFetchingData(true);
    setFetchedDataForExport([]);
    setError(null);

    try {
      let query = supabase.from('visits').select(`
        *,
        bhr_user:users!visits_bhr_id_fkey (id, name, e_code, location),
        branch:branches (id, name, code, location, category)
      `).eq('status', 'submitted');

      // Determine BHR IDs to filter by based on hierarchy
      let targetBhrIds: string[] | null = null;
      if (selectedBhrIds.length > 0) {
        targetBhrIds = selectedBhrIds;
      } else if (selectedZhrIds.length > 0) {
        targetBhrIds = allUsers.filter(u => u.role === 'BHR' && u.reports_to && selectedZhrIds.includes(u.reports_to)).map(u => u.id);
      } else if (selectedVhrIds.length > 0) {
        const zhrIds = allUsers.filter(u => u.role === 'ZHR' && u.reports_to && selectedVhrIds.includes(u.reports_to)).map(u => u.id);
        if (zhrIds.length > 0) {
            targetBhrIds = allUsers.filter(u => u.role === 'BHR' && u.reports_to && zhrIds.includes(u.reports_to)).map(u => u.id);
        } else { // Selected VHRs have no ZHRs under them
             targetBhrIds = [];
        }
      }
      // If targetBhrIds is still null, it means no hierarchy filter, fetch for all BHRs (if needed, or could be restricted)
      // If targetBhrIds is an empty array, it means a filter was applied but resulted in no BHRs.
      if (targetBhrIds !== null && targetBhrIds.length === 0) {
        setFetchedDataForExport([]);
        toast({ title: "Info", description: "No BHRs match the selected hierarchy filters.", variant: "default" });
        setIsFetchingData(false);
        return;
      } else if (targetBhrIds !== null) {
        query = query.in('bhr_id', targetBhrIds);
      }


      if (selectedBranchIds.length > 0) {
        query = query.in('branch_id', selectedBranchIds);
      }
      if (dateRange?.from) {
        query = query.gte('visit_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte('visit_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data, error: queryError } = await query.order('visit_date', { ascending: false });

      if (queryError) throw queryError;
      
      setFetchedDataForExport(data || []);
      if ((data || []).length === 0) {
        toast({ title: "No Data", description: "No visit records found matching your filter criteria.", variant: "default" });
      } else {
        toast({ title: "Data Fetched", description: `${data.length} records ready for export.` });
      }

    } catch (e: any) {
      console.error("Error fetching data for export:", e);
      toast({ title: "Error", description: `Failed to fetch data: ${e.message}`, variant: "destructive" });
      setError(`Failed to fetch data: ${e.message}`);
    } finally {
      setIsFetchingData(false);
    }
  };
  
  const handleExportToCSV = () => {
    if (fetchedDataForExport.length === 0) {
      toast({ title: "No Data", description: "No data to export. Please fetch data first.", variant: "default" });
      return;
    }
    setIsExporting(true);
    try {
      const headers = [
        "Visit ID", "BHR Name", "BHR E-Code", "BHR Location",
        "Branch Name", "Branch Code", "Branch Location", "Branch Category",
        "Visit Date", "Status", "HR Connect Conducted", "HR Connect Invited", "HR Connect Participants",
        "Manning %", "Attrition %", "Non-Vendor %", "ER %", "CWT Cases", "Performance Level",
        "New Employees Total", "New Employees Covered", "STAR Employees Total", "STAR Employees Covered",
        "Qual: Aligned Conduct", "Qual: Safe & Secure", "Qual: Motivated",
        "Qual: Abusive Language", "Qual: Comfortable Escalation", "Qual: Inclusive Culture",
        "Additional Remarks"
      ];
      
      const csvRows = [headers.join(',')];

      fetchedDataForExport.forEach(visit => {
        const bhrUser = visit.bhr_user as User | null;
        const branchData = visit.branch as Branch | null;

        const row = [
          visit.id,
          bhrUser?.name || 'N/A', bhrUser?.e_code || 'N/A', bhrUser?.location || 'N/A',
          branchData?.name || 'N/A', branchData?.code || 'N/A', branchData?.location || 'N/A', branchData?.category || 'N/A',
          visit.visit_date ? format(parseISO(visit.visit_date), 'yyyy-MM-dd') : 'N/A',
          visit.status || 'N/A',
          visit.hr_connect_conducted ? 'Yes' : 'No',
          visit.hr_connect_employees_invited ?? 'N/A',
          visit.hr_connect_participants ?? 'N/A',
          visit.manning_percentage ?? 'N/A',
          visit.attrition_percentage ?? 'N/A',
          visit.non_vendor_percentage ?? 'N/A',
          visit.er_percentage ?? 'N/A',
          visit.cwt_cases ?? 'N/A',
          visit.performance_level || 'N/A',
          visit.new_employees_total ?? 'N/A',
          visit.new_employees_covered ?? 'N/A',
          visit.star_employees_total ?? 'N/A',
          visit.star_employees_covered ?? 'N/A',
          visit.qual_aligned_conduct || 'N/A',
          visit.qual_safe_secure || 'N/A',
          visit.qual_motivated || 'N/A',
          visit.qual_abusive_language || 'N/A',
          visit.qual_comfortable_escalate || 'N/A',
          visit.qual_inclusive_culture || 'N/A',
          `"${(visit.additional_remarks || '').replace(/"/g, '""')}"` // Escape double quotes
        ];
        csvRows.push(row.join(','));
      });

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `hr_view_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Export Successful", description: "Data exported to CSV." });
      }
    } catch (e: any) {
        console.error("Error exporting CSV:", e);
        toast({ title: "Export Error", description: `Failed to export data: ${e.message}`, variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
  };

  const getMultiSelectButtonText = (
    options: FilterOption[], 
    selectedIds: string[], 
    defaultText: string, 
    pluralName: string
  ) => {
    if (isLoadingPage && options.length === 0) return `Loading ${pluralName}...`;
    if (selectedIds.length === 0) return defaultText;
    if (selectedIds.length === 1) {
      const selectedOption = options.find(opt => opt.value === selectedIds[0]);
      return selectedOption ? selectedOption.label : `1 ${pluralName.slice(0,-1)} Selected`;
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

  const handleClearAllFilters = () => {
    setSelectedVhrIds([]);
    setSelectedZhrIds([]);
    setSelectedBhrIds([]);
    setSelectedBranchIds([]);
    setDateRange(undefined);
    setFetchedDataForExport([]);
  };


  if (isLoadingPage && allUsers.length === 0 && allBranches.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading filter options...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Export Visit Data (CHR)" description="Filter and export submitted visit data across the organization." />

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListFilter className="h-5 w-5 text-primary"/>Filter Data for Export</CardTitle>
          <CardDescription>Select criteria to refine the data before exporting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {/* Hierarchy Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by VHR</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between pr-8">
                        {getMultiSelectButtonText(vhrOptions, selectedVhrIds, "All VHRs", "VHRs")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {vhrOptions.map(option => (
                        <DropdownMenuCheckboxItem key={option.value} checked={selectedVhrIds.includes(option.value)} onCheckedChange={() => handleMultiSelectChange(option.value, selectedVhrIds, setSelectedVhrIds)} onSelect={e => e.preventDefault()}>{option.label}</DropdownMenuCheckboxItem>
                    ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                 {selectedVhrIds.length > 0 && <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setSelectedVhrIds([])}>Clear VHRs</Button>}
            </div>
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by ZHR</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between pr-8" disabled={zhrOptions.length === 0 && selectedVhrIds.length > 0 && !isLoadingPage}>
                        {getMultiSelectButtonText(zhrOptions, selectedZhrIds, "All ZHRs", "ZHRs")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {zhrOptions.map(option => (
                        <DropdownMenuCheckboxItem key={option.value} checked={selectedZhrIds.includes(option.value)} onCheckedChange={() => handleMultiSelectChange(option.value, selectedZhrIds, setSelectedZhrIds)} onSelect={e => e.preventDefault()}>{option.label}</DropdownMenuCheckboxItem>
                    ))}
                    {zhrOptions.length === 0 && <DropdownMenuLabel className="text-muted-foreground text-xs px-2">No ZHRs match VHR filter.</DropdownMenuLabel>}
                    </DropdownMenuContent>
                </DropdownMenu>
                {selectedZhrIds.length > 0 && <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setSelectedZhrIds([])}>Clear ZHRs</Button>}
            </div>
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by BHR</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between pr-8" disabled={bhrOptions.length === 0 && (selectedZhrIds.length > 0 || selectedVhrIds.length > 0) && !isLoadingPage}>
                        {getMultiSelectButtonText(bhrOptions, selectedBhrIds, "All BHRs", "BHRs")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {bhrOptions.map(option => (
                        <DropdownMenuCheckboxItem key={option.value} checked={selectedBhrIds.includes(option.value)} onCheckedChange={() => handleMultiSelectChange(option.value, selectedBhrIds, setSelectedBhrIds)} onSelect={e => e.preventDefault()}>{option.label}</DropdownMenuCheckboxItem>
                    ))}
                    {bhrOptions.length === 0 && <DropdownMenuLabel className="text-muted-foreground text-xs px-2">No BHRs match hierarchy filter.</DropdownMenuLabel>}
                    </DropdownMenuContent>
                </DropdownMenu>
                {selectedBhrIds.length > 0 && <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setSelectedBhrIds([])}>Clear BHRs</Button>}
            </div>
          </div>

          {/* Branch & Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by Branch</Label>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between pr-8">
                        {getMultiSelectButtonText(branchOptions, selectedBranchIds, "All Branches", "Branches")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {branchOptions.map(option => (
                        <DropdownMenuCheckboxItem key={option.value} checked={selectedBranchIds.includes(option.value)} onCheckedChange={() => handleMultiSelectChange(option.value, selectedBranchIds, setSelectedBranchIds)} onSelect={e => e.preventDefault()}>{option.label}</DropdownMenuCheckboxItem>
                    ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                {selectedBranchIds.length > 0 && <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setSelectedBranchIds([])}>Clear Branches</Button>}
            </div>
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by Visit Date</Label>
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full" />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleClearAllFilters} variant="outline" className="w-full sm:w-auto">
                <XCircle className="mr-2 h-4 w-4" /> Clear All Filters
            </Button>
            <Button onClick={handleFetchDataForExport} disabled={isFetchingData || isLoadingPage} className="w-full sm:w-auto">
              {isFetchingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilterIcon className="mr-2 h-4 w-4" />}
              Fetch Data for Export
            </Button>
          </div>
          
          {error && <p className="text-sm text-destructive">{error}</p>}
          
          {fetchedDataForExport.length > 0 && !isFetchingData && (
            <div className="mt-4 p-4 bg-muted/50 rounded-md text-sm">
              <p className="font-medium">{fetchedDataForExport.length} record(s) fetched and ready for export.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Export Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportToCSV}
            disabled={isExporting || fetchedDataForExport.length === 0 || isFetchingData}
            className="w-full sm:w-auto"
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export to CSV
          </Button>
          {fetchedDataForExport.length === 0 && !isFetchingData && (
            <p className="text-sm text-muted-foreground mt-2">Please fetch data before exporting.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
