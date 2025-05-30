
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Assignment } from '@/types';
import { Button } from '@/components/ui/button';
import { Check, PlusCircle, Trash2, UserPlus, Loader2, Search, XCircle } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

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
      console.log("ZHRBranchAssignmentsPage: User not ZHR or not logged in, bailing.", user);
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log("ZHRBranchAssignmentsPage: Starting data fetch for ZHR user:", user.id);

    try {
      // 1. Fetch BHRs that report to the current ZHR (for the assignment dialog and BHR name lookup)
      const { data: bhrsData, error: bhrsError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'BHR')
        .eq('reports_to', user.id);

      console.log("ZHRBranchAssignmentsPage: Fetched BHRs for dialog:", bhrsData);
      if (bhrsError && bhrsError.message) {
        console.error("ZHRBranchAssignmentsPage: Fetched BHRs error:", bhrsError.message, bhrsError);
        throw new Error(`Failed to fetch BHRs: ${bhrsError.message}`);
      }
      setBhrsInZoneForDialog(bhrsData || []);

      // 2. Fetch ALL branches
      const { data: allBranchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location, category, code');
      
      console.log("ZHRBranchAssignmentsPage: Fetched ALL branches data:", allBranchesData);
      if (branchesError && branchesError.message) {
        console.error("ZHRBranchAssignmentsPage: Fetched ALL branches error:", branchesError.message, branchesError);
        throw new Error(`Failed to fetch branches: ${branchesError.message}`);
      }
      
      if (!allBranchesData || allBranchesData.length === 0) {
        console.warn("ZHRBranchAssignmentsPage: No branches found in the database.");
        setBranchesInZone([]);
        setIsLoading(false);
        return;
      }

      // 3. Fetch assignments ONLY for the BHRs under this ZHR
      const bhrIdsInZone = (bhrsData || []).map(bhr => bhr.id);
      let assignmentsForZhrsBHRs: Assignment[] = [];
      if (bhrIdsInZone.length > 0) {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select('id, bhr_id, branch_id')
          .in('bhr_id', bhrIdsInZone);

        console.log("ZHRBranchAssignmentsPage: Fetched assignments for ZHR's BHRs:", assignmentsData);
        if (assignmentsError && assignmentsError.message) {
          console.error("ZHRBranchAssignmentsPage: Fetched assignments error:", assignmentsError.message, assignmentsError);
        }
        assignmentsForZhrsBHRs = assignmentsData || [];
      } else {
        console.log("ZHRBranchAssignmentsPage: No BHRs found for this ZHR, so no assignments to fetch by BHR ID.");
      }
      
      // Map all branches, and for each branch, find if any of the ZHR's BHRs are assigned to it.
      const branchViews: BranchAssignmentView[] = allBranchesData.map(branch => {
        const assignmentsForThisBranchByZhrsBHRs = assignmentsForZhrsBHRs.filter(a => a.branch_id === branch.id);
        const assignedBHRsDetails = assignmentsForThisBranchByZhrsBHRs
          .map(a => (bhrsData || []).find(bhrUser => bhrUser.id === a.bhr_id))
          .filter(bhrUser => bhrUser !== undefined) as User[]; // Type assertion
        return { ...branch, assignedBHRs: assignedBHRsDetails };
      });
      
      console.log("ZHRBranchAssignmentsPage: Constructed branchViews:", branchViews);
      setBranchesInZone(branchViews);

    } catch (e: any) {
      console.error("ZHRBranchAssignmentsPage: Error in fetchData's try-catch block:", e.message, e);
      setError(e.message || "An unexpected error occurred while fetching data.");
      toast({ title: "Error", description: e.message || "Could not load branch data.", variant: "destructive" });
      setBranchesInZone([]); 
    } finally {
      setIsLoading(false);
      console.log("ZHRBranchAssignmentsPage: Data fetch finished. Loading state:", false);
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
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'code', header: 'Code' },
    {
      accessorKey: 'assignedBHRs',
      header: 'Assigned BHR(s)',
      cell: (branch) => ( 
        <div className="flex flex-wrap gap-1">
          {branch.assignedBHRs.length > 0 ? branch.assignedBHRs.map(bhrUser => (
            <div key={bhrUser.id} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs">
                {bhrUser.name}
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleOpenUnassignDialog(branch.id, bhrUser.id, branch.name, bhrUser.name)}>
                    <Trash2 className="h-3 w-3 text-destructive"/>
                </Button>
            </div>
          )) : <span className="text-xs text-muted-foreground">None</span>}
        </div>
      ),
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (branch) => ( 
        <Button variant="outline" size="sm" onClick={() => handleOpenAssignDialog(branch)}>
          <UserPlus className="mr-2 h-4 w-4" /> Assign BHR
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
        (branch.location && branch.location.toLowerCase().includes(term)) || // Added null check for location
        (branch.code && branch.code.toLowerCase().includes(term)); // Added null check for code
      
      const matchesCategory = selectedCategory === 'all' || branch.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [branchesInZone, searchTerm, selectedCategory]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };


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
      <div className="space-y-8">
        <PageTitle title="Branch Assignments" description="Manage BHR assignments to branches within your zone." />
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

  console.log("ZHRBranchAssignmentsPage: Rendering DataTable with filteredBranches:", filteredBranches);
  console.log("ZHRBranchAssignmentsPage: isLoading state:", isLoading);


  return (
    <div className="space-y-8">
      <PageTitle title="Branch Assignments" description="Manage BHR assignments to branches within your zone." />
      {error && branchesInZone.length > 0 && ( 
         <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Partial Data Error</AlertTitle>
            <AlertDescription>
                There was an issue fetching some data: {error} Displaying potentially incomplete results.
            </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-md">
        <CardHeader className="border-b pb-2">
             <CardTitle className="text-lg">Filter Assignments</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"> {/* Changed to md:grid-cols-3 */}
              <div className="relative md:col-span-1"> {/* Adjusted col-span */}
                <Label htmlFor="search-assignments" className="sr-only">Search</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-assignments"
                  placeholder="Search by branch name, location, code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="md:col-span-1"> {/* Adjusted col-span */}
                <Label htmlFor="category-filter" className="sr-only">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={branchCategories.length <= 1}>
                  <SelectTrigger id="category-filter">
                    <SelectValue placeholder="Filter by Category" />
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
              <Button onClick={handleClearFilters} variant="outline" className="w-full md:w-auto md:col-span-1"> {/* Adjusted col-span and width */}
                <XCircle className="mr-2 h-4 w-4" /> Clear Filters
              </Button>
            </div>
          </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredBranches}
        emptyStateMessage={
          isLoading ? "Loading..." : 
          (error ? `Error loading data: ${error}` : 
          (branchesInZone.length === 0 ? "No branches found." : "No branches match your current filters."))
        }
      />

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign BHR to {selectedBranchForAssignment?.name}</DialogTitle>
            <DialogDescription>
              Select a BHR from your zone to assign to this branch. A branch can have multiple BHRs from your team.
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
            <Button onClick={handleAssignBHR} disabled={isLoading || !selectedBhrForAssignment || bhrsInZoneForDialog.length === 0}><Check className="mr-2 h-4 w-4" />Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isUnassignDialogOpen} onOpenChange={setIsUnassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Unassignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign {unassignTarget?.bhrName || 'this BHR'} from {unassignTarget?.branchName || 'this branch'}? This action cannot be undone.
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
