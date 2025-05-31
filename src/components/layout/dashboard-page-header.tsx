
'use client';

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useChrFilter } from '@/contexts/chr-filter-context'; // Import the context hook
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
  
  // Conditionally useChrFilter only if user is CHR
  const chrFilterHook = user?.role === 'CHR' ? useChrFilter : () => ({
    selectedVhrId: 'all',
    setSelectedVhrId: () => {},
    vhrOptions: [{ value: 'all', label: 'All VHR Verticals' }],
    isLoadingVhrOptions: false,
  });
  const { selectedVhrId, setSelectedVhrId, vhrOptions, isLoadingVhrOptions } = chrFilterHook();

  const handleVhrFilterChange = (value: string) => {
    console.log('DashboardPageHeader: VHR Filter changed to:', value);
    setSelectedVhrId(value);
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        {/* PageTitle could be dynamically set via context or props */}
      </div>
      <div className="flex items-center gap-4">
        {user?.role === 'CHR' && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {isLoadingVhrOptions ? (
              <Skeleton className="h-9 w-48 rounded-md" />
            ) : (
              <Select value={selectedVhrId} onValueChange={handleVhrFilterChange} disabled={vhrOptions.length <= 1}>
                <SelectTrigger className="w-auto min-w-[180px] h-9 bg-background/70 border-border text-sm">
                  <SelectValue placeholder="Select VHR Vertical" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  {vhrOptions.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-sm">
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
