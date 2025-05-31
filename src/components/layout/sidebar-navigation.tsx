
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
  LayoutDashboard, PlusCircle, ListChecks, Eye, Briefcase, BarChart3, Building2, PieChart, LogOut, BarChartHorizontalBig, Settings, Users
} from 'lucide-react';

const ALL_NAV_LINKS: Record<UserRole, NavItem[]> = {
  BHR: [
    { href: '/bhr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/bhr/new-visit', label: 'New Visit', icon: PlusCircle },
    { href: '/bhr/my-visits', label: 'My Visits', icon: ListChecks },
    // Removed BHR Analytics: { href: '/bhr/analytics', label: 'Analytics', icon: BarChartHorizontalBig },
  ],
  ZHR: [
    { href: '/zhr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/zhr/visits-made', label: 'Visits Made', icon: Eye },
    { href: '/zhr/branch-assignments', label: 'Branch Assignments', icon: Briefcase },
    { href: '/zhr/analytics', label: 'Analytics', icon: BarChart3 }, // Added ZHR Analytics
  ],
  VHR: [
    { href: '/vhr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/vhr/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/vhr/branch-visits', label: 'Branch Visits', icon: Building2 },
  ],
  CHR: [
    { href: '/chr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/chr/analytics', label: 'Analytics', icon: PieChart },
    { href: '/chr/visits-made', label: 'Visits Made', icon: ListChecks }, // Changed from Global Overview
  ],
};

export function SidebarNavigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) {
    return null; // Or a loading state/skeleton
  }

  const navLinks = ALL_NAV_LINKS[user.role] || [];

  return (
    <SidebarMenu>
      {navLinks.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              aria-current={pathname === item.href ? "page" : undefined}
              tooltip={item.label}
            >
              <item.icon aria-hidden="true" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
      <SidebarMenuItem className="mt-auto">
          <SidebarMenuButton
            onClick={logout}
            tooltip="Logout"
          >
            <LogOut aria-hidden="true" />
            <span>Logout</span>
          </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
