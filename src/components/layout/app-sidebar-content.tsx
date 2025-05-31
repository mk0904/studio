
'use client';

import React from 'react';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarUserItem } from './sidebar-user-item';
import { useAuth } from '@/contexts/auth-context';
import { useChrFilter } from '@/contexts/chr-filter-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter } from 'lucide-react';

export function AppSidebarContent() {
  const { user } = useAuth();
  
  // Conditionally useChrFilter only if user is CHR to avoid errors if context is not provided for other roles
  const chrFilterContextHook = user?.role === 'CHR' ? useChrFilter : () => ({
    selectedVhrId: 'all',
    setSelectedVhrId: () => {},
    vhrOptions: [{ value: 'all', label: 'All VHR Verticals' }],
    isLoadingVhrOptions: false,
  });
  const { selectedVhrId, setSelectedVhrId, vhrOptions, isLoadingVhrOptions } = chrFilterContextHook();


  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarSeparator />
      
      {user?.role === 'CHR' && (
        <>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 pt-2 pb-0">
            <SidebarGroupLabel className="flex items-center gap-2 px-0 mb-1">
              <Filter className="h-3.5 w-3.5" />
              VHR Vertical Filter
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-0">
              {isLoadingVhrOptions ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedVhrId} onValueChange={setSelectedVhrId} disabled={vhrOptions.length <=1}>
                  <SelectTrigger className="w-full bg-sidebar-background text-sidebar-foreground border-sidebar-border focus:ring-sidebar-ring">
                    <SelectValue placeholder="Select VHR Vertical" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border">
                    {vhrOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
        </>
      )}

      <SidebarContent>
        <SidebarNavigation />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarUserItem />
      </SidebarFooter>
    </>
  );
}
