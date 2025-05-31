
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { useAuth } from './auth-context';

interface FilterOption {
  value: string;
  label: string;
}

interface ChrFilterContextType {
  selectedVhrIds: string[];
  setSelectedVhrIds: (vhrIds: string[]) => void;
  vhrOptions: FilterOption[];
  isLoadingVhrOptions: boolean;

  allUsersForContext: User[]; // To allow CHR pages to build further local filters
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
  };

  return (
    <ChrFilterContext.Provider 
      value={{ 
        selectedVhrIds, 
        setSelectedVhrIds, 
        vhrOptions, 
        isLoadingVhrOptions,
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
