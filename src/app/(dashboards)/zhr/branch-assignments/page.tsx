
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Assignment } from '@/types';
import { Button } from '@/components/ui/button';
import { Check, PlusCircle, Trash2, UserPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface BranchAssignmentView extends Branch {
  assignedBHRs: User[];
}

export default function ZHRBranchAssignmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [branchesInZone, setBranchesInZone] = useState<BranchAssignmentView[]>([]);
  const [bhrsInZone, setBhrsInZone] = useState<User[]>([]); // Still needed for the dialog
  const [selectedBranchForAssignment, setSelectedBranchForAssignment] = useState<Branch | null>(null);
  const [selectedBhrForAssignment, setSelectedBhrForAssignment] = useState<string>('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user || user.role !== 'ZHR') {
      setIsLoading(false);
      setError("User is not a ZHR or not logged in.");
      console.log("ZHRBranchAssignmentsPage: User not ZHR or not logged in, bailing.", user);
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log("ZHRBranchAssignmentsPage: Starting simplified data fetch for user:", user.id);

    try {
      // 0. Fetch BHRs in the zone (still needed for the assignment dialog)
      const { data: bhrsData, error: bhrsError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'BHR')
        .eq('reports_to', user.id);

      if (bhrsError) {
        console.error("ZHRBranchAssignmentsPage: Fetched BHRs error:", bhrsError.message, bhrsError);
        throw new Error(`Failed to fetch BHRs: ${bhrsError.message}`);
      }
      setBhrsInZone(bhrsData as User[] || []);
      console.log("ZHRBranchAssignmentsPage: Fetched BHRs for dialog:", bhrsData);


      // 1. Fetch ALL branches
      const { data: allBranchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location, category, code');

      console.log("ZHRBranchAssignmentsPage: Fetched ALL branches data:", allBranchesData);
      if (branchesError) {
        console.error("ZHRBranchAssignmentsPage: Fetched ALL branches error:", branchesError.message, branchesError);
        throw new Error(`Failed to fetch branches: ${branchesError.message}`);
      }
      
      if (!allBranchesData || allBranchesData.length === 0) {
        console.warn("ZHRBranchAssignmentsPage: No branches found in the database or query returned null/empty.");
        setBranchesInZone([]);
        setIsLoading(false);
        return;
      }

      // For this simplified test, we'll just display branches and ignore assignments for now
      // We still need to fetch assignments for the full functionality later
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, bhr_id, branch_id')
        .in('bhr_id', (bhrsData || []).map(bhr => bhr.id)); // Filter by BHRs in zone

      if (assignmentsError) {
        console.error("ZHRBranchAssignmentsPage: Fetched assignments error:", assignmentsError.message, assignmentsError);
        // Don't throw, proceed with empty assignments if necessary
      }
      const assignments = assignmentsData || [];
      console.log("ZHRBranchAssignmentsPage: Fetched assignments for ZHR's BHRs:", assignments);

      // 2. Construct BranchAssignmentView, linking assignments
      const branchViews: BranchAssignmentView[] = allBranchesData.map(branch => {
        const assignmentsForThisBranch = assignments.filter(a => a.branch_id === branch.id);
        const assignedBHRsDetails = assignmentsForThisBranch
          .map(a => (bhrsData || []).find(bhrUser => bhrUser.id === a.bhr_id))
          .filter(bhrUser => bhrUser !== undefined) as User[];
        return { ...branch, assignedBHRs: assignedBHRsDetails };
      });
      
      console.log("ZHRBranchAssignmentsPage: Constructed branchViews:", branchViews);
      setBranchesInZone(branchViews);

    } catch (e: any) {
      console.error("ZHRBranchAssignmentsPage: Error in fetchData's try-catch block:", e.message, e);
      setError(e.message || "An unexpected error occurred while fetching data.");
      toast({ title: "Error", description: e.message || "Could not load branch data.", variant: "destructive" });
      setBranchesInZone([]); // Clear data on error
    } finally {
      setIsLoading(false);
      console.log("ZHRBranchAssignmentsPage: Data fetch finished. Loading state:", false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'ZHR') { // Ensure user is loaded and is a ZHR
        fetchData();
    } else if (user && user.role !== 'ZHR') {
        setError("Access denied. User is not a ZHR.");
        setIsLoading(false);
    } else {
        // User is null, isLoading might still be true from AuthContext, or already false
        // If AuthContext isLoading is false and user is null, then it's truly no user.
        // Let AuthContext handle redirect or loading screen.
        // If we set isLoading to false here prematurely, it might flash content.
        // However, if user is null and AuthContext indicates loading is done, then no data to fetch.
        // This part is tricky; usually AuthProvider handles the main loading/redirect for no user.
    }
  }, [user]); // Only re-run if user object changes.


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

    setIsLoading(true); // Indicate an operation is in progress
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
        await fetchData(); // Refetch data to show the new assignment
    }
    setIsAssignDialogOpen(false);
    setIsLoading(false); // Ensure loading is false after operation
  };
  
  const handleUnassignBHR = async (branchId: string, bhrId: string) => {
    setIsLoading(true); // Indicate an operation is in progress
    const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('branch_id', branchId)
        .eq('bhr_id', bhrId);

    if (error) {
        toast({ title: "Error", description: `Failed to unassign BHR: ${error.message}`, variant: "destructive" });
    } else {
        toast({ title: "Success", description: "BHR unassigned from branch." });
        await fetchData(); // Refetch data
    }
    setIsLoading(false); // Ensure loading is false after operation
  };

  // Simplified columns for debugging
  const columns: ColumnConfig<BranchAssignmentView>[] = [
    { accessorKey: 'name', header: 'Branch Name' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'code', header: 'Code' },
    {
      accessorKey: 'assignedBHRs',
      header: 'Assigned BHR(s)',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.assignedBHRs.length > 0 ? row.original.assignedBHRs.map(bhrUser => (
            <div key={bhrUser.id} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs">
                {bhrUser.name}
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleUnassignBHR(row.original.id, bhrUser.id)}>
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
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => handleOpenAssignDialog(row.original)}>
          <UserPlus className="mr-2 h-4 w-4" /> Assign BHR
        </Button>
      ),
    },
  ];

  if (isLoading && branchesInZone.length === 0) { // Show loader only if data is truly not there yet
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading branch assignments...</p>
      </div>
    );
  }

  if (error) { // Show full page error only if it's critical
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

  if (!user && !isLoading) { // Handles case where auth context has finished loading and there's no user.
    return <PageTitle title="Access Denied" description="Please log in to view this page." />;
  }
  if (user && user.role !== 'ZHR' && !isLoading) {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }


  // Log branchesInZone right before rendering DataTable
  console.log("ZHRBranchAssignmentsPage: Rendering DataTable with branchesInZone:", branchesInZone);
  console.log("ZHRBranchAssignmentsPage: isLoading state:", isLoading);


  return (
    <div className="space-y-8">
      <PageTitle title="Branch Assignments" description="Manage BHR assignments to branches within your zone." />
      <DataTable
        columns={columns}
        data={branchesInZone}
        emptyStateMessage={isLoading ? "Loading..." : (error ? "Error loading data." : "No branches found in the system, or no branches are assignable by you.")}
      />

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign BHR to {selectedBranchForAssignment?.name}</DialogTitle>
            <DialogDescription>
              Select a BHR from your zone to assign to this branch. A branch can have multiple BHRs.
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
                  {bhrsInZone.length > 0 ? bhrsInZone.map(bhrUser => (
                    <SelectItem key={bhrUser.id} value={bhrUser.id}>{bhrUser.name}</SelectItem>
                  )) : <SelectItem value="nobhrs" disabled>No BHRs in your zone</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignBHR} disabled={isLoading || !selectedBhrForAssignment || bhrsInZone.length === 0}><Check className="mr-2 h-4 w-4" />Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

