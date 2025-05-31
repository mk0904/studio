
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { Loader2, AlertCircle, Users, Network } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HierarchyNode, type UserNode } from '@/components/chr/hierarchy-node';

export default function OverseeChannelPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rootUserNode, setRootUserNode] = useState<UserNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAndBuildHierarchy = useCallback(async () => {
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
        setRootUserNode(null);
        setIsLoading(false);
        return;
      }

      const usersMap: Map<string, UserNode> = new Map();
      const allUsersTyped = allUsersData as User[];

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
          roots.push(node);
        }
      });
      
      usersMap.forEach(node => {
          node.children.sort((a, b) => a.name.localeCompare(b.name));
      });
      roots.sort((a, b) => a.name.localeCompare(b.name));
      
      const chrNode = roots.find(r => r.role === 'CHR');
      
      if (chrNode) {
        setRootUserNode(chrNode);
      } else {
        setError("CHR user not found. Cannot display the organizational structure starting from CHR.");
        setRootUserNode(null);
      }

    } catch (err: any) {
      console.error("Error fetching or building hierarchy:", err);
      setError(`Failed to load organizational hierarchy: ${err.message}`);
      setRootUserNode(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAndBuildHierarchy();
  }, [fetchAndBuildHierarchy]);

  if (!user && !isLoading) {
     return <PageTitle title="Access Denied" description="Please log in to view this page." />;
  }

  if (user && user.role !== 'CHR' && !isLoading) {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }
  
  const directReportsOfChr = rootUserNode && rootUserNode.role === 'CHR' ? rootUserNode.children : [];

  return (
    <div className="space-y-8">
      <PageTitle title="Oversee Channel - Organizational Hierarchy" description="Visual representation of the reporting structure. Scroll horizontally if the tree is wide." />

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

      {!isLoading && !error && !rootUserNode && (
         <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Hierarchy Data</AlertTitle>
            <AlertDescription>Unable to load organizational data. Ensure users and reporting structures are correctly configured.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && rootUserNode && rootUserNode.role === 'CHR' && (
        directReportsOfChr.length > 0 ? (
          <div className="overflow-x-auto py-4 -mx-4 px-4">
            <div className="flex flex-row items-start justify-center gap-x-8 p-4 min-w-max">
              {directReportsOfChr.map(childNode => (
                <HierarchyNode key={childNode.id} node={childNode} />
              ))}
            </div>
          </div>
        ) : (
          <Alert variant="default">
            <Users className="h-4 w-4" />
            <AlertTitle>No Direct Reports</AlertTitle>
            <AlertDescription>The CHR currently has no direct reports in the system.</AlertDescription>
          </Alert>
        )
      )}
      
      {!isLoading && !error && rootUserNode && rootUserNode.role !== 'CHR' && (
        <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Hierarchy View Issue</AlertTitle>
            <AlertDescription>
                Could not display hierarchy starting from CHR. Displaying top-level users found.
            </AlertDescription>
            <div className="mt-4 space-y-2 overflow-x-auto py-4">
                 <div className="flex flex-row items-start justify-center gap-x-8 p-4 min-w-max">
                    <HierarchyNode node={rootUserNode} />
                 </div>
            </div>
        </Alert>
      )}
    </div>
  );
}
