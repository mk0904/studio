'use client';

import React from 'react';
import { useVhrFilter } from '@/contexts/vhr-filter-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, ChevronsUpDown, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ZhrFilterDropdown() {
  const {
    selectedZhrIds,
    setSelectedZhrIds,
    zhrOptions,
    isLoadingZhrOptions,
  } = useVhrFilter();

  const handleZhrFilterChange = (zhrId: string) => {
    const newSelectedZhrIds = selectedZhrIds.includes(zhrId)
      ? selectedZhrIds.filter(id => id !== zhrId)
      : [...selectedZhrIds, zhrId];
    setSelectedZhrIds(newSelectedZhrIds);
  };

  const getZhrFilterButtonText = () => {
    if (isLoadingZhrOptions) return "Loading ZHRs...";
    if (selectedZhrIds.length === 0) return "All ZHRs in Vertical";
    if (selectedZhrIds.length === 1) {
      const selectedOption = zhrOptions.find(opt => opt.value === selectedZhrIds[0]);
      return selectedOption ? selectedOption.label : "1 ZHR Selected";
    }
    return `${selectedZhrIds.length} ZHRs Selected`;
  };

  return (
    <div className="relative flex items-center w-full sm:w-auto justify-end">
      {isLoadingZhrOptions ? (
        <Skeleton className="h-9 w-40 rounded-lg" />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-auto min-w-[150px] h-10 rounded-lg border border-slate-200/70 shadow-sm focus:ring-2 focus:ring-blue-200 bg-background/70 text-sm justify-between pr-8 transition-all flex items-center"
            >
              <Filter className="h-5 w-5 text-blue-600 mr-2" />
              <span className="flex-1 text-center">{getZhrFilterButtonText()}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] bg-white text-popover-foreground border border-slate-200 shadow-lg rounded-xl max-h-72 overflow-y-auto right-0 ml-auto">
            <DropdownMenuLabel>Filter by ZHR</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {zhrOptions.length > 0 ? (
              zhrOptions.map(option => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={selectedZhrIds.includes(option.value)}
                  onCheckedChange={() => handleZhrFilterChange(option.value)}
                  className="text-sm font-medium hover:bg-blue-50 hover:text-blue-700 rounded transition-colors"
                  onSelect={(e) => e.preventDefault()} // Prevent menu closing on item click
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
      {selectedZhrIds.length > 0 && !isLoadingZhrOptions && (
        <Button variant="ghost" size="icon" className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedZhrIds([]); }} aria-label="Clear ZHR filter">
          <XCircle className="h-4 w-4 text-red-600 hover:text-red-700" />
        </Button>
      )}
    </div>
  );
}
