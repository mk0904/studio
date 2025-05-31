
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

export default function ZHRTeamStructurePage() {
  const { user: currentUser } = useAuth();
  const [allUsersInZone, setAllUsersInZone] = useState<User[]>([]);
  const [initialRootUserNodes, setInitialRootUserNodes] = useState<UserNode[]>([]);
  const [displayedRootUserNodes, setDisplayedRootUserNodes] = useState<UserNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const buildHierarchyTree = useCallback((usersList: User[], parentId: string | null): UserNode[] => {
    // For ZHR view, BHRs typically don't have children reporting to them in this hierarchy.
    // So, this function will likely return an empty array for BHR children.
    return usersList
      .filter(user => user.reports_to === parentId)
      .map(user => ({
        ...user,
        children: buildHierarchyTree(usersList, user.id), 
      }));
  }, []);

  const fetchDataAndBuildInitialHierarchy = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'ZHR') {
      setError("Access Denied. You must be a ZHR to view this page.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Get BHRs reporting to current ZHR
      const { data: bhrUsers, error: bhrError } = await supabase
        .from('users')
        .select('id, name, email, role, reports_to, e_code, location')
        .eq('role', 'BHR')
        .eq('reports_to', currentUser.id);
      if (bhrError) throw bhrError;
      
      setAllUsersInZone(bhrUsers || []);

      // Roots are the BHRs reporting to the ZHR
      const roots = bhrUsers || [];
    
      const builtInitialRoots = roots.map(rootUser => ({
        ...rootUser,
        children: buildHierarchyTree(bhrUsers || [], rootUser.id) // BHRs usually have no children in this context
      }));
      setInitialRootUserNodes(builtInitialRoots);

    } catch (err: any) {
      console.error("Error fetching ZHR team structure:", err);
      setError(err.message || "Failed to load user hierarchy.");
      setInitialRootUserNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, buildHierarchyTree]);

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
      // BHRs won't have children in this view, but keeping structure for consistency
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
      title += ` (${currentUser.name}'s Zone)`;
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
      <PageTitle title={pageTitle} description="Visual representation of BHRs in your zone. Search users below." />

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
                 "You have no direct BHR reports, or no users were found in your zone."
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
