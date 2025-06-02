
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { User, Branch, Assignment } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Search, Users as UsersIcon } from 'lucide-react'; // Renamed Users to UsersIcon to avoid conflict
import { HierarchyNode, type UserNode } from '@/components/chr/hierarchy-node';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BhrSubmissionsListModal } from '@/components/shared/bhr-submissions-list-modal';


export default function ZHRTeamStructurePage() {
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
    }, 300); // Slightly shorter debounce for better responsiveness
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const handleShowSubmissions = (bhr: User) => {
    setSelectedBhrForModal(bhr);
    setIsSubmissionsModalOpen(true);
  };

  const fetchDataAndBuildInitialHierarchy = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'ZHR') {
      setError("Access Denied. You must be a ZHR to view this page.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: bhrUsers, error: bhrError } = await supabase
        .from('users')
        .select('id, name, email, role, reports_to, e_code, location')
        .eq('role', 'BHR')
        .eq('reports_to', currentUser.id);
      if (bhrError) throw bhrError;
      
      const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name');
      if (branchesError) throw branchesError;
      const localAllBranches = branchesData || [];

      const { data: assignmentsData, error: assignmentsError } = await supabase.from('assignments').select('id, bhr_id, branch_id');
      if (assignmentsError) throw assignmentsError;
      const localAllAssignments = assignmentsData || [];

      const roots = (bhrUsers || []).map(bhrUser => {
         let currentAssignedBranchNames: string[] = [];
         const bhrAssignments = localAllAssignments.filter(a => a.bhr_id === bhrUser.id);
         currentAssignedBranchNames = bhrAssignments.map(a => {
            const branch = localAllBranches.find(b => b.id === a.branch_id);
            return branch?.name || 'Unknown Branch';
         }).sort();
        return {
          ...bhrUser,
          assignedBranchNames: currentAssignedBranchNames,
          children: [] 
        };
      });
      setInitialRootUserNodes(roots);

    } catch (err: any) {
      console.error("Error fetching ZHR team structure:", err);
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
      
      if (selfMatches) {
        return { ...node };
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
      title += ` (${currentUser.name}'s Zone)`;
    }
    return title;
  }, [currentUser?.name]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-3 text-muted-foreground">Loading team structure...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle title={pageTitle} description="Visual representation of BHRs in your zone. Search users below." />

      <Card className="shadow-md border-slate-200/50 hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800">Search Team Members</CardTitle>
            <CardDescription className="text-sm text-slate-500">Filter by name, email, role, E-Code, or location.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200"
              />
            </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="shadow-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && displayedRootUserNodes.length === 0 && (
        <Card className="shadow-md border-slate-200/50">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                 <UsersIcon className="h-12 w-12 text-slate-400" />
                <h3 className="text-xl font-semibold text-slate-700">No Team Structure to Display</h3>
                <p className="text-slate-500 max-w-md">
                {debouncedSearchTerm ? "No users match your search criteria." : 
                 "You have no direct BHR reports, or no users were found in your zone."
                }
                </p>
                 {searchTerm && <Button variant="outline" onClick={() => setSearchTerm('')}>Clear Search</Button>}
            </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {displayedRootUserNodes.map(node => (
          <HierarchyNode 
            key={node.id} 
            node={node} 
            level={0}
            onShowSubmissions={handleShowSubmissions}
          />
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
