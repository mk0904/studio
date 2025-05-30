
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Branch, User, Assignment } from '@/types';
import { mockBranches, mockUsers, mockAssignments, getVisibleUsers, getVisibleBranchesForZHR } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Check, PlusCircle, Trash2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

  useEffect(() => {
    if (user && user.role === 'ZHR') {
      const visibleBHRs = getVisibleUsers(user).filter(u => u.role === 'BHR' && u.reports_to === user.id);
      setBhrsInZone(visibleBHRs);

      const zoneBranches = getVisibleBranchesForZHR(user.id); // Gets unique branches for the zone
      const branchViews = zoneBranches.map(branch => {
        const assignmentsForBranch = mockAssignments.filter(a => a.branch_id === branch.id);
        const assignedBHRs = assignmentsForBranch
          .map(a => visibleBHRs.find(bhr => bhr.id === a.bhr_id))
          .filter(bhr => bhr !== undefined) as User[];
        return { ...branch, assignedBHRs };
      });
      setBranchesInZone(branchViews);
    }
  }, [user]);

  const handleOpenAssignDialog = (branch: Branch) => {
    setSelectedBranchForAssignment(branch);
    setSelectedBhrForAssignment('');
    setIsAssignDialogOpen(true);
  };

  const handleAssignBHR = () => {
    if (!selectedBranchForAssignment || !selectedBhrForAssignment) {
      toast({ title: "Error", description: "Please select a branch and BHR.", variant: "destructive" });
      return;
    }

    // Check if assignment already exists
    const existingAssignment = mockAssignments.find(a => a.branch_id === selectedBranchForAssignment.id && a.bhr_id === selectedBhrForAssignment);
    if (existingAssignment) {
        toast({ title: "Info", description: "This BHR is already assigned to this branch.", variant: "default" });
        setIsAssignDialogOpen(false);
        return;
    }

    // Simulate assignment
    mockAssignments.push({
      id: `assign-${mockAssignments.length + 1}`,
      branch_id: selectedBranchForAssignment.id,
      bhr_id: selectedBhrForAssignment,
    });

    // Update local state for immediate UI feedback
    setBranchesInZone(prev => prev.map(b => {
      if (b.id === selectedBranchForAssignment.id) {
        const bhrToAdd = bhrsInZone.find(bhr => bhr.id === selectedBhrForAssignment);
        return { ...b, assignedBHRs: bhrToAdd ? [...b.assignedBHRs, bhrToAdd] : b.assignedBHRs };
      }
      return b;
    }));
    
    toast({ title: "Success", description: `BHR assigned to ${selectedBranchForAssignment.name}.` });
    setIsAssignDialogOpen(false);
  };
  
  const handleUnassignBHR = (branchId: string, bhrId: string) => {
    const assignmentIndex = mockAssignments.findIndex(a => a.branch_id === branchId && a.bhr_id === bhrId);
    if (assignmentIndex > -1) {
        mockAssignments.splice(assignmentIndex, 1);

        setBranchesInZone(prev => prev.map(b => {
            if (b.id === branchId) {
                return { ...b, assignedBHRs: b.assignedBHRs.filter(bhr => bhr.id !== bhrId)};
            }
            return b;
        }));
        toast({ title: "Success", description: "BHR unassigned from branch." });
    } else {
        toast({ title: "Error", description: "Assignment not found.", variant: "destructive" });
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

