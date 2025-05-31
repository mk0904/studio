
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { useAuth } from './auth-context';

interface VhrOption {
  value: string;
  label: string;
}

interface ChrFilterContextType {
  selectedVhrIds: string[]; // Changed from string to string[]
  setSelectedVhrIds: (vhrIds: string[]) => void; // Changed signature
  vhrOptions: VhrOption[];
  isLoadingVhrOptions: boolean;
}

const ChrFilterContext = createContext<ChrFilterContextType | undefined>(undefined);

export function ChrFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedVhrIds, setSelectedVhrIds] = useState<string[]>([]); // Default to empty array (means All)
  const [vhrOptions, setVhrOptions] = useState<VhrOption[]>([]); // Removed default "All" option
  const [isLoadingVhrOptions, setIsLoadingVhrOptions] = useState<boolean>(false);

  const fetchVhrOptions = useCallback(async () => {
    if (user?.role !== 'CHR') {
      setVhrOptions([]);
      setIsLoadingVhrOptions(false);
      return;
    }
    setIsLoadingVhrOptions(true);
    try {
      const { data: vhrs, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'VHR');

      if (error) {
        console.error("Error fetching VHRs for filter:", error);
        setVhrOptions([]);
      } else {
        const options = (vhrs || []).map((vhr: Pick<User, 'id' | 'name'>) => ({
          value: vhr.id,
          label: vhr.name,
        }));
        setVhrOptions(options); // Just VHRs, no "All"
      }
    } catch (e) {
      console.error("Exception fetching VHRs:", e);
      setVhrOptions([]);
    } finally {
      setIsLoadingVhrOptions(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVhrOptions();
  }, [fetchVhrOptions]);
  
  useEffect(() => {
    if(user?.role === 'CHR'){
        fetchVhrOptions();
    } else {
        setSelectedVhrIds([]);
        setVhrOptions([]);
    }
  }, [user, fetchVhrOptions]);


  return (
    <ChrFilterContext.Provider value={{ selectedVhrIds, setSelectedVhrIds, vhrOptions, isLoadingVhrOptions }}>
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
