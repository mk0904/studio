
'use client';

import type { User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Building, Briefcase, UserCircle, ShieldCheck, Gem, Network, MapPin, Fingerprint } from 'lucide-react'; // Added MapPin, Fingerprint

export interface UserNode extends User {
  children: UserNode[];
}

interface HierarchyNodeProps {
  node: UserNode;
}

const roleIcons: Record<User['role'], React.ElementType> = {
    CHR: ShieldCheck, 
    VHR: Gem,
    ZHR: Briefcase,
    BHR: Building,
};

export function HierarchyNode({ node }: HierarchyNodeProps) {
  const RoleIcon = roleIcons[node.role] || UserCircle;

  return (
    <div className="flex flex-col items-center p-1 m-1 relative">
      {/* Node Information */}
      <div className="border border-primary/30 rounded-lg p-3 shadow-md bg-card text-card-foreground min-w-[180px] text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <RoleIcon className="h-5 w-5 text-primary" />
          <p className="text-base font-semibold text-primary">{node.name}</p>
        </div>
        <Badge variant="secondary" className="capitalize text-xs">{node.role}</Badge>
        {node.e_code && (
          <div className="flex items-center justify-center text-xs text-muted-foreground gap-1 pt-0.5">
            <Fingerprint className="h-3 w-3" />
            <span>{node.e_code}</span>
          </div>
        )}
        {node.location && (
           <div className="flex items-center justify-center text-xs text-muted-foreground gap-1">
            <MapPin className="h-3 w-3" />
            <span>{node.location}</span>
          </div>
        )}
      </div>

      {/* Children Container */}
      {node.children && node.children.length > 0 && (
        <div className="flex flex-row justify-center items-start gap-x-4 mt-4 pt-4 relative">
           {/* Pseudo-elements for lines would be complex here without a library */}
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
