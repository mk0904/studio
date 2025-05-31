
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { NavItem, UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutDashboard, PlusCircle, ListChecks, Eye, Briefcase, BarChart3, Building2, PieChart, FileText, Network, Settings, LogOut, User
} from 'lucide-react';

const ALL_NAV_LINKS: Record<UserRole, NavItem[]> = {
  BHR: [
    { href: '/bhr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/bhr/new-visit', label: 'New Visit', icon: PlusCircle },
    { href: '/bhr/my-visits', label: 'My Visits', icon: ListChecks },
  ],
  ZHR: [
    { href: '/zhr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/zhr/visits-made', label: 'Visits Made', icon: Eye },
    { href: '/zhr/branch-assignments', label: 'Branch Assignments', icon: Briefcase },
    { href: '/zhr/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/zhr/team-structure', label: 'Team Structure', icon: Network },
    { href: '/zhr/export-data', label: 'Export Data', icon: FileText },
  ],
  VHR: [
    { href: '/vhr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/vhr/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/vhr/branch-visits', label: 'Branch Visits', icon: Building2 },
    { href: '/vhr/team-structure', label: 'Team Structure', icon: Network },
    { href: '/vhr/export-data', label: 'Export Data', icon: FileText },
  ],
  CHR: [
    { href: '/chr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/chr/analytics', label: 'Analytics', icon: PieChart },
    { href: '/chr/visits-made', label: 'Visits Made', icon: ListChecks },
    { href: '/chr/oversee-channel', label: 'Oversee Channel', icon: Network },
    { href: '/chr/export-data', label: 'Export Data', icon: FileText },
  ],
};

export function SidebarNavigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isHovered, setIsHovered] = React.useState(false);

  if (!user) {
    return null;
  }

  const navLinks = [...ALL_NAV_LINKS[user.role] || [], 
    // Add Account link
    { href: '/account', label: 'Account', icon: User },
  ];

  const NavItem = ({ item, isActive }: { item: NavItem; isActive: boolean }) => (
    <Link 
      href={item.href}
      className={cn(
        'relative flex items-center transition-all duration-300 ease-out',
        'text-gray-500 hover:text-[#004C8F]',
        // Base styles
        'w-full rounded-xl h-12',
        // Mobile styles (phone)
        'justify-center',
        // Tablet/Desktop styles
        'md:justify-start md:px-4',
        // Hover/Active styles
        'hover:bg-blue-50/60',
        isActive && 'text-[#004C8F] font-medium bg-blue-50/60',
        // Desktop states
        !isMobile && !isHovered && 'xl:w-[48px] xl:p-0 xl:justify-center',
        !isMobile && isHovered && 'xl:px-6'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {!isMobile && !isHovered ? (
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-12 h-12">
                <item.icon className="w-5 h-5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="flex items-center gap-3">
          {!isMobile && !isHovered ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-12 h-12">
                    <item.icon className="w-5 h-5 shrink-0" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <>
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate text-sm hidden sm:inline-block">{item.label}</span>
            </>
          )}
        </div>
      )}
    </Link>
  );

  const containerClasses = cn(
    'fixed z-50 transition-all duration-300 ease-out',
    'md:block', // Always show on md and up
    isMobile
      ? 'bottom-0 left-0 right-0 py-3 px-6 mb-0 md:static md:mb-0 bg-white/95 backdrop-blur-md shadow-[0_-1px_12px_rgba(0,0,0,0.05)] w-full' // Bottom bar on mobile, normal on md+
      : 'top-0 left-0 h-screen bg-white/80 backdrop-blur-lg shadow-[1px_0_12px_rgba(0,0,0,0.05)]', // Sidebar on desktop
    !isMobile && (isHovered ? 'w-64' : 'w-[72px]'),
    'py-3 px-3 flex flex-col h-full' // Full height for flex positioning
  );

  const navClasses = cn(
    'flex flex-1',
    isMobile ? 'flex-row justify-around items-center' : 'flex-col gap-1'
  );

  return (
    <nav 
      className={containerClasses}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      role="navigation"
      aria-label="Main Navigation"
    >
      {!isMobile && (
        <div className={cn(
          'flex items-center mb-6 transition-all duration-300 ease-out',
          !isHovered && 'justify-center'
        )}>
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-8 h-8 rounded bg-[#e31837] text-white font-bold text-lg leading-none ml-2">
              H
            </div>
            <div className={cn(
              'transition-all duration-300 ease-out overflow-hidden whitespace-nowrap',
              !isHovered ? 'w-0 opacity-0' : 'w-44 opacity-100'
            )}>
              <h1 className="text-sm font-semibold text-gray-700">
                HDFC Life
              </h1>
              <p className="text-[10px] font-medium text-gray-500 mt-0.5">
                Visit Management System
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col min-h-full">
        <div className="flex-1">
          <div className={navClasses}>
            {navLinks.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              />
            ))}
          </div>
        </div>
        {!isMobile && (
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-2.5 w-full mb-1',
            'text-red-500 hover:text-red-600',
            'rounded-xl h-12',
            'justify-start md:px-4',
            'hover:bg-red-50/60',
            !isHovered && 'xl:w-[48px] xl:p-0 xl:justify-center',
            isHovered && 'xl:px-6'
          )}
        >  
          {!isMobile && !isHovered ? (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center w-12 h-12">
                    <LogOut className="w-5 h-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  Logout
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="flex items-center gap-2.5">
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="truncate text-sm">Logout</span>
            </div>
          )}
        </button>
        )}
      </div>
    </nav>
  );
}