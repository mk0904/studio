
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { User, Branch, Assignment } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Search, ListChecks } from 'lucide-react';
import { HierarchyNode, type UserNode } from '@/components/chr/hierarchy-node';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BhrSubmissionsListModal } from '@/components/shared/bhr-submissions-list-modal';

export default function VHRTeamStructurePage() {
  const { user: currentUser } = useAuth();
  const [initialRootUserNodes, setInitialRootUserNodes] = useState<UserNode[]>([]);
  const [displayedRootUserNodes, setDisplayedRootUserNodes] = useState<UserNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [selectedBhrForModal, setSelectedBhrForModal] = useState<User | null>(null);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const handleShowSubmissions = (bhr: User) => {
    setSelectedBhrForModal(bhr);
    setIsSubmissionsModalOpen(true);
  };

  const fetchDataAndBuildInitialHierarchy = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'VHR') {
      setError("Access Denied. You must be a VHR to view this page.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Define buildHierarchyTree INSIDE fetchDataAndBuildInitialHierarchy
    // to ensure it uses the fresh localAllBranches and localAllAssignments
    const buildTreeRecursive = (
      usersList: User[], 
      parentId: string | null,
      _allBranches: Branch[],
      _allAssignments: Assignment[]
    ): UserNode[] => {
      return usersList
        .filter(user => user.reports_to === parentId)
        .map(user => {
          let currentAssignedBranchNames: string[] = [];
          if (user.role === 'BHR') {
            const bhrAssignments = _allAssignments.filter(a => a.bhr_id === user.id);
            currentAssignedBranchNames = bhrAssignments.map(a => {
              const branch = _allBranches.find(b => b.id === a.branch_id);
              return branch?.name || 'Unknown Branch';
            }).sort();
          }
          return {
            ...user,
            assignedBranchNames: user.role === 'BHR' ? currentAssignedBranchNames : undefined,
            children: buildTreeRecursive(usersList, user.id, _allBranches, _allAssignments),
          };
        });
    };

    try {
      // 1. Get ZHRs reporting to current VHR
      const { data: zhrUsers, error: zhrError } = await supabase
        .from('users')
        .select('id, name, email, role, reports_to, e_code, location')
        .eq('role', 'ZHR')
        .eq('reports_to', currentUser.id);
      if (zhrError) throw zhrError;

      let bhrUsers: User[] = [];
      const zhrIds = (zhrUsers || []).map(z => z.id);
      if (zhrIds.length > 0) {
        // 2. Get BHRs reporting to these ZHRs
        const { data: fetchedBhrs, error: bhrError } = await supabase
          .from('users')
          .select('id, name, email, role, reports_to, e_code, location')
          .eq('role', 'BHR')
          .in('reports_to', zhrIds);
        if (bhrError) throw bhrError;
        bhrUsers = fetchedBhrs || [];
      }

      // All relevant users for this VHR's view
      const relevantUsers = [...(zhrUsers || []), ...bhrUsers];
      // setAllUsersInVertical(relevantUsers); // Not directly used elsewhere if tree is primary display

      // Fetch all branches (locally)
      const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name');
      if (branchesError) throw branchesError;
      const localAllBranches = branchesData || [];

      // Fetch all assignments (locally)
      const { data: assignmentsData, error: assignmentsError } = await supabase.from('assignments').select('id, bhr_id, branch_id');
      if (assignmentsError) throw assignmentsError;
      const localAllAssignments = assignmentsData || [];
      
      // Roots are the ZHRs reporting to the VHR
      const roots = zhrUsers || [];
    
      const builtInitialRoots = roots.map(rootUser => ({
        ...rootUser, // ZHR node
        children: buildTreeRecursive(relevantUsers, rootUser.id, localAllBranches, localAllAssignments)
      }));
      setInitialRootUserNodes(builtInitialRoots);

    } catch (err: any) {
      console.error("Error fetching VHR team structure:", err);
      setError(err.message || "Failed to load user hierarchy.");
      setInitialRootUserNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchDataAndBuildInitialHierarchy();
  }, [fetchDataAndBuildInitialHierarchy]);

  const filterUserTree = useCallback((nodes: UserNode[], term: string): UserNode[] => {
    if (!term.trim()) {
      return nodes;
    }
    const lowerTerm = term.toLowerCase();
    return nodes.map(node => {
      const selfMatches = 
        node.name.toLowerCase().includes(lowerTerm) ||
        node.email.toLowerCase().includes(lowerTerm) ||
        node.role.toLowerCase().includes(lowerTerm) ||
        (node.e_code && node.e_code.toLowerCase().includes(lowerTerm)) ||
        (node.location && node.location.toLowerCase().includes(lowerTerm));
      const filteredChildren = node.children ? filterUserTree(node.children, term) : [];
      if (selfMatches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    }).filter(node => node !== null) as UserNode[];
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const filtered = filterUserTree(initialRootUserNodes, debouncedSearchTerm);
      setDisplayedRootUserNodes(filtered);
    }
  }, [initialRootUserNodes, debouncedSearchTerm, isLoading, filterUserTree]);

  const pageTitle = useMemo(() => {
    let title = "Team Structure";
    if (currentUser?.name) {
      title += ` (${currentUser.name}'s Vertical)`;
    }
    return title;
  }, [currentUser?.name]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading team structure...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title={pageTitle} description="Visual representation of ZHRs and BHRs in your vertical. Search users below." />

      <Card className="shadow-md">
        <CardHeader><CardTitle className="text-lg">Search Team Members</CardTitle></CardHeader>
        <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, role, E-Code, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && displayedRootUserNodes.length === 0 && (
        <Card className="shadow-md">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                 <Search className="h-12 w-12 text-muted-foreground/70" />
                <h3 className="text-xl font-semibold">No Team Structure to Display</h3>
                <p className="text-muted-foreground max-w-md">
                {debouncedSearchTerm ? "No users match your search criteria." : 
                 "You have no direct ZHR reports, or no users were found in your vertical."
                }
                </p>
                 {searchTerm && <Button variant="outline" onClick={() => setSearchTerm('')}>Clear Search</Button>}
            </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {displayedRootUserNodes.map(node => (
          <HierarchyNode key={node.id} node={node} level={0} onShowSubmissions={handleShowSubmissions} />
        ))}
      </div>
      {selectedBhrForModal && (
        <BhrSubmissionsListModal
          bhrUser={selectedBhrForModal}
          isOpen={isSubmissionsModalOpen}
          onClose={() => {
            setIsSubmissionsModalOpen(false);
            setSelectedBhrForModal(null);
          }}
        />
      )}
    </div>
  );
}
