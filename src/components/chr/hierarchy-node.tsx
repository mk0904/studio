
'use client';

import React, { useState } from 'react';
import type { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User as UserIcon, Briefcase, Users, Shield, Building, ListChecks, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export interface UserNode extends User {
  children: UserNode[];
  assignedBranchNames?: string[];
}

interface HierarchyNodeProps {
  node: UserNode;
  level: number;
  onShowSubmissions?: (bhr: User) => void;
}

const roleIcons: Record<User['role'], React.ElementType> = {
  CHR: Shield,
  VHR: Users,
  ZHR: Briefcase,
  BHR: Building,
};

const roleBadgeStyles: Record<User['role'], string> = {
  CHR: 'bg-red-100 text-red-700 border-red-200',
  VHR: 'bg-purple-100 text-purple-700 border-purple-200',
  ZHR: 'bg-blue-100 text-blue-700 border-blue-200',
  BHR: 'bg-green-100 text-green-700 border-green-200',
};

const roleIconBgColors: Record<User['role'], string> = {
  CHR: 'bg-red-500',
  VHR: 'bg-purple-500',
  ZHR: 'bg-blue-500',
  BHR: 'bg-green-500',
};

export function HierarchyNode({ node, level, onShowSubmissions }: HierarchyNodeProps) {
  const Icon = roleIcons[node.role] || UserIcon;
  const [isExpanded, setIsExpanded] = useState(true); 

  const hasChildren = node.children && node.children.length > 0;

  const toggleExpand = (e: React.MouseEvent) => {
    // Ensure that clicks on buttons or links within the card don't trigger expand/collapse
    if (e.target !== e.currentTarget && (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a'))) {
      return;
    }
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };
  
  const handleShowSubmissionsClick = (e: React.MouseEvent, bhr: User) => {
    e.stopPropagation(); // Prevent card click from triggering
    if (onShowSubmissions) {
        onShowSubmissions(bhr);
    }
  };


  return (
    <div style={{ marginLeft: level > 0 ? `${level * 20}px` : '0px' }} className="mb-3">
      <Card 
        className={cn(
            "shadow-md hover:shadow-lg transition-shadow duration-200 border-slate-200/50 hover:border-slate-300/50",
            hasChildren && "cursor-pointer"
        )}
        onClick={toggleExpand}
      >
        <CardHeader
          className={cn(
            "flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4 border-b border-slate-100",
            hasChildren && "hover:bg-slate-50/50 transition-colors" // Header hover only if children exist
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <span className="w-4 h-4 shrink-0"></span> 
            )}
            <Icon className={cn("h-5 w-5 text-white p-0.5 rounded-md shrink-0", roleIconBgColors[node.role] || 'bg-gray-400')} />
            <CardTitle className="text-base font-semibold text-slate-800 truncate">{node.name}</CardTitle>
          </div>
          <Badge variant="secondary" className={cn("text-xs px-2 py-0.5 shrink-0", roleBadgeStyles[node.role] || 'bg-gray-100 text-gray-700 border-gray-200')}>{node.role}</Badge>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-2 text-xs text-slate-600 space-y-1.5">
          <p>Email: {node.email}</p>
          {node.e_code && <p>E-Code: {node.e_code}</p>}
          {node.location && <p>Location: {node.location}</p>}
          {node.role === 'BHR' && node.assignedBranchNames && node.assignedBranchNames.length > 0 && (
            <div className="pt-1">
              <p className="font-medium text-slate-700 mb-1">Assigned Branches:</p>
              <div className="flex flex-wrap gap-1.5">
                {node.assignedBranchNames.map(branchName => (
                  <Badge 
                    key={branchName} 
                    variant="secondary"
                    className="text-xs bg-blue-50 text-blue-700 border-blue-200/70 font-normal px-2 py-0.5"
                  >
                    {branchName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {node.role === 'BHR' && onShowSubmissions && (
             <div className="flex justify-end mt-2"> 
                <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-slate-200 shadow-sm hover:shadow"
                    onClick={(e) => handleShowSubmissionsClick(e, node)}
                >
                    <ListChecks className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Show Submissions
                </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {isExpanded && hasChildren && (
        <div className="mt-2 pl-5 border-l-2 border-slate-200/60">
          {node.children.map(childNode => (
            <HierarchyNode 
                key={childNode.id} 
                node={childNode} 
                level={level + 1} 
                onShowSubmissions={onShowSubmissions} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
