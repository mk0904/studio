
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Filter, ChevronsUpDown, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useChrFilter } from '@/contexts/chr-filter-context';
import { useVhrFilter } from '@/contexts/vhr-filter-context';
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
  const pathname = usePathname();

  const isChr = user?.role === 'CHR';
  const isVhr = user?.role === 'VHR';

  // CHR Filter Hook
  const chrFilterHook = isChr ? useChrFilter : () => ({
    selectedVhrIds: [], setSelectedVhrIds: () => {}, vhrOptions: [], isLoadingVhrOptions: false,
    allUsersForContext: [], isLoadingAllUsers: true,
  });
  const { 
    selectedVhrIds, setSelectedVhrIds, vhrOptions, isLoadingVhrOptions
  } = chrFilterHook();

  // VHR Filter Hook (for ZHR filter when user is VHR)
  const vhrFilterHookForZhr = isVhr ? useVhrFilter : () => ({
    selectedZhrIds: [], setSelectedZhrIds: () => {}, zhrOptions: [], isLoadingZhrOptions: false,
    allBhrsInVhrVertical: [], isLoadingBhrsInVhrVertical: true,
  });
  const {
    selectedZhrIds: vhrSelectedZhrIds, setSelectedZhrIds: setVhrSelectedZhrIds, 
    zhrOptions: vhrZhrOptions, isLoadingZhrOptions: isLoadingVhrZhrOptions
  } = vhrFilterHookForZhr();


  const handleChrVhrFilterChange = (vhrId: string) => {
    const newSelectedVhrIds = selectedVhrIds.includes(vhrId)
      ? selectedVhrIds.filter(id => id !== vhrId)
      : [...selectedVhrIds, vhrId];
    setSelectedVhrIds(newSelectedVhrIds);
  };
  
  const getChrVhrFilterButtonText = () => {
    if (isLoadingVhrOptions) return "Loading VHRs...";
    if (selectedVhrIds.length === 0) return "All VHR Verticals";
    if (selectedVhrIds.length === 1) {
      const selectedOption = vhrOptions.find(opt => opt.value === selectedVhrIds[0]);
      return selectedOption ? selectedOption.label : "1 VHR Selected";
    }
    return `${selectedVhrIds.length} VHRs Selected`;
  };

  const handleVhrZhrFilterChange = (zhrId: string) => {
    const newSelectedZhrIds = vhrSelectedZhrIds.includes(zhrId)
      ? vhrSelectedZhrIds.filter(id => id !== zhrId)
      : [...vhrSelectedZhrIds, zhrId];
    setVhrSelectedZhrIds(newSelectedZhrIds);
  };

  const getVhrZhrFilterButtonText = () => {
    if (isLoadingVhrZhrOptions) return "Loading ZHRs...";
    if (vhrSelectedZhrIds.length === 0) return "All ZHRs in Vertical";
    if (vhrSelectedZhrIds.length === 1) {
      const selectedOption = vhrZhrOptions.find(opt => opt.value === vhrSelectedZhrIds[0]);
      return selectedOption ? selectedOption.label : "1 ZHR Selected";
    }
    return `${vhrSelectedZhrIds.length} ZHRs Selected`;
  };

  const showGlobalChrVhrFilter = isChr && 
    pathname !== '/chr/oversee-channel' && 
    pathname !== '/account' &&
    pathname !== '/chr/export-data'; // Added /chr/export-data here

  const showGlobalVhrZhrFilter = isVhr && pathname !== '/account' && pathname !== '/vhr/team-structure';

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
      </div>
      <div className="flex items-center gap-x-2">
        {/* CHR's VHR Filter */}
        {showGlobalChrVhrFilter && (
          <div className="relative flex items-center">
            <Filter className="h-4 w-4 text-muted-foreground mr-1" />
            {isLoadingVhrOptions ? (
              <Skeleton className="h-9 w-40 rounded-md" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-auto min-w-[150px] h-9 bg-background/70 border-border text-sm justify-between pr-8">
                    {getChrVhrFilterButtonText()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-popover text-popover-foreground border-border max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by VHR Vertical</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {vhrOptions.length > 0 ? (
                    vhrOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={selectedVhrIds.includes(option.value)}
                        onCheckedChange={() => handleChrVhrFilterChange(option.value)}
                        className="text-sm"
                        onSelect={(e) => e.preventDefault()} 
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
            {selectedVhrIds.length > 0 && !isLoadingVhrOptions && (
              <Button variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedVhrIds([]); }} aria-label="Clear VHR filter">
                <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            )}
          </div>
        )}
        
        {/* VHR's ZHR Filter */}
        {showGlobalVhrZhrFilter && (
          <div className="relative flex items-center">
            <Filter className="h-4 w-4 text-muted-foreground mr-1" />
            {isLoadingVhrZhrOptions ? (
              <Skeleton className="h-9 w-40 rounded-md" />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-auto min-w-[150px] h-9 bg-background/70 border-border text-sm justify-between pr-8">
                    {getVhrZhrFilterButtonText()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-popover text-popover-foreground border-border max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by ZHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {vhrZhrOptions.length > 0 ? (
                    vhrZhrOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={vhrSelectedZhrIds.includes(option.value)}
                        onCheckedChange={() => handleVhrZhrFilterChange(option.value)}
                        className="text-sm"
                        onSelect={(e) => e.preventDefault()}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No ZHRs in your vertical.</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {vhrSelectedZhrIds.length > 0 && !isLoadingVhrZhrOptions && (
              <Button variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setVhrSelectedZhrIds([]); }} aria-label="Clear ZHR filter">
                <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
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
