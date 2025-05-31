
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import { useAuth } from './auth-context'; // To check current user's role

interface VhrOption {
  value: string;
  label: string;
}

interface ChrFilterContextType {
  selectedVhrId: string;
  setSelectedVhrId: (vhrId: string) => void;
  vhrOptions: VhrOption[];
  isLoadingVhrOptions: boolean;
}

const ChrFilterContext = createContext<ChrFilterContextType | undefined>(undefined);

export function ChrFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(); // Get current user
  const [selectedVhrId, setSelectedVhrId] = useState<string>('all');
  const [vhrOptions, setVhrOptions] = useState<VhrOption[]>([{ value: 'all', label: 'All VHR Verticals' }]);
  const [isLoadingVhrOptions, setIsLoadingVhrOptions] = useState<boolean>(false);

  const fetchVhrOptions = useCallback(async () => {
    if (user?.role !== 'CHR') {
      setVhrOptions([{ value: 'all', label: 'All VHR Verticals' }]);
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
        setVhrOptions([{ value: 'all', label: 'All VHR Verticals' }]); // Default on error
      } else {
        const options = (vhrs || []).map((vhr: Pick<User, 'id' | 'name'>) => ({
          value: vhr.id,
          label: vhr.name,
        }));
        setVhrOptions([{ value: 'all', label: 'All VHR Verticals' }, ...options]);
      }
    } catch (e) {
      console.error("Exception fetching VHRs:", e);
      setVhrOptions([{ value: 'all', label: 'All VHR Verticals' }]);
    } finally {
      setIsLoadingVhrOptions(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVhrOptions();
  }, [fetchVhrOptions]);
  
  // Refetch if user changes (e.g. logout/login as different user)
  useEffect(() => {
    if(user?.role === 'CHR'){
        fetchVhrOptions();
    } else {
        // Reset if user is not CHR
        setSelectedVhrId('all');
        setVhrOptions([{ value: 'all', label: 'All VHR Verticals' }]);
    }
  }, [user, fetchVhrOptions]);


  return (
    <ChrFilterContext.Provider value={{ selectedVhrId, setSelectedVhrId, vhrOptions, isLoadingVhrOptions }}>
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
