
'use client';

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useChrFilter } from '@/contexts/chr-filter-context'; // Corrected path if needed, assuming file is chr-filter-context.tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardPageHeader() {
  const { user, logout } = useAuth();
  const isChr = user?.role === 'CHR';
  const chrFilterContext = isChr ? useChrFilter() : null;

  const handleVhrFilterChange = (value: string) => {
    if (chrFilterContext) {
      console.log('DashboardPageHeader: VHR Filter changed to:', value);
      chrFilterContext.setSelectedVhrId(value);
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        {/* PageTitle could be dynamically set via context or props */}
      </div>
      <div className="flex items-center gap-4">
        {isChr && chrFilterContext && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {chrFilterContext.isLoadingVhrOptions ? (
              <Skeleton className="h-8 w-48 rounded-md" />
            ) : (
              <Select
                value={chrFilterContext.selectedVhrId}
                onValueChange={handleVhrFilterChange}
              >
                <SelectTrigger className="w-auto min-w-[200px] text-sm h-9">
                  <SelectValue placeholder="Filter by VHR Vertical..." />
                </SelectTrigger>
                <SelectContent>
                  {chrFilterContext.vhrOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
