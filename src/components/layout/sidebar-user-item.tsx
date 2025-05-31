
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
// Removed DropdownMenu related imports and Pencil, LogOut from lucide-react

export function SidebarUserItem() {
  const { user, isLoading } = useAuth();
  // Removed useState for isEditModalOpen and EditProfileModal

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:flex">
      <Link href="/account" className="flex w-full items-center gap-3 p-2 justify-start rounded-md hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:aspect-square"
        aria-label={`Account settings for ${user.name}`}
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={`https://placehold.co/100x100.png?text=${initials}`} alt={user.name} data-ai-hint="avatar person" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="truncate group-data-[collapsible=icon]:hidden">
          <p className="text-sm font-medium text-sidebar-foreground">{user.name}</p>
          <p className="text-xs text-sidebar-foreground/70">{user.role}</p>
        </div>
      </Link>
      {/* EditProfileModal is no longer rendered here, it's on the /account page */}
    </div>
  );
}
