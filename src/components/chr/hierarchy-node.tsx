
'use client';

import type { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Briefcase, MapPin, UserCircle, ShieldCheck, Gem } from 'lucide-react'; // Added more icons

export interface UserNode extends User {
  children: UserNode[];
}

interface HierarchyNodeProps {
  node: UserNode;
  level: number;
  isRootChr?: boolean; // Optional prop to identify the top CHR node
}

const roleIcons: Record<User['role'], React.ElementType> = {
    CHR: ShieldCheck, 
    VHR: Gem, // Changed to Gem for VHR
    ZHR: Briefcase, // Changed to Briefcase for ZHR
    BHR: Building, // Changed to Building for BHR
};


export function HierarchyNode({ node, level, isRootChr = false }: HierarchyNodeProps) {
  const RoleIcon = roleIcons[node.role] || UserCircle;

  return (
    <div style={{ marginLeft: isRootChr ? `0px` : `${level * 16}px` }} className={`my-1.5 ${isRootChr ? '' : 'pl-3 border-l-2'} ${level % 2 === 0 ? 'border-primary/30' : 'border-accent/30'}`}>
      <Card className={`shadow-sm hover:shadow-md transition-shadow duration-200 ease-in-out ${isRootChr ? 'bg-card' : 'bg-background/50'}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2.5 px-3">
          <div className="flex items-center gap-2">
            <RoleIcon className={`h-4 w-4 ${isRootChr ? 'text-primary' : 'text-muted-foreground'}`} />
            <CardTitle className={`text-xs font-semibold ${isRootChr ? 'text-primary' : 'text-card-foreground'}`}>{node.name}</CardTitle>
          </div>
          <Badge 
            variant={node.role === 'CHR' ? 'default' : (node.role === 'VHR' ? 'secondary' : 'outline')} 
            className={`text-xs capitalize px-1.5 py-0.5 ${isRootChr ? 'bg-primary/20 text-primary-foreground border-primary' : ''}`}
          >
            {node.role}
          </Badge>
        </CardHeader>
        {(node.e_code || node.location) && !isRootChr && ( // Don't show these details for the main CHR card in this component if handled by page
            <CardContent className="pb-2 px-3 pt-0 text-xs text-muted-foreground space-y-0.5">
                {node.e_code && <p>E-Code: {node.e_code}</p>}
                {node.location && <p>Location: {node.location}</p>}
            </CardContent>
        )}
      </Card>
      {node.children && node.children.length > 0 && !isRootChr && ( // Don't render children here if it's the root CHR, page will handle VHR layout
        <div className={`mt-1.5`}>
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

