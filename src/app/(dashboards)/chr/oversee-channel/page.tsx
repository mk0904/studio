
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
import { Button } from '@/components/ui/button'; // Added import
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

        // Include the CHR if they are the one viewing - only relevant if CHR is part of displayed hierarchy
        // if (currentUser?.id) vhrAndTheirTeams.add(currentUser.id); // CHR is not displayed, so this line is not strictly needed for filtering displayable nodes

        usersToProcess = usersToProcess.filter(u => vhrAndTheirTeams.has(u.id) || u.reports_to === null || (u.role === 'CHR' && u.id === currentUser.id) );
      }
      
      // 2. Filter by Search Term (applied to all users before hierarchy building)
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
      
      // Determine the root for hierarchy display
      let displayRoots: UserNode[] = [];
      const chrUser = usersToProcess.find(u => u.role === 'CHR' && u.id === currentUser.id);

      if (selectedVhrIds.length > 0) {
        // If VHRs are selected, build trees starting from these selected VHRs (who must be in usersToProcess)
        displayRoots = usersToProcess
            .filter(u => u.role === 'VHR' && selectedVhrIds.includes(u.id))
            .map(vhr => ({
                ...vhr,
                children: buildHierarchyTree(usersToProcess, vhr.id)
            }));
      } else if (chrUser) {
        // If no VHR selected, start from CHR's direct reports
        displayRoots = buildHierarchyTree(usersToProcess, chrUser.id);
      } else {
        // Fallback: if no CHR found (e.g., searched out or data issue) and no VHRs selected,
        // try to build from any top-level users or show empty based on usersToProcess.
        // This case might indicate that the current user (CHR) was filtered out by search,
        // or a data consistency issue. For now, if CHR is not in usersToProcess, default to top-level available.
        if (!usersToProcess.find(u => u.id === currentUser.id)) {
             // CHR was filtered out, so no specific starting point relative to CHR.
             // Could display top-level users from usersToProcess or an empty state/message.
             // For now, we show what remains. If usersToProcess is empty, message will reflect that.
             displayRoots = buildHierarchyTree(usersToProcess, null); // Show all remaining top-level hierarchies
        }
      }
      setRootUserNodes(displayRoots);

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
                 (selectedVhrIds.length > 0 ? "No users found for the selected VHR vertical(s)." : 
                 "The CHR has no direct reports, or no users were found in the system.")
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
