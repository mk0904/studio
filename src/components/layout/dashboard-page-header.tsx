
'use client';

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Filter, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useChrFilter } from '@/contexts/chr-filter-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardPageHeader() {
  const { user, logout } = useAuth();
  
  const chrFilterHook = user?.role === 'CHR' ? useChrFilter : () => ({
    selectedVhrIds: [],
    setSelectedVhrIds: () => {},
    vhrOptions: [],
    isLoadingVhrOptions: false,
  });
  const { selectedVhrIds, setSelectedVhrIds, vhrOptions, isLoadingVhrOptions } = chrFilterHook();

  const handleVhrFilterChange = (vhrId: string) => {
    const newSelectedVhrIds = selectedVhrIds.includes(vhrId)
      ? selectedVhrIds.filter(id => id !== vhrId)
      : [...selectedVhrIds, vhrId];
    setSelectedVhrIds(newSelectedVhrIds);
    console.log('DashboardPageHeader: VHR Filter changed to:', newSelectedVhrIds);
  };

  const getFilterButtonText = () => {
    if (isLoadingVhrOptions) return "Loading VHRs...";
    if (selectedVhrIds.length === 0) return "All VHR Verticals";
    if (selectedVhrIds.length === 1) {
      const selectedOption = vhrOptions.find(opt => opt.value === selectedVhrIds[0]);
      return selectedOption ? selectedOption.label : "1 VHR Selected";
    }
    return `${selectedVhrIds.length} VHRs Selected`;
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
      </div>
      <div className="flex items-center gap-4">
        {user?.role === 'CHR' && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {isLoadingVhrOptions ? (
              <Skeleton className="h-9 w-48 rounded-md" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-auto min-w-[180px] h-9 bg-background/70 border-border text-sm justify-between">
                    {getFilterButtonText()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-popover text-popover-foreground border-border">
                  <DropdownMenuLabel>Filter by VHR Vertical</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {vhrOptions.length > 0 ? (
                    vhrOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedVhrIds.includes(option.value)}
                        onCheckedChange={() => handleVhrFilterChange(option.value)}
                        className="text-sm"
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No VHRs available</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        {user && (
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        )}
      </div>
    </header>
  );
}
