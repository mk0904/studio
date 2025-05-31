
'use client';

import React from 'react';
import type { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User as UserIcon, Briefcase, Users, Shield, Building, Info } from 'lucide-react';
import { Button } from '../ui/button';

export interface UserNode extends User {
  children: UserNode[];
  assignedBranchNames?: string[];
}

interface HierarchyNodeProps {
  node: UserNode;
  level: number;
  // onShowSubmissions prop removed
}

const roleIcons: Record<User['role'], React.ElementType> = {
  CHR: Shield,
  VHR: Users,
  ZHR: Briefcase,
  BHR: Building,
};

const roleColors: Record<User['role'], string> = {
  CHR: 'bg-red-500 hover:bg-red-600',
  VHR: 'bg-purple-500 hover:bg-purple-600',
  ZHR: 'bg-blue-500 hover:bg-blue-600',
  BHR: 'bg-green-500 hover:bg-green-600',
};

export function HierarchyNode({ node, level }: HierarchyNodeProps) {
  const Icon = roleIcons[node.role] || UserIcon;

  return (
    <div style={{ marginLeft: level > 0 ? `${level * 20}px` : '0px' }} className="mb-3">
      <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 text-white p-0.5 rounded-sm ${roleColors[node.role] || 'bg-gray-400'}`} />
            <CardTitle className="text-base font-semibold leading-tight">{node.name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">{node.role}</Badge>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-1 text-xs text-muted-foreground space-y-0.5">
          <p>Email: {node.email}</p>
          {node.e_code && <p>E-Code: {node.e_code}</p>}
          {node.location && <p>Location: {node.location}</p>}
          {node.role === 'BHR' && node.assignedBranchNames && node.assignedBranchNames.length > 0 && (
            <div className="pt-1">
              <p className="font-medium text-foreground/90 mb-0.5">Assigned Branches:</p>
              <div className="flex flex-wrap gap-1">
                {node.assignedBranchNames.map(branchName => (
                  <Badge key={branchName} variant="secondary" className="text-xs">{branchName}</Badge>
                ))}
              </div>
            </div>
          )}
          {/* "Show Submissions" button removed */}
        </CardContent>
      </Card>
      {node.children && node.children.length > 0 && (
        <div className="mt-2 pl-5 border-l-2 border-border/70">
          {node.children.map(childNode => (
            <HierarchyNode key={childNode.id} node={childNode} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
