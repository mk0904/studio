
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { Loader2, AlertCircle, Users, Network } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HierarchyNode, type UserNode } from '@/components/chr/hierarchy-node';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function OverseeChannelPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rootUserNode, setRootUserNode] = useState<UserNode | null>(null); // Renamed for clarity
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
          roots.push(node); // These are top-level nodes (e.g., CHR or users with no manager set)
        }
      });
      
      // Sort children alphabetically by name at each level
      usersMap.forEach(node => {
          node.children.sort((a, b) => a.name.localeCompare(b.name));
      });
      // Sort roots alphabetically by name as well
      roots.sort((a, b) => a.name.localeCompare(b.name));
      
      // Find the CHR node specifically to act as the root of the hierarchy to display
      const chrNode = roots.find(r => r.role === 'CHR');
      
      if (chrNode) {
        setRootUserNode(chrNode);
      } else {
        // If no CHR node is found (e.g. in a flatter structure or if CHR has no 'reports_to' set to null/undefined)
        // For now, we'll indicate no CHR found if we expect one.
        // Or, if the intent is to show ANY hierarchy, we could use roots[0] but that might be confusing.
        // Let's assume we expect a CHR as the top.
        setError("CHR user not found in the hierarchy. Cannot display the organizational structure starting from CHR.");
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
      <PageTitle title="Oversee Channel - Organizational Hierarchy" description="View the reporting structure of users directly under the CHR." />

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
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Network className="h-6 w-6 text-primary" />
                Direct Reports to CHR
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pl-4 pr-4 pb-4">
              {directReportsOfChr.map(childNode => (
                <HierarchyNode key={childNode.id} node={childNode} level={0} />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Alert variant="default">
            <Users className="h-4 w-4" />
            <AlertTitle>No Direct Reports</AlertTitle>
            <AlertDescription>The CHR currently has no direct reports in the system.</AlertDescription>
          </Alert>
        )
      )}
      
      {!isLoading && !error && rootUserNode && rootUserNode.role !== 'CHR' && (
        // This case might occur if a CHR user is not found but other roots exist
        <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Hierarchy View Issue</AlertTitle>
            <AlertDescription>
                Could not display hierarchy starting from CHR. Displaying top-level users found.
            </AlertDescription>
            <div className="mt-4 space-y-2">
                <HierarchyNode node={rootUserNode} level={0} />
            </div>
        </Alert>
      )}
    </div>
  );
}
