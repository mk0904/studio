
'use client';

import React from 'react';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarUserItem } from './sidebar-user-item';

export function AppSidebarContent() {

  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarNavigation />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarUserItem />
      </SidebarFooter>
    </>
  );
}
