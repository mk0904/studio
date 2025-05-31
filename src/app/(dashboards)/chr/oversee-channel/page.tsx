
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import type { User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Search } from 'lucide-react';
import { HierarchyNode, type UserNode } from '@/components/chr/hierarchy-node';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChrFilter } from '@/contexts/chr-filter-context';

export default function OverseeChannelPage() {
  const { user: currentUser } = useAuth();
  const { selectedVhrIds } = useChrFilter();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [rootUserNodes, setRootUserNodes] = useState<UserNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const buildHierarchyTree = useCallback((usersList: User[], parentId: string | null = null): UserNode[] => {
    return usersList
      .filter(user => user.reports_to === parentId)
      .map(user => ({
        ...user,
        children: buildHierarchyTree(usersList, user.id),
      }));
  }, []);

  const fetchDataAndBuildHierarchy = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'CHR') {
      setError("Access Denied. You must be a CHR to view this page.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: fetchedUsers, error: fetchError } = await supabase
        .from('users')
        .select('id, name, email, role, reports_to, e_code, location');

      if (fetchError) {
        throw fetchError;
      }
      setAllUsers(fetchedUsers || []);

      let usersToProcess = fetchedUsers || [];

      // 1. Filter by Global VHR (selectedVhrIds from context)
      if (selectedVhrIds.length > 0) {
        const vhrAndTheirTeams = new Set<string>();
        selectedVhrIds.forEach(vhrId => vhrAndTheirTeams.add(vhrId));

        const zhrsInSelectedVhrs = usersToProcess.filter(u => u.role === 'ZHR' && u.reports_to && selectedVhrIds.includes(u.reports_to)).map(z => z.id);
        zhrsInSelectedVhrs.forEach(zhrId => vhrAndTheirTeams.add(zhrId));
        
        const bhrsInSelectedVhrs = usersToProcess.filter(u => u.role === 'BHR' && u.reports_to && zhrsInSelectedVhrs.includes(u.reports_to)).map(b => b.id);
        bhrsInSelectedVhrs.forEach(bhrId => vhrAndTheirTeams.add(bhrId));

        // Include the CHR if they are the one viewing
        if (currentUser?.id) vhrAndTheirTeams.add(currentUser.id);

        usersToProcess = usersToProcess.filter(u => vhrAndTheirTeams.has(u.id));
      }
      
      // 2. Filter by Search Term
      const lowerSearchTerm = searchTerm.toLowerCase();
      if (lowerSearchTerm) {
        usersToProcess = usersToProcess.filter(u =>
          u.name.toLowerCase().includes(lowerSearchTerm) ||
          u.email.toLowerCase().includes(lowerSearchTerm) ||
          u.role.toLowerCase().includes(lowerSearchTerm) ||
          (u.e_code && u.e_code.toLowerCase().includes(lowerSearchTerm)) ||
          (u.location && u.location.toLowerCase().includes(lowerSearchTerm))
        );
      }
      
      const chrUser = usersToProcess.find(u => u.role === 'CHR');
      
      if (chrUser) {
        const hierarchy = buildHierarchyTree(usersToProcess, chrUser.id);
        setRootUserNodes(hierarchy);
      } else if (selectedVhrIds.length > 0) {
        // If VHRs are selected, and CHR is filtered out (or not present in usersToProcess post-search)
        // build tree starting from selected VHRs
        const vhrNodes = usersToProcess
            .filter(u => u.role === 'VHR' && selectedVhrIds.includes(u.id))
            .map(vhr => ({
                ...vhr,
                children: buildHierarchyTree(usersToProcess, vhr.id)
            }));
        setRootUserNodes(vhrNodes);
      } else {
        // If no CHR found and no VHRs selected (e.g. CHR searched out, or data issue)
        // Attempt to build from any top-level (no reports_to) users as a fallback, or show empty.
         const topLevelNodes = buildHierarchyTree(usersToProcess, null);
         setRootUserNodes(topLevelNodes);
         if (topLevelNodes.length === 0 && usersToProcess.length > 0) {
            // This case means users exist but no clear hierarchy root (CHR or top-level) was found after filtering
            // Potentially show a message or just the usersToProcess as a flat list if desired,
            // for now, an empty tree will result if no CHR with children is found and no VHRs selected
         }
      }

    } catch (err: any) {
      console.error("Error fetching or building hierarchy:", err);
      setError(err.message || "Failed to load user hierarchy.");
      setRootUserNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, buildHierarchyTree, searchTerm, selectedVhrIds]);

  useEffect(() => {
    fetchDataAndBuildHierarchy();
  }, [fetchDataAndBuildHierarchy]);

  const pageTitle = useMemo(() => {
    if (selectedVhrIds.length === 0) return "Oversee Channel (Global)";
    if (selectedVhrIds.length === 1 && allUsers.length > 0) {
      const vhr = allUsers.find(u => u.id === selectedVhrIds[0]);
      return `Oversee Channel (${vhr?.name || 'Selected VHR'})`;
    }
    return `Oversee Channel (${selectedVhrIds.length} VHRs)`;
  }, [selectedVhrIds, allUsers]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading user hierarchy...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title={pageTitle} description="Visual representation of the organizational reporting structure. Search users below." />

      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="text-lg">Search Users</CardTitle>
        </CardHeader>
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

      {!isLoading && !error && rootUserNodes.length === 0 && (
        <Card className="shadow-md">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                 <Search className="h-12 w-12 text-muted-foreground/70" />
                <h3 className="text-xl font-semibold">No Hierarchy to Display</h3>
                <p className="text-muted-foreground max-w-md">
                {searchTerm ? "No users match your search criteria within the selected VHR vertical(s)." : 
                 (selectedVhrIds.length > 0 ? "No users found for the selected VHR vertical(s), or the CHR has no direct reports in this selection." : 
                 "The CHR has no direct reports, or no users were found.")
                }
                </p>
                 {searchTerm && <Button variant="outline" onClick={() => setSearchTerm('')}>Clear Search</Button>}
            </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rootUserNodes.map(node => (
          <HierarchyNode key={node.id} node={node} level={0} />
        ))}
      </div>
    </div>
  );
}
