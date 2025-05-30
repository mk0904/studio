
'use client';

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { PageTitle } from '@/components/shared/page-title'; // Assuming this will be created

export function DashboardPageHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        {/* PageTitle could be dynamically set via context or props */}
        {/* <PageTitle title="Dashboard" /> */} 
      </div>
      <div className="flex items-center gap-4">
        {/* Placeholder for other header items like notifications */}
        {user && (
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        )}
      </div>
    </header>
  );
}
