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

  // New function to handle the click and pass the target directly
  const handleConfirmUnassignClick = (target: typeof unassignTarget) => {
    if (!target) return; // Should not happen if button is correctly rendered
    confirmUnassignBHR(); // Call the core logic
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
          'platinum': 'bg-[#F3E8FF] text-[#6B21A8] hover:bg-[#F3E8FF]/80', // Updated Platinum
          'gold': 'bg-[#FFF7E6] text-[#976A1D] hover:bg-[#FFF7E6]/80',
          'silver': 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#F3F4F6]/80',
          'bronze': 'bg-[#FBF0E4] text-[#8B4513] hover:bg-[#FBF0E4]/80', // Updated Bronze
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
          <Plus className="mr-1.5 h-4 w-4 text-slate-500" /> Assign
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
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <PageTitle
        title="Branch Assignments"
        description="Manage BHR assignments to branches within your zone. Select a branch from the table to assign a BHR."
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search and Filter Controls */}
      <Card className="shadow-lg border-slate-200/50">
        <CardContent className="flex flex-col md:flex-row items-center gap-4 p-4 sm:p-6">
           {/* Search Input */}
          <div className="relative w-full md:flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by branch name, location, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-auto">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[180px] border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Diamond">Diamond</SelectItem>
                <SelectItem value="Platinum">Platinum</SelectItem>
                <SelectItem value="Gold">Gold</SelectItem>
                <SelectItem value="Silver">Silver</SelectItem>
                <SelectItem value="Bronze">Bronze</SelectItem>
                <SelectItem value="Uncategorized">Uncategorized</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-slate-200/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Branches in Your Zone</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">Overview of branches and their current BHR assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading branches...</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredBranches}
              emptyStateMessage="No branches found matching your criteria."
            />
          )}
        </CardContent>
      </Card>

      {/* Assign BHR Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white shadow-2xl border border-slate-200 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-[#004C8F]">Assign BHR to {selectedBranchForAssignment?.name}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground/80 mt-1">
              Select a BHR from your zone to assign to this branch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bhr-select" className="text-sm font-medium text-slate-700">Select BHR</Label>
              <Select value={selectedBhrForAssignment} onValueChange={setSelectedBhrForAssignment}>
                <SelectTrigger className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select a BHR" />
                </SelectTrigger>
                <SelectContent>
                  {bhrsInZoneForDialog.map(bhr => (
                    <SelectItem key={bhr.id} value={bhr.id}>{bhr.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400">Cancel</Button>
            <Button type="button" onClick={handleAssignBHR} className="bg-[#004C8F] hover:bg-[#004C8F]/90 text-white shadow rounded-lg px-4 py-2 text-sm font-semibold">Assign BHR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign BHR Dialog */}
      <AlertDialog open={isUnassignDialogOpen} onOpenChange={setIsUnassignDialogOpen}>
        <AlertDialogContent className="bg-white shadow-2xl border border-slate-200 rounded-xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold tracking-tight text-slate-800">Confirm Unassignment</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground/80 mt-1">
              Are you sure you want to unassign <strong className="text-slate-800">{unassignTarget?.bhrName || 'this BHR'}</strong> from <strong className="text-slate-800">{unassignTarget?.branchName || 'this branch'}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-4">
            <AlertDialogCancel className="rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmUnassignClick(unassignTarget)} className="bg-red-600 hover:bg-red-700 text-white shadow rounded-lg px-4 py-2 text-sm font-semibold">Unassign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

