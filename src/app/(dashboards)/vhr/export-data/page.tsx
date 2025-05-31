
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DatePickerWithRange } from '@/components/shared/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/lib/supabaseClient';
import type { User, Branch, Visit } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, ListFilter, XCircle, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';

interface FilterOption { value: string; label: string; }

export default function VHRExportDataPage() {
  const { user: vhrUser } = useAuth();
  const { toast } = useToast();

  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [allZhrsInVertical, setAllZhrsInVertical] = useState<User[]>([]);
  const [allBhrsInVertical, setAllBhrsInVertical] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  
  const [zhrOptions, setZhrOptions] = useState<FilterOption[]>([]);
  const [bhrOptions, setBhrOptions] = useState<FilterOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<FilterOption[]>([]);
  const [branchCategoryOptions, setBranchCategoryOptions] = useState<string[]>(['all']);

  const [selectedZhrIds, setSelectedZhrIds] = useState<string[]>([]);
  const [selectedBhrIds, setSelectedBhrIds] = useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedBranchCategory, setSelectedBranchCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [error, setError] = useState<string | null>(null);

  const fetchInitialFilterData = useCallback(async () => {
    if (!vhrUser || vhrUser.role !== 'VHR') {
      setIsLoadingPage(false);
      setError("Access Denied or user not VHR.");
      return;
    }
    setIsLoadingPage(true);
    setError(null);
    try {
      const { data: zhrsData, error: zhrsError } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('role', 'ZHR')
        .eq('reports_to', vhrUser.id);
      if (zhrsError) throw zhrsError;
      setAllZhrsInVertical(zhrsData || []);
      setZhrOptions((zhrsData || []).map(u => ({ value: u.id, label: u.name })));

      const zhrIds = (zhrsData || []).map(z => z.id);
      if (zhrIds.length > 0) {
        const { data: bhrsData, error: bhrsError } = await supabase
          .from('users')
          .select('id, name, role, e_code')
          .eq('role', 'BHR')
          .in('reports_to', zhrIds);
        if (bhrsError) throw bhrsError;
        setAllBhrsInVertical(bhrsData || []);
      } else {
        setAllBhrsInVertical([]);
      }

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, code, location, category');
      if (branchesError) throw branchesError;
      setAllBranches(branchesData || []);
      setBranchOptions((branchesData || []).map(b => ({ value: b.id, label: `${b.name} (${b.code})` })));
      const uniqueCategories = Array.from(new Set((branchesData || []).map(b => b.category).filter(Boolean)));
      setBranchCategoryOptions(['all', ...uniqueCategories]);

    } catch (e: any) {
      console.error("Error fetching initial filter data for VHR:", e);
      toast({ title: "Error", description: `Failed to load filter options: ${e.message}`, variant: "destructive" });
      setError(`Failed to load filter options: ${e.message}`);
    } finally {
      setIsLoadingPage(false);
    }
  }, [vhrUser, toast]);

  useEffect(() => {
    fetchInitialFilterData();
  }, [fetchInitialFilterData]);

  useEffect(() => {
    if (allBhrsInVertical.length === 0) {
        setBhrOptions([]);
        setSelectedBhrIds([]);
        return;
    }
    let bhrsToDisplay = allBhrsInVertical;
    if (selectedZhrIds.length > 0) {
      bhrsToDisplay = allBhrsInVertical.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
    }
    setBhrOptions(bhrsToDisplay.map(u => ({ value: u.id, label: `${u.name} (${u.e_code || 'N/A'})` })));
    setSelectedBhrIds([]); 
  }, [selectedZhrIds, allBhrsInVertical]);
  
  const handleExportToCSV = async () => {
    if (!vhrUser) return;
    setIsExporting(true);
    setError(null);
    
    let targetBhrIds: string[] = [];
    if (selectedBhrIds.length > 0) {
      targetBhrIds = selectedBhrIds;
    } else if (selectedZhrIds.length > 0) {
      targetBhrIds = allBhrsInVertical.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to)).map(b => b.id);
    } else {
      targetBhrIds = allBhrsInVertical.map(b => b.id); // All BHRs in VHR's vertical
    }

    if (targetBhrIds.length === 0) {
      toast({ title: "No Data", description: "No BHRs match the selected hierarchy filters. Cannot export.", variant: "default" });
      setIsExporting(false);
      return;
    }

    try {
      let query = supabase.from('visits').select(`
        *,
        bhr_user:users!visits_bhr_id_fkey (id, name, e_code, location, role),
        branch:branches!visits_branch_id_fkey (id, name, code, location, category)
      `)
      .eq('status', 'submitted')
      .in('bhr_id', targetBhrIds);

      if (selectedBranchIds.length > 0) {
        query = query.in('branch_id', selectedBranchIds);
      }
      if (selectedBranchCategory !== 'all') {
        query = query.eq('branch.category', selectedBranchCategory);
      }
      if (dateRange?.from) {
        query = query.gte('visit_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte('visit_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data, error: queryError } = await query.order('visit_date', { ascending: false });

      if (queryError) throw queryError;
      
      if (!data || data.length === 0) {
        toast({ title: "No Data", description: "No visit records found matching your filter criteria.", variant: "default" });
        setIsExporting(false);
        return;
      }
      
      const headers = [
        "Visit ID", "BHR Name", "BHR E-Code", "BHR Location", "BHR Role",
        "Branch Name", "Branch Code", "Branch Location", "Branch Category",
        "Visit Date", "Status", "HR Connect Conducted", "HR Connect Invited", "HR Connect Participants",
        "Manning %", "Attrition %", "Non-Vendor %", "ER %", "CWT Cases", "Performance Level",
        "New Employees Total", "New Employees Covered", "STAR Employees Total", "STAR Employees Covered",
        "Qual: Aligned Conduct", "Qual: Safe & Secure", "Qual: Motivated",
        "Qual: Abusive Language", "Qual: Comfortable Escalation", "Qual: Inclusive Culture",
        "Additional Remarks"
      ];
      const csvRows = [headers.join(',')];
      data.forEach(visit => {
        const bhrUser = visit.bhr_user as User | null;
        const branchData = visit.branch as Branch | null;
        const row = [
          visit.id,
          bhrUser?.name || 'N/A', bhrUser?.e_code || 'N/A', bhrUser?.location || 'N/A', bhrUser?.role || 'N/A',
          branchData?.name || 'N/A', branchData?.code || 'N/A', branchData?.location || 'N/A', branchData?.category || 'N/A',
          visit.visit_date ? format(parseISO(visit.visit_date), 'yyyy-MM-dd') : 'N/A',
          visit.status || 'N/A', visit.hr_connect_conducted ? 'Yes' : 'No',
          visit.hr_connect_employees_invited ?? 'N/A', visit.hr_connect_participants ?? 'N/A',
          visit.manning_percentage ?? 'N/A', visit.attrition_percentage ?? 'N/A',
          visit.non_vendor_percentage ?? 'N/A', visit.er_percentage ?? 'N/A',
          visit.cwt_cases ?? 'N/A', visit.performance_level || 'N/A',
          visit.new_employees_total ?? 'N/A', visit.new_employees_covered ?? 'N/A',
          visit.star_employees_total ?? 'N/A', visit.star_employees_covered ?? 'N/A',
          visit.qual_aligned_conduct || 'N/A', visit.qual_safe_secure || 'N/A', visit.qual_motivated || 'N/A',
          visit.qual_abusive_language || 'N/A', visit.qual_comfortable_escalate || 'N/A', visit.qual_inclusive_culture || 'N/A',
          `"${(visit.additional_remarks || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });
      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `vhr_hr_view_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Export Successful", description: `${data.length} records exported.` });
      }
    } catch (e: any) {
      console.error("Error during VHR export:", e);
      toast({ title: "Export Error", description: `Failed to export data: ${e.message}`, variant: "destructive" });
      setError(`Failed to export data: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  const getMultiSelectButtonText = (options: FilterOption[], selectedIds: string[], defaultText: string, pluralName: string) => {
    if (isLoadingPage && options.length === 0 && selectedIds.length === 0) return `Loading ${pluralName}...`;
    if (selectedIds.length === 0) return defaultText;
    if (selectedIds.length === 1) {
      const selectedOption = options.find(opt => opt.value === selectedIds[0]);
      return selectedOption ? selectedOption.label : `1 ${pluralName.slice(0,-1)} Selected`;
    }
    return `${selectedIds.length} ${pluralName} Selected`;
  };

  const handleMultiSelectChange = (id: string, currentSelectedIds: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const newSelectedIds = currentSelectedIds.includes(id)
      ? currentSelectedIds.filter(selectedId => selectedId !== id)
      : [...currentSelectedIds, id];
    setter(newSelectedIds);
  };

  const handleClearAllFilters = () => {
    setSelectedZhrIds([]);
    setSelectedBhrIds([]);
    setSelectedBranchIds([]);
    setSelectedBranchCategory('all');
    setDateRange(undefined);
    setError(null);
  };

  if (isLoadingPage && !vhrUser) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Loading user...</p></div>;
  }
  if (!vhrUser || vhrUser.role !== 'VHR') {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page."/>
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Export Visit Data (VHR)" description="Filter and export submitted visit data from your vertical." />
      <Card className="shadow-xl">
        <CardHeader><CardTitle className="flex items-center gap-2"><ListFilter className="h-5 w-5 text-primary"/>Filter Data</CardTitle><CardDescription>Refine data for export.</CardDescription></CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by ZHR</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between pr-8">{getMultiSelectButtonText(zhrOptions, selectedZhrIds, "All ZHRs", "ZHRs")}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {zhrOptions.map(o => (<DropdownMenuCheckboxItem key={o.value} checked={selectedZhrIds.includes(o.value)} onCheckedChange={() => handleMultiSelectChange(o.value, selectedZhrIds, setSelectedZhrIds)} onSelect={e => e.preventDefault()}>{o.label}</DropdownMenuCheckboxItem>))}
                    {zhrOptions.length === 0 && <DropdownMenuLabel className="text-xs text-muted-foreground px-2">No ZHRs found.</DropdownMenuLabel>}
                    </DropdownMenuContent>
                </DropdownMenu>
                {selectedZhrIds.length > 0 && <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setSelectedZhrIds([])}>Clear ZHRs</Button>}
            </div>
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by BHR</Label>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between pr-8" disabled={bhrOptions.length === 0 && !isLoadingPage}>{getMultiSelectButtonText(bhrOptions, selectedBhrIds, "All BHRs", "BHRs")}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {bhrOptions.map(o => (<DropdownMenuCheckboxItem key={o.value} checked={selectedBhrIds.includes(o.value)} onCheckedChange={() => handleMultiSelectChange(o.value, selectedBhrIds, setSelectedBhrIds)} onSelect={e => e.preventDefault()}>{o.label}</DropdownMenuCheckboxItem>))}
                    {bhrOptions.length === 0 && <DropdownMenuLabel className="text-xs text-muted-foreground px-2">No BHRs match filter.</DropdownMenuLabel>}
                    </DropdownMenuContent>
                </DropdownMenu>
                {selectedBhrIds.length > 0 && <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setSelectedBhrIds([])}>Clear BHRs</Button>}
            </div>
            <div>
                <Label className="text-sm font-medium mb-1 block">Filter by Branch</Label>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between pr-8">{getMultiSelectButtonText(branchOptions, selectedBranchIds, "All Branches", "Branches")}<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {branchOptions.map(o => (<DropdownMenuCheckboxItem key={o.value} checked={selectedBranchIds.includes(o.value)} onCheckedChange={() => handleMultiSelectChange(o.value, selectedBranchIds, setSelectedBranchIds)} onSelect={e => e.preventDefault()}>{o.label}</DropdownMenuCheckboxItem>))}
                    </DropdownMenuContent>
                </DropdownMenu>
                {selectedBranchIds.length > 0 && <Button variant="link" size="sm" className="p-0 h-auto mt-1 text-xs" onClick={() => setSelectedBranchIds([])}>Clear Branches</Button>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <Label className="text-sm font-medium mb-1 block">Branch Category</Label>
                <ShadcnSelect value={selectedBranchCategory} onValueChange={setSelectedBranchCategory} disabled={branchCategoryOptions.length <= 1 && !isLoadingPage}>
                    <SelectTrigger><SelectValue placeholder="Select Category"/></SelectTrigger>
                    <SelectContent>{branchCategoryOptions.map(c => (<SelectItem key={c} value={c}>{c === 'all' ? 'All Categories' : c}</SelectItem>))}</SelectContent>
                </ShadcnSelect>
            </div>
            <div>
                <Label className="text-sm font-medium mb-1 block">Visit Date</Label>
                <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleClearAllFilters} variant="outline" className="w-full sm:w-auto"><XCircle className="mr-2 h-4 w-4" /> Clear All Filters</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      <Card className="shadow-xl">
        <CardHeader><CardTitle>Export Actions</CardTitle></CardHeader>
        <CardContent>
          <Button onClick={handleExportToCSV} disabled={isExporting || isLoadingPage} className="w-full sm:w-auto">
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export to CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
