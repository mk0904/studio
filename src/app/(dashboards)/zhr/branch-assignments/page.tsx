
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
  const [bhrsInZone, setBhrsInZone] = useState<User[]>([]);
  const [selectedBranchForAssignment, setSelectedBranchForAssignment] = useState<Branch | null>(null);
  const [selectedBhrForAssignment, setSelectedBhrForAssignment] = useState<string>('');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user || user.role !== 'ZHR') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log("ZHRBranchAssignmentsPage: Starting data fetch for user:", user.id);

    try {
      // 1. Fetch BHRs reporting to the current ZHR
      const { data: bhrsInZoneQuery, error: bhrsError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'BHR')
        .eq('reports_to', user.id);

      console.log("ZHRBranchAssignmentsPage: Fetched BHRs data:", bhrsInZoneQuery);
      if (bhrsError) {
        console.error("ZHRBranchAssignmentsPage: Fetched BHRs error:", bhrsError);
        throw new Error(`Failed to fetch BHRs: ${bhrsError.message}`);
      }
      if (!bhrsInZoneQuery) throw new Error('No BHRs found or query returned null.');
      
      setBhrsInZone(bhrsInZoneQuery as User[]);
      const bhrIds = bhrsInZoneQuery.map(bhr => bhr.id);
      console.log("ZHRBranchAssignmentsPage: BHR IDs in zone:", bhrIds);

      if (bhrIds.length === 0) {
        console.log("ZHRBranchAssignmentsPage: No BHRs in zone, setting empty branches and assignments.");
        setBranchesInZone([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch assignments for these BHRs
      const { data: assignmentsQuery, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, bhr_id, branch_id')
        .in('bhr_id', bhrIds);
      
      console.log("ZHRBranchAssignmentsPage: Fetched assignments data:", assignmentsQuery);
      if (assignmentsError) {
        console.error("ZHRBranchAssignmentsPage: Fetched assignments error:", assignmentsError);
        throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
      }
      if (!assignmentsQuery) throw new Error('No assignments found or query returned null.');

      const branchIdsFromAssignments = Array.from(new Set(assignmentsQuery.map(a => a.branch_id)));
      console.log("ZHRBranchAssignmentsPage: Branch IDs from assignments:", branchIdsFromAssignments);

      if (branchIdsFromAssignments.length === 0) {
        console.log("ZHRBranchAssignmentsPage: No branches assigned to BHRs, setting empty branches.");
        setBranchesInZone([]); 
        setIsLoading(false);
        return;
      }

      // 3. Fetch details for these branches
      const { data: branchesQuery, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location, category, code')
        .in('id', branchIdsFromAssignments);

      console.log("ZHRBranchAssignmentsPage: Fetched branches data:", branchesQuery);
      if (branchesError) {
        console.error("ZHRBranchAssignmentsPage: Fetched branches error:", branchesError);
        throw new Error(`Failed to fetch branches: ${branchesError.message}`);
      }
      if (!branchesQuery) throw new Error('No branches found or query returned null.');

      // 4. Construct BranchAssignmentView
      const branchViews = branchesQuery.map(branch => {
        const assignmentsForThisBranch = assignmentsQuery.filter(a => a.branch_id === branch.id);
        const assignedBHRsDetails = assignmentsForThisBranch
          .map(a => bhrsInZoneQuery.find(bhr => bhr.id === a.bhr_id))
          .filter(bhr => bhr !== undefined) as User[];
        return { ...branch, assignedBHRs: assignedBHRsDetails };
      });
      console.log("ZHRBranchAssignmentsPage: Constructed branchViews:", branchViews);

      setBranchesInZone(branchViews);

    } catch (e: any) {
      console.error("ZHRBranchAssignmentsPage: Error in fetchData:", e);
      setError(e.message || "An unexpected error occurred while fetching data.");
      toast({ title: "Error", description: e.message || "Could not load assignments.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      console.log("ZHRBranchAssignmentsPage: Data fetch finished. Loading state:", false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, toast]); 


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

    // Check if assignment already exists
    const { data: existingAssignment, error: checkError } = await supabase
        .from('assignments')
        .select('id')
        .eq('branch_id', selectedBranchForAssignment.id)
        .eq('bhr_id', selectedBhrForAssignment)
        .maybeSingle(); 

    if (checkError) {
        toast({ title: "Error", description: `Failed to check existing assignment: ${checkError.message}`, variant: "destructive" });
        return;
    }
    
    if (existingAssignment) {
        toast({ title: "Info", description: "This BHR is already assigned to this branch.", variant: "default" });
        setIsAssignDialogOpen(false);
        return;
    }

    // Perform assignment
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
        fetchData(); 
    }
    setIsAssignDialogOpen(false);
  };
  
  const handleUnassignBHR = async (branchId: string, bhrId: string) => {
    const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('branch_id', branchId)
        .eq('bhr_id', bhrId);

    if (error) {
        toast({ title: "Error", description: `Failed to unassign BHR: ${error.message}`, variant: "destructive" });
    } else {
        toast({ title: "Success", description: "BHR unassigned from branch." });
        fetchData();
    }
  };

  const columns: ColumnConfig<BranchAssignmentView>[] = [
    { accessorKey: 'name', header: 'Branch Name' },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'assignedBHRs',
      header: 'Assigned BHR(s)',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.assignedBHRs.length > 0 ? row.assignedBHRs.map(bhr => (
            <div key={bhr.id} className="flex items-center bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs">
                {bhr.name}
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleUnassignBHR(row.id, bhr.id)}>
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
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => handleOpenAssignDialog(row)}>
          <UserPlus className="mr-2 h-4 w-4" /> Assign BHR
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading branch assignments...</p>
      </div>
    );
  }

  if (error) {
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

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="Branch Assignments" description="Manage BHR assignments to branches within your zone." />
      <DataTable
        columns={columns}
        data={branchesInZone}
        emptyStateMessage="No branches found in your zone or available for assignment."
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
                  {bhrsInZone.map(bhr => (
                    <SelectItem key={bhr.id} value={bhr.id}>{bhr.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignBHR}><Check className="mr-2 h-4 w-4" />Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
