
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { useAuth } from './auth-context';

interface FilterOption {
  value: string;
  label: string;
}

interface VhrFilterContextType {
  selectedZhrIds: string[];
  setSelectedZhrIds: (zhrIds: string[]) => void;
  zhrOptions: FilterOption[];
  isLoadingZhrOptions: boolean;
  allBhrsInVhrVertical: User[];
  isLoadingBhrsInVhrVertical: boolean;
}

const VhrFilterContext = createContext<VhrFilterContextType | undefined>(undefined);

export function VhrFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(); // Current VHR user

  const [selectedZhrIds, setSelectedZhrIdsInternal] = useState<string[]>([]);
  const [zhrOptions, setZhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingZhrOptions, setIsLoadingZhrOptions] = useState<boolean>(true);

  const [allBhrsInVhrVertical, setAllBhrsInVhrVertical] = useState<User[]>([]);
  const [isLoadingBhrsInVhrVertical, setIsLoadingBhrsInVhrVertical] = useState<boolean>(true);

  const fetchZhrsAndBhrsForVhr = useCallback(async () => {
    if (user?.role !== 'VHR') {
      setZhrOptions([]);
      setIsLoadingZhrOptions(false);
      setAllBhrsInVhrVertical([]);
      setIsLoadingBhrsInVhrVertical(false);
      return;
    }

    setIsLoadingZhrOptions(true);
    setIsLoadingBhrsInVhrVertical(true);

    try {
      // Fetch ZHRs reporting to the current VHR
      const { data: zhrs, error: zhrsError } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'ZHR')
        .eq('reports_to', user.id);

      if (zhrsError) throw zhrsError;
      setZhrOptions((zhrs || []).map(zhr => ({ value: zhr.id, label: zhr.name })));

      // Fetch BHRs reporting to these ZHRs
      const zhrIdsForBhrQuery = (zhrs || []).map(z => z.id);
      if (zhrIdsForBhrQuery.length > 0) {
        const { data: bhrs, error: bhrsError } = await supabase
          .from('users')
          .select('id, name, role, reports_to, e_code') // Fetch all needed BHR fields
          .eq('role', 'BHR')
          .in('reports_to', zhrIdsForBhrQuery);
        
        if (bhrsError) throw bhrsError;
        setAllBhrsInVhrVertical(bhrs || []);
      } else {
        setAllBhrsInVhrVertical([]);
      }

    } catch (e) {
      console.error("Error fetching ZHRs/BHRs for VHR context:", e);
      setZhrOptions([]);
      setAllBhrsInVhrVertical([]);
    } finally {
      setIsLoadingZhrOptions(false);
      setIsLoadingBhrsInVhrVertical(false);
    }
  }, [user]);

  useEffect(() => {
    fetchZhrsAndBhrsForVhr();
  }, [fetchZhrsAndBhrsForVhr]);
  
  const setSelectedZhrIds = (zhrIds: string[]) => {
    setSelectedZhrIdsInternal(zhrIds);
  };

  return (
    <VhrFilterContext.Provider 
      value={{ 
        selectedZhrIds, 
        setSelectedZhrIds, 
        zhrOptions, 
        isLoadingZhrOptions,
        allBhrsInVhrVertical,
        isLoadingBhrsInVhrVertical
      }}
    >
      {children}
    </VhrFilterContext.Provider>
  );
}

export function useVhrFilter() {
  const context = useContext(VhrFilterContext);
  if (context === undefined) {
    throw new Error('useVhrFilter must be used within a VhrFilterProvider');
  }
  return context;
}
