
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HierarchyNode, type UserNode } from '@/components/chr/hierarchy-node';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function OverseeChannelPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [rootDisplayNode, setRootDisplayNode] = useState<UserNode | null>(null);
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
        setRootDisplayNode(null);
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

      // Find the CHR node, or default to the first root if no CHR is found (or for flatter hierarchies)
      const chrNode = roots.find(r => r.role === 'CHR') || (roots.length > 0 ? roots[0] : null);
      setRootDisplayNode(chrNode);

    } catch (err: any) {
      console.error("Error fetching or building hierarchy:", err);
      setError(`Failed to load organizational hierarchy: ${err.message}`);
      setRootDisplayNode(null);
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

  const vhrNodes = rootDisplayNode ? rootDisplayNode.children.filter(child => child.role === 'VHR') : [];

  return (
    <div className="space-y-8">
      <PageTitle title="Oversee Channel - Organizational Hierarchy" description="View the reporting structure of users. CHR at the top, with VHR verticals below." />

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

      {!isLoading && !error && !rootDisplayNode && (
         <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Hierarchy Data</AlertTitle>
            <AlertDescription>No CHR or top-level users found, or unable to build hierarchy. Ensure users are present in the system with correct 'reports_to' linkage.</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && rootDisplayNode && (
        <div className="space-y-10">
          {/* CHR Node Section */}
          <div className="flex justify-center">
            <div className="w-full md:w-1/2 lg:w-1/3"> {/* Adjust width as needed */}
              <Card className="border-2 border-primary shadow-xl">
                <CardHeader className="py-3 px-4 bg-primary/10">
                   <CardTitle className="text-center text-primary text-lg">{rootDisplayNode.role} Level</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                    <HierarchyNode node={rootDisplayNode} level={0} isRootChr={true} />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* VHR Verticals Section */}
          {vhrNodes.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-center mb-6 text-foreground">VHR Verticals</h2>
              <div className="flex flex-col md:flex-row md:flex-wrap gap-6 justify-around items-start">
                {vhrNodes.map(vhrNode => (
                  <Card key={vhrNode.id} className="w-full md:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-1.5rem)] shadow-lg border-muted-foreground/30">
                    <CardHeader className="py-3 px-4 bg-muted/50">
                       <CardTitle className="text-center text-foreground text-md">Vertical: {vhrNode.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      {/* Display VHR as the head of this vertical's tree */}
                      <HierarchyNode node={vhrNode} level={0} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {vhrNodes.length === 0 && rootDisplayNode.children.length > 0 && (
             <Alert variant="default" className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No VHRs Found Directly Under CHR</AlertTitle>
                <AlertDescription>The CHR has direct reports, but none are identified with the 'VHR' role. Displaying all direct reports below:</AlertDescription>
                <div className="mt-4 space-y-2">
                    {rootDisplayNode.children.map(childNode => (
                         <HierarchyNode key={childNode.id} node={childNode} level={0} />
                    ))}
                </div>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

