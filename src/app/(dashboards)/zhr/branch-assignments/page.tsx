
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Assignment } from '@/types';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, Loader2, Search, XCircle, MapPin, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BranchAssignmentView extends Branch {
  assignedBHRs: User[];
}

export default function ZHRBranchAssignmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [branchesInZone, setBranchesInZone] = useState<BranchAssignmentView[]>([]);
  const [bhrsInZoneForDialog, setBhrsInZoneForDialog] = useState<User[]>([]);
  const [selectedBranchForAssignment, setSelectedBranchForAssignment] = useState<Branch | null>(null);
  const [selectedBhrForAssignment, setSelectedBhrForAssignment] = useState<string>('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{ branchId: string; bhrId: string; branchName?: string; bhrName?: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'ZHR') {
      setIsLoading(false);
      setError("User is not a ZHR or not logged in.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data: bhrsData, error: bhrsError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'BHR')
        .eq('reports_to', user.id);

      if (bhrsError) throw bhrsError;
      setBhrsInZoneForDialog(bhrsData || []);

      const { data: allBranchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location, category, code');
      
      if (branchesError) throw branchesError;
      
      if (!allBranchesData || allBranchesData.length === 0) {
        setBranchesInZone([]);
        setIsLoading(false);
        return;
      }

      const bhrIdsInZone = (bhrsData || []).map(bhr => bhr.id);
      let assignmentsForZhrsBHRs: Assignment[] = [];
      if (bhrIdsInZone.length > 0) {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select('id, bhr_id, branch_id')
          .in('bhr_id', bhrIdsInZone);
        if (assignmentsError) console.error("Error fetching assignments:", assignmentsError.message);
        assignmentsForZhrsBHRs = assignmentsData || [];
      }
      
      const branchViews: BranchAssignmentView[] = allBranchesData.map(branch => {
        const assignmentsForThisBranchByZhrsBHRs = assignmentsForZhrsBHRs.filter(a => a.branch_id === branch.id);
        const assignedBHRsDetails = assignmentsForThisBranchByZhrsBHRs
          .map(a => (bhrsData || []).find(bhrUser => bhrUser.id === a.bhr_id))
          .filter(bhrUser => bhrUser !== undefined) as User[];
        return { ...branch, assignedBHRs: assignedBHRsDetails };
      });
      
      setBranchesInZone(branchViews);

    } catch (e: any) {
      console.error("Error in fetchData:", e.message, e);
      setError(e.message || "An unexpected error occurred while fetching data.");
      toast({ title: "Error", description: e.message || "Could not load branch data.", variant: "destructive" });
      setBranchesInZone([]); 
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);


  useEffect(() => {
    if (user && user.role === 'ZHR') {
        fetchData();
    } else if (user && user.role !== 'ZHR') {
        setError("Access denied. User is not a ZHR.");
        setIsLoading(false);
    }
  }, [user, fetchData]); 


  const handleOpenAssignDialog = (branch: Branch) => {
    setSelectedBranchForAssignment(branch);
    setSelectedBhrForAssignment('');
    setIsAssignDialogOpen(true);
  };

  const handleAssignBHR = async () => {
    if (!selectedBranchForAssignment || !selectedBhrForAssignment) {
      toast({ title: "Error", description: "Please select a branch and BHR.", variant: "destructive" });
      return;
    }

    setIsLoading(true); 
    const { data: existingAssignment, error: checkError } = await supabase
        .from('assignments')
        .select('id')
        .eq('branch_id', selectedBranchForAssignment.id)
        .eq('bhr_id', selectedBhrForAssignment)
        .maybeSingle(); 

    if (checkError) {
        toast({ title: "Error", description: `Failed to check existing assignment: ${checkError.message}`, variant: "destructive" });
        setIsLoading(false);
        return;
    }
    
    if (existingAssignment) {
        toast({ title: "Info", description: "This BHR is already assigned to this branch.", variant: "default" });
        setIsAssignDialogOpen(false);
        setIsLoading(false);
        return;
    }

    const { error: insertError } = await supabase
        .from('assignments')
        .insert({
            branch_id: selectedBranchForAssignment.id,
            bhr_id: selectedBhrForAssignment,
        });

    if (insertError) {
        toast({ title: "Error", description: `Failed to assign BHR: ${insertError.message}`, variant: "destructive" });
    } else {
        toast({ title: "Success", description: `BHR assigned to ${selectedBranchForAssignment.name}.` });
        await fetchData(); 
    }
    setIsAssignDialogOpen(false);
    setIsLoading(false);
  };
  
  const handleOpenUnassignDialog = (branchId: string, bhrId: string, branchName?: string, bhrName?: string) => {
    setUnassignTarget({ branchId, bhrId, branchName, bhrName });
    setIsUnassignDialogOpen(true);
  };

  const confirmUnassignBHR = async () => {
    if (!unassignTarget) return;
    setIsLoading(true);
    const { branchId, bhrId, bhrName, branchName } = unassignTarget;

    const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('branch_id', branchId)
        .eq('bhr_id', bhrId);

    if (error) {
        toast({ title: "Error", description: `Failed to unassign ${bhrName || 'BHR'} from ${branchName || 'branch'}: ${error.message}`, variant: "destructive" });
    } else {
        toast({ title: "Success", description: `${bhrName || 'BHR'} unassigned from ${branchName || 'branch'}.` });
        await fetchData();
    }
    setIsLoading(false);
    setIsUnassignDialogOpen(false);
    setUnassignTarget(null);
  };

  const columns: ColumnConfig<BranchAssignmentView>[] = [
    { accessorKey: 'name', header: 'Branch Name' },
    { 
      accessorKey: 'location', 
      header: 'Location',
      cell: (branch) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground/80" />
          <span>{branch.location}</span>
        </div>
      )
    },
    { 
      accessorKey: 'category', 
      header: 'Category',
      cell: (branch) => {
        const category = (branch.category || 'uncategorized').toLowerCase();
        const categoryColors = {
          'diamond': 'bg-[#ECF9FF] text-[#0B4D76] hover:bg-[#ECF9FF]/80',
          'platinum': 'bg-[#F3E8FF] text-[#6B21A8] hover:bg-[#F3E8FF]/80',
          'gold': 'bg-[#FFF7E6] text-[#976A1D] hover:bg-[#FFF7E6]/80',
          'silver': 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#F3F4F6]/80',
          'bronze': 'bg-[#FBF0E4] text-[#8B4513] hover:bg-[#FBF0E4]/80',
          'uncategorized': 'bg-slate-50 text-slate-600 hover:bg-slate-50/80'
        };
        return <Badge variant="secondary" className={cn("font-medium text-xs px-2 py-0.5", categoryColors[category as keyof typeof categoryColors] || categoryColors.uncategorized)}>{branch.category || 'N/A'}</Badge>;
      }
    },
    {
      accessorKey: 'assignedBHRs',
      header: 'Assigned BHRs',
      cell: (branch) => ( 
        <div className="flex flex-wrap gap-1.5 items-center min-h-[24px]">
          {branch.assignedBHRs.length > 0 ? branch.assignedBHRs.map(bhrUser => (
            <Badge 
              key={bhrUser.id} 
              variant="secondary" 
              className="text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200/80 py-1 pl-2.5 pr-1.5"
            >
                {bhrUser.name}
                <button 
                    onClick={() => handleOpenUnassignDialog(branch.id, bhrUser.id, branch.name, bhrUser.name)} 
                    className="ml-1.5 p-0.5 rounded-full hover:bg-slate-300 transition-colors"
                    aria-label={`Unassign ${bhrUser.name}`}
                >
                    <XCircle className="h-3.5 w-3.5 text-slate-500 hover:text-destructive"/>
                </button>
            </Badge>
          )) : <span className="text-xs text-slate-500 px-2">No BHRs assigned</span>}
        </div>
      ),
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (branch) => ( 
        <Button 
          onClick={() => handleOpenAssignDialog(branch)} 
          className="h-9 px-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-colors duration-150"
        >
          <UserPlus className="mr-1.5 h-4 w-4 text-slate-500" /> Assign
        </Button>
      ),
    },
  ];

  const branchCategories = useMemo(() => {
    const categories = new Set(branchesInZone.map(b => b.category).filter(Boolean));
    return ["all", ...Array.from(categories)];
  }, [branchesInZone]);

  const filteredBranches = useMemo(() => {
    return branchesInZone.filter(branch => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = term === '' ||
        branch.name.toLowerCase().includes(term) ||
        (branch.location && branch.location.toLowerCase().includes(term));
      
      const matchesCategory = selectedCategory === 'all' || branch.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [branchesInZone, searchTerm, selectedCategory]);


  if (isLoading && branchesInZone.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading branch assignments...</p>
      </div>
    );
  }

  if (error && branchesInZone.length === 0) { 
     return (
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
        <PageTitle title="Branch Mapping" description="Assign branches to Branch Head Representatives (BHRs)" />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Fetching Data</AlertTitle>
          <AlertDescription>
            {error} Please try refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user && !isLoading) {
    return <PageTitle title="Access Denied" description="Please log in to view this page." />;
  }
  if (user && user.role !== 'ZHR' && !isLoading) {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
      <PageTitle title="Branch Mapping" description="Assign branches to Branch Head Representatives (BHRs)" />
      
      {error && branchesInZone.length > 0 && ( 
         <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Partial Data Error</AlertTitle>
            <AlertDescription>
                There was an issue fetching some data: {error} Displaying potentially incomplete results.
            </AlertDescription>
        </Alert>
      )}

      <Card className="border-0 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardHeader className="border-b pb-4 px-4 sm:px-6 pt-5">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="relative flex-grow w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search branches by name or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200"
                />
              </div>
              <div className="w-full sm:w-auto sm:min-w-[180px]">
                <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={branchCategories.length <= 1}>
                  <SelectTrigger className="h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <DataTable
            columns={columns}
            data={filteredBranches}
            tableClassName="[&_thead_th]:bg-slate-50/80 [&_thead_th]:text-[0.7rem] [&_thead_th]:sm:text-xs [&_thead_th]:font-semibold [&_thead_th]:text-slate-500 [&_thead_th]:h-10 [&_thead_th]:sm:h-12 [&_thead_th]:px-2 [&_thead_th]:sm:px-4 [&_thead]:border-b [&_thead]:border-slate-200/60 [&_tbody_td]:px-2 [&_tbody_td]:sm:px-4 [&_tbody_td]:py-2 [&_tbody_td]:sm:py-3 [&_tbody_td]:text-xs [&_tbody_td]:sm:text-sm [&_tbody_tr:hover]:bg-blue-50/30 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100/60 [&_tr]:transition-colors [&_td]:align-middle [&_tbody_tr:last-child]:border-0"
            emptyStateMessage={
              isLoading ? "Loading..." : 
              (error ? `Error loading data.` : 
              (branchesInZone.length === 0 ? "No branches found in the system." : "No branches match your current filters."))
            }
          />
        </CardContent>
      </Card>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign BHR to {selectedBranchForAssignment?.name}</DialogTitle>
            <DialogDescription>
              Select a BHR from your zone to assign to this branch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bhr-select" className="text-right">
                BHR
              </Label>
              <Select value={selectedBhrForAssignment} onValueChange={setSelectedBhrForAssignment}>
                <SelectTrigger id="bhr-select" className="col-span-3">
                  <SelectValue placeholder="Select a BHR" />
                </SelectTrigger>
                <SelectContent>
                  {bhrsInZoneForDialog.length > 0 ? bhrsInZoneForDialog.map(bhrUser => (
                    <SelectItem key={bhrUser.id} value={bhrUser.id}>{bhrUser.name}</SelectItem>
                  )) : <SelectItem value="nobhrs" disabled>No BHRs in your zone</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignBHR} disabled={isLoading || !selectedBhrForAssignment || bhrsInZoneForDialog.length === 0}><UserPlus className="mr-2 h-4 w-4" />Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isUnassignDialogOpen} onOpenChange={setIsUnassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Unassignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign {unassignTarget?.bhrName || 'this BHR'} from {unassignTarget?.branchName || 'this branch'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsUnassignDialogOpen(false); setUnassignTarget(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnassignBHR} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Unassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

