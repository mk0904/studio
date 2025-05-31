
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebarContent } from '@/components/layout/app-sidebar-content';
import { DashboardPageHeader } from '@/components/layout/dashboard-page-header'; 
import { Skeleton } from '@/components/ui/skeleton';
import { ChrFilterProvider } from '@/contexts/chr-filter-context'; // Import the provider

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Skeleton className="h-12 w-12 rounded-full animate-spin" /> 
      </div>
    );
  }

  const content = (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
        <AppSidebarContent />
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <DashboardPageHeader />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </div>
  );

  if (user.role === 'CHR') {
    return <ChrFilterProvider>{content}</ChrFilterProvider>;
  }

  return content;
}
