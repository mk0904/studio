'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarNavigation } from '@/components/layout/sidebar-navigation';
import { DashboardPageHeader } from '@/components/layout/dashboard-page-header';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChrFilterProvider } from '@/contexts/chr-filter-context';
import { VhrFilterProvider } from '@/contexts/vhr-filter-context'; // Import VHR provider

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
    <div className="min-h-screen bg-background">
      <SidebarNavigation />
      <main className={cn(
        "flex-1 overflow-y-auto p-4 md:p-6 xl:p-8",
        "pb-24 sm:pb-24 xl:pb-8", // Add bottom padding for mobile nav
        "xl:ml-[72px]" // Only add left margin on xl breakpoint
      )}>
        <DashboardPageHeader className="lg:block hidden" /> {/* Hide header on mobile/tablet */}
        {children}
      </main>
    </div>
  );

  if (user.role === 'CHR') {
    return <ChrFilterProvider>{content}</ChrFilterProvider>;
  }
  
  if (user.role === 'VHR') {
    return <VhrFilterProvider>{content}</VhrFilterProvider>;
  }

  return content;
}
