
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HierarchyNode, type UserNode } from '@/components/chr/hierarchy-node';
import { AlertCircle } from 'lucide-react';

export default function OverseeChannelPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hierarchy, setHierarchy] = useState<UserNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndBuildHierarchy = async () => {
      if (!user || user.role !== 'CHR') {
        setError("Access denied. This page is for CHR users only.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);

      try {
        const { data: allUsersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, email, role, reports_to, e_code, location');

        if (usersError) {
          throw usersError;
        }

        if (!allUsersData || allUsersData.length === 0) {
          setHierarchy([]);
          setIsLoading(false);
          return;
        }

        const usersMap: Map<string, UserNode> = new Map();
        const allUsersTyped = allUsersData as User[];

        // Initialize map with UserNode structure
        allUsersTyped.forEach(u => {
          usersMap.set(u.id, { ...u, children: [] });
        });

        const roots: UserNode[] = [];
        allUsersTyped.forEach(u => {
          const node = usersMap.get(u.id)!;
          if (u.reports_to && usersMap.has(u.reports_to)) {
            const parentNode = usersMap.get(u.reports_to)!;
            parentNode.children.push(node);
          } else {
            // If no reports_to or parent not in map (e.g. CHR), it's a root
            roots.push(node);
          }
        });
        
        // Sort children alphabetically by name for consistent display
        usersMap.forEach(node => {
            node.children.sort((a, b) => a.name.localeCompare(b.name));
        });
        roots.sort((a, b) => a.name.localeCompare(b.name));


        setHierarchy(roots);

      } catch (err: any) {
        console.error("Error fetching or building hierarchy:", err);
        setError(`Failed to load organizational hierarchy: ${err.message}`);
        setHierarchy([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndBuildHierarchy();
  }, [user]);

  if (!user && !isLoading) {
     return <PageTitle title="Access Denied" description="Please log in to view this page." />;
  }

  if (user && user.role !== 'CHR' && !isLoading) {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Oversee Channel - Organizational Hierarchy" description="View the reporting structure of all users in the system." />

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading hierarchy...</p>
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && hierarchy.length === 0 && (
         <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Hierarchy Data</AlertTitle>
            <AlertDescription>No users found or unable to build hierarchy. Ensure users are present in the system.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && hierarchy.length > 0 && (
        <div className="space-y-2">
          {hierarchy.map(rootNode => (
            <HierarchyNode key={rootNode.id} node={rootNode} level={0} />
          ))}
        </div>
      )}
    </div>
  );
}
