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
    <div className="relative min-h-screen w-full bg-background">
      <SidebarNavigation />
      <main className={cn(
        "flex min-h-screen w-full flex-col",
        "transition-all duration-300 ease-out",
        "xl:pl-[72px]" // Add left padding for sidebar on desktop
      )}>
        <DashboardPageHeader className="lg:block hidden" /> {/* Hide header on mobile/tablet */}
        <div className="flex-1 w-full">
          {children}
        </div>
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
