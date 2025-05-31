
'use client';

import type { User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Briefcase, UserCircle, ShieldCheck, Gem, Network, MapPin, Fingerprint } from 'lucide-react';

interface HierarchicalUserNode extends User {
  children: HierarchicalUserNode[];
}

interface HierarchyNodeProps {
  node: HierarchicalUserNode;
  level: number;
}

const roleIcons: Record<User['role'], React.ElementType> = {
    CHR: ShieldCheck,
    VHR: Gem,
    ZHR: Briefcase,
    BHR: Building,
};

export function HierarchyNode({ node, level }: HierarchyNodeProps) {
  const RoleIcon = roleIcons[node.role] || UserCircle;
  const indentClass = `ml-${level * 6}`; // Tailwind class for indentation (ml-0, ml-6, ml-12, etc.)

  return (
    <div className={`my-2 ${indentClass}`}>
      <Card className="shadow-md border-primary/30 hover:shadow-lg transition-shadow bg-card text-card-foreground">
        <CardHeader className="flex flex-row items-center justify-between p-3 border-b border-primary/10">
          <div className="flex items-center gap-1.5">
            <RoleIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold text-primary">{node.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="capitalize text-xs">{node.role}</Badge>
        </CardHeader>
        <CardContent className="p-3 text-xs space-y-1">
          {node.e_code && (
            <div className="flex items-center text-muted-foreground gap-1">
              <Fingerprint className="h-3.5 w-3.5" />
              <span>{node.e_code}</span>
            </div>
          )}
          {node.location && (
             <div className="flex items-center text-muted-foreground gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{node.location}</span>
            </div>
          )}
        </CardContent>
      </Card>
      {node.children && node.children.length > 0 && (
        <div className="mt-1">
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
