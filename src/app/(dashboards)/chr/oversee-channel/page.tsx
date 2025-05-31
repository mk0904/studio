
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
import { Button } from '@/components/ui/button';
import { useChrFilter } from '@/contexts/chr-filter-context';

export default function OverseeChannelPage() {
  const { user: currentUser } = useAuth();
  const { selectedVhrIds } = useChrFilter();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [initialRootUserNodes, setInitialRootUserNodes] = useState<UserNode[]>([]);
  const [displayedRootUserNodes, setDisplayedRootUserNodes] = useState<UserNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  const buildHierarchyTree = useCallback((usersList: User[], parentId: string | null): UserNode[] => {
    return usersList
      .filter(user => user.reports_to === parentId)
      .map(user => ({
        ...user,
        children: buildHierarchyTree(usersList, user.id),
      }));
  }, []);

  const fetchDataAndBuildInitialHierarchy = useCallback(async () => {
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

      if (fetchError) throw fetchError;
      setAllUsers(fetchedUsers || []);

      let roots: User[] = [];
      if (selectedVhrIds.length > 0) {
        // If VHRs are selected, they are the roots
        roots = (fetchedUsers || []).filter(u => selectedVhrIds.includes(u.id) && u.role === 'VHR');
      } else {
        // Otherwise, CHR's direct reports are roots
        const chrUser = (fetchedUsers || []).find(u => u.id === currentUser.id && u.role === 'CHR');
        if (chrUser) {
          roots = (fetchedUsers || []).filter(u => u.reports_to === chrUser.id);
        }
      }
      
      const builtInitialRoots = roots.map(rootUser => ({
        ...rootUser,
        children: buildHierarchyTree(fetchedUsers || [], rootUser.id)
      }));
      setInitialRootUserNodes(builtInitialRoots);

    } catch (err: any) {
      console.error("Error fetching or building hierarchy:", err);
      setError(err.message || "Failed to load user hierarchy.");
      setInitialRootUserNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, selectedVhrIds, buildHierarchyTree]);

  useEffect(() => {
    fetchDataAndBuildInitialHierarchy();
  }, [fetchDataAndBuildInitialHierarchy]);


  const filterUserTree = useCallback((nodes: UserNode[], term: string): UserNode[] => {
    if (!term.trim()) {
      return nodes; // Return all nodes if search term is empty
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

      {!isLoading && !error && displayedRootUserNodes.length === 0 && (
        <Card className="shadow-md">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                 <Search className="h-12 w-12 text-muted-foreground/70" />
                <h3 className="text-xl font-semibold">No Hierarchy to Display</h3>
                <p className="text-muted-foreground max-w-md">
                {debouncedSearchTerm ? "No users match your search criteria within the selected VHR vertical(s)." : 
                 (selectedVhrIds.length > 0 ? "No users found for the selected VHR vertical(s), or they have no direct reports." : 
                 "The CHR has no direct reports, or no users were found in the system.")
                }
                </p>
                 {searchTerm && <Button variant="outline" onClick={() => setSearchTerm('')}>Clear Search</Button>}
            </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {displayedRootUserNodes.map(node => (
          <HierarchyNode key={node.id} node={node} level={0} />
        ))}
      </div>
    </div>
  );
}
