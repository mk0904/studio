
'use client';

import type { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Briefcase, MapPin, UserCircle } from 'lucide-react'; // Added icons

export interface UserNode extends User {
  children: UserNode[];
}

interface HierarchyNodeProps {
  node: UserNode;
  level: number;
}

const roleIcons: Record<User['role'], React.ElementType> = {
    CHR: UserCircle, 
    VHR: Briefcase,
    ZHR: Building,
    BHR: MapPin,
};


export function HierarchyNode({ node, level }: HierarchyNodeProps) {
  const RoleIcon = roleIcons[node.role] || UserCircle;

  return (
    <div style={{ marginLeft: `${level * 24}px` }} className="my-1.5">
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 ease-in-out bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4">
          <div className="flex items-center gap-2">
            <RoleIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-card-foreground">{node.name}</CardTitle>
          </div>
          <Badge 
            variant={node.role === 'CHR' ? 'default' : (node.role === 'VHR' ? 'secondary' : 'outline')} 
            className="text-xs capitalize px-2 py-0.5"
          >
            {node.role}
          </Badge>
        </CardHeader>
        {(node.e_code || node.location) && (
            <CardContent className="pb-3 px-4 pt-0 text-xs text-muted-foreground space-y-0.5">
                {node.e_code && <p>E-Code: {node.e_code}</p>}
                {node.location && <p>Location: {node.location}</p>}
            </CardContent>
        )}
      </Card>
      {node.children && node.children.length > 0 && (
        <div className={`mt-1.5 pl-3 border-l-2 ${level % 2 === 0 ? 'border-primary/30' : 'border-accent/30'}`}>
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
