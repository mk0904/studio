
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import type { NavItem, UserRole } from '@/types';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, PlusCircle, ListChecks, Eye, Briefcase, BarChart3, Building2, PieChart, FileText, Network, Settings, LogOut
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

  if (!user) {
    return null; 
  }

  const navLinks = ALL_NAV_LINKS[user.role] || [];

  return (
    <SidebarMenu className="flex-grow">
      {navLinks.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`))}
              aria-current={pathname === item.href ? "page" : undefined}
              tooltip={item.label}
              className="group-data-[collapsible=icon]:justify-center"
            >
              <item.icon aria-hidden="true" className="shrink-0" />
              <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
      {/* Moved Account settings to SidebarUserItem, Logout remains here or in user item */}
      <SidebarMenuItem className="mt-auto"> 
          <SidebarMenuButton
            onClick={logout}
            tooltip="Logout"
            className="group-data-[collapsible=icon]:justify-center text-destructive-foreground/80 hover:bg-destructive/20 hover:text-destructive"
          >
            <LogOut aria-hidden="true" className="shrink-0" />
            <span className="truncate group-data-[collapsible=icon]:hidden">Logout</span>
          </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

    