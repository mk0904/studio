
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { useAuth } from './auth-context';

interface FilterOption { // Renamed VhrOption to FilterOption for reusability
  value: string;
  label: string;
}

interface ChrFilterContextType {
  selectedVhrIds: string[];
  setSelectedVhrIds: (vhrIds: string[]) => void;
  vhrOptions: FilterOption[];
  isLoadingVhrOptions: boolean;

  selectedZhrIds: string[];
  setSelectedZhrIds: (zhrIds: string[]) => void;
  zhrOptions: FilterOption[];
  isLoadingZhrOptions: boolean;

  allUsersForContext: User[];
  isLoadingAllUsers: boolean;
}

const ChrFilterContext = createContext<ChrFilterContextType | undefined>(undefined);

export function ChrFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [allUsersForContext, setAllUsersForContext] = useState<User[]>([]);
  const [isLoadingAllUsers, setIsLoadingAllUsers] = useState<boolean>(false);

  const [selectedVhrIds, setSelectedVhrIdsInternal] = useState<string[]>([]);
  const [vhrOptions, setVhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingVhrOptions, setIsLoadingVhrOptions] = useState<boolean>(false);

  const [selectedZhrIds, setSelectedZhrIdsInternal] = useState<string[]>([]);
  const [zhrOptions, setZhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingZhrOptions, setIsLoadingZhrOptions] = useState<boolean>(false);

  const fetchAllUsersForContext = useCallback(async () => {
    if (user?.role !== 'CHR') {
      setAllUsersForContext([]);
      setIsLoadingAllUsers(false);
      return;
    }
    setIsLoadingAllUsers(true);
    try {
      const { data: users, error } = await supabase.from('users').select('id, name, role, reports_to');
      if (error) throw error;
      setAllUsersForContext(users || []);
    } catch (e) {
      console.error("Error fetching all users for context:", e);
      setAllUsersForContext([]);
    } finally {
      setIsLoadingAllUsers(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllUsersForContext();
  }, [fetchAllUsersForContext]);

  useEffect(() => {
    if (isLoadingAllUsers || user?.role !== 'CHR') {
      setVhrOptions([]);
      setIsLoadingVhrOptions(false);
      return;
    }
    setIsLoadingVhrOptions(true);
    const vhrs = allUsersForContext.filter(u => u.role === 'VHR');
    setVhrOptions(vhrs.map(vhr => ({ value: vhr.id, label: vhr.name })));
    setIsLoadingVhrOptions(false);
  }, [allUsersForContext, isLoadingAllUsers, user]);

  const setSelectedVhrIds = (vhrIds: string[]) => {
    setSelectedVhrIdsInternal(vhrIds);
    setSelectedZhrIdsInternal([]); // Reset ZHR selection when VHR selection changes
  };

  useEffect(() => {
    if (isLoadingAllUsers || user?.role !== 'CHR') {
      setZhrOptions([]);
      setIsLoadingZhrOptions(false);
      return;
    }
    setIsLoadingZhrOptions(true);
    let potentialZhrs: User[];
    if (selectedVhrIds.length > 0) {
      potentialZhrs = allUsersForContext.filter(
        u => u.role === 'ZHR' && u.reports_to && selectedVhrIds.includes(u.reports_to)
      );
    } else {
      potentialZhrs = allUsersForContext.filter(u => u.role === 'ZHR');
    }
    setZhrOptions(potentialZhrs.map(zhr => ({ value: zhr.id, label: zhr.name })));
    setIsLoadingZhrOptions(false);
  }, [allUsersForContext, isLoadingAllUsers, user, selectedVhrIds]);
  
  const setSelectedZhrIds = (zhrIds: string[]) => {
    setSelectedZhrIdsInternal(zhrIds);
  };

  return (
    <ChrFilterContext.Provider 
      value={{ 
        selectedVhrIds, 
        setSelectedVhrIds, 
        vhrOptions, 
        isLoadingVhrOptions,
        selectedZhrIds,
        setSelectedZhrIds,
        zhrOptions,
        isLoadingZhrOptions,
        allUsersForContext,
        isLoadingAllUsers
      }}
    >
      {children}
    </ChrFilterContext.Provider>
  );
}

export function useChrFilter() {
  const context = useContext(ChrFilterContext);
  if (context === undefined) {
    throw new Error('useChrFilter must be used within a ChrFilterProvider');
  }
  return context;
}
