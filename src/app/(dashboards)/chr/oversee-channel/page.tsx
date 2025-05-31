
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import type { User as UserType } from '@/types'; // Renamed to avoid conflict with component
import { Loader2, AlertCircle, Users, Network } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HierarchyNode } from '@/components/chr/hierarchy-node'; // Use the simplified node

interface HierarchicalUser extends UserType {
  children: HierarchicalUser[];
}

export default function OverseeChannelPage() {
  const { user } = useAuth();
  const [rootUserNode, setRootUserNode] = useState<HierarchicalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildHierarchy = (users: UserType[], parentId: string | null | undefined): HierarchicalUser[] => {
    return users
      .filter(u => u.reports_to === parentId)
      .map(u => ({
        ...u,
        children: buildHierarchy(users, u.id),
      }));
  };

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

      if (usersError) throw usersError;
      if (!allUsersData || allUsersData.length === 0) {
        setError("No user data found.");
        setIsLoading(false);
        return;
      }

      const chrUser = allUsersData.find(u => u.role === 'CHR');
      if (!chrUser) {
        setError("CHR user not found. Cannot display the organizational structure.");
        setIsLoading(false);
        return;
      }
      
      // Build hierarchy starting from the CHR user
      const hierarchyRoot: HierarchicalUser = {
        ...(chrUser as UserType), // Cast to UserType
        children: buildHierarchy(allUsersData as UserType[], chrUser.id),
      };
      setRootUserNode(hierarchyRoot);

    } catch (err: any) {
      console.error("Error fetching or building hierarchy:", err);
      setError(`Failed to load organizational hierarchy: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAndBuildHierarchy();
  }, [fetchAndBuildHierarchy]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageTitle title="Oversee Channel - Organizational Hierarchy" description="Loading organizational structure..." />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading hierarchy...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageTitle title="Oversee Channel - Error" description="Could not load hierarchy." />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!rootUserNode && !isLoading && !error) {
     return (
      <div className="space-y-8">
        <PageTitle title="Oversee Channel - Organizational Hierarchy" description="Organizational structure." />
         <Alert>
            <Network className="h-4 w-4" />
            <AlertTitle>No Hierarchy Data</AlertTitle>
            <AlertDescription>Unable to display organizational data. The CHR might not be set up correctly or data is missing.</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Render direct reports of CHR (rootUserNode's children)
  // The CHR node itself is not displayed as a card by default, the tree starts from its reports
  const directReports = rootUserNode?.children || [];

  return (
    <div className="space-y-8">
      <PageTitle title="Oversee Channel - Organizational Hierarchy" description="Visual representation of the reporting structure below the CHR." />
      {directReports.length > 0 ? (
        <div className="p-4 bg-card rounded-lg shadow-md">
          {directReports.map(childNode => (
            <HierarchyNode key={childNode.id} node={childNode} level={0} />
          ))}
        </div>
      ) : (
         <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>No Direct Reports</AlertTitle>
            <AlertDescription>The CHR currently has no direct reports in the system to display.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
