
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, XCircle, Filter as FilterIcon, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useChrFilter } from '@/contexts/chr-filter-context';

interface FilterOption { value: string; label: string; }

export default function OverseeChannelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedVhrIds: globalSelectedVhrIds } = useChrFilter();

  const [isLoading, setIsLoading] = useState(true);
  const [allUsersGlobal, setAllUsersGlobal] = useState<User[]>([]);

  const [selectedZhrIds, setSelectedZhrIds] = useState<string[]>([]);
  const [zhrOptions, setZhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingZhrOptions, setIsLoadingZhrOptions] = useState(false);

  const [selectedBhrIds, setSelectedBhrIds] = useState<string[]>([]);
  const [bhrOptions, setBhrOptions] = useState<FilterOption[]>([]);
  const [isLoadingBhrOptions, setIsLoadingBhrOptions] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user && user.role === 'CHR') {
      const fetchAllUsers = async () => {
        setIsLoading(true);
        try {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, name, email, role, reports_to, e_code, location');

          if (usersError) throw usersError;
          setAllUsersGlobal(usersData || []);
        } catch (error: any) {
          console.error("Oversee Channel: Error fetching users:", error);
          toast({ title: "Error", description: `Failed to load users: ${error.message}`, variant: "destructive" });
          setAllUsersGlobal([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchAllUsers();
    } else {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    setIsLoadingZhrOptions(true);
    if (allUsersGlobal.length > 0) {
      let potentialZhrs = allUsersGlobal.filter(u => u.role === 'ZHR');
      if (globalSelectedVhrIds.length > 0) {
        potentialZhrs = potentialZhrs.filter(zhr => zhr.reports_to && globalSelectedVhrIds.includes(zhr.reports_to));
      }
      setZhrOptions(potentialZhrs.map(z => ({ value: z.id, label: z.name })));
    } else {
      setZhrOptions([]);
    }
    setSelectedZhrIds([]);
    setIsLoadingZhrOptions(false);
  }, [globalSelectedVhrIds, allUsersGlobal]);

  useEffect(() => {
    setIsLoadingBhrOptions(true);
    if (allUsersGlobal.length > 0) {
      let potentialBhrs = allUsersGlobal.filter(u => u.role === 'BHR');
      if (selectedZhrIds.length > 0) {
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && selectedZhrIds.includes(bhr.reports_to));
      } else if (globalSelectedVhrIds.length > 0) {
        const zhrsUnderSelectedVhrs = allUsersGlobal
          .filter(u => u.role === 'ZHR' && u.reports_to && globalSelectedVhrIds.includes(u.reports_to))
          .map(z => z.id);
        potentialBhrs = potentialBhrs.filter(bhr => bhr.reports_to && zhrsUnderSelectedVhrs.includes(bhr.reports_to));
      }
      setBhrOptions(potentialBhrs.map(b => ({ value: b.id, label: b.name })));
    } else {
      setBhrOptions([]);
    }
    setSelectedBhrIds([]);
    setIsLoadingBhrOptions(false);
  }, [selectedZhrIds, globalSelectedVhrIds, allUsersGlobal]);

  const filteredUsers = useMemo(() => {
    let currentlyFilteredUsers = [...allUsersGlobal];
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (globalSelectedVhrIds.length > 0) {
      const vhrZhrIds = new Set(allUsersGlobal.filter(u => u.role === 'ZHR' && u.reports_to && globalSelectedVhrIds.includes(u.reports_to)).map(z => z.id));
      const vhrBhrIds = new Set(allUsersGlobal.filter(u => u.role === 'BHR' && u.reports_to && vhrZhrIds.has(u.reports_to)).map(b => b.id));
      
      currentlyFilteredUsers = currentlyFilteredUsers.filter(u =>
        u.role === 'CHR' ||
        (u.role === 'VHR' && globalSelectedVhrIds.includes(u.id)) ||
        (u.role === 'ZHR' && vhrZhrIds.has(u.id)) ||
        (u.role === 'BHR' && vhrBhrIds.has(u.id))
      );
    }

    if (selectedZhrIds.length > 0) {
      const zhrBhrIds = new Set(allUsersGlobal.filter(u => u.role === 'BHR' && u.reports_to && selectedZhrIds.includes(u.reports_to)).map(b => b.id));
      currentlyFilteredUsers = currentlyFilteredUsers.filter(u =>
        u.role === 'CHR' ||
        (u.role === 'VHR' && (globalSelectedVhrIds.length === 0 || globalSelectedVhrIds.includes(u.id))) ||
        (u.role === 'ZHR' && selectedZhrIds.includes(u.id)) ||
        (u.role === 'BHR' && zhrBhrIds.has(u.id))
      );
    }

    if (selectedBhrIds.length > 0) {
      currentlyFilteredUsers = currentlyFilteredUsers.filter(u =>
        u.role === 'CHR' ||
        (u.role === 'VHR' && (globalSelectedVhrIds.length === 0 || globalSelectedVhrIds.includes(u.id))) ||
        (u.role === 'ZHR' && (selectedZhrIds.length === 0 || selectedZhrIds.includes(u.id))) ||
        (u.role === 'BHR' && selectedBhrIds.includes(u.id))
      );
    }
    
    if (lowerSearchTerm) {
      currentlyFilteredUsers = currentlyFilteredUsers.filter(u => 
        u.name.toLowerCase().includes(lowerSearchTerm) ||
        u.email.toLowerCase().includes(lowerSearchTerm) ||
        (u.e_code && u.e_code.toLowerCase().includes(lowerSearchTerm)) ||
        (u.location && u.location.toLowerCase().includes(lowerSearchTerm)) ||
        u.role.toLowerCase().includes(lowerSearchTerm)
      );
    }
    return currentlyFilteredUsers;
  }, [allUsersGlobal, globalSelectedVhrIds, selectedZhrIds, selectedBhrIds, searchTerm]);
  
  const columns: ColumnConfig<User>[] = useMemo(() => [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'e_code', header: 'E-Code', cell: (user) => user.e_code || 'N/A' },
    { accessorKey: 'location', header: 'Location', cell: (user) => user.location || 'N/A' },
    { 
      accessorKey: 'reports_to', 
      header: 'Reports To',
      cell: (user) => {
        if (!user.reports_to) return 'N/A';
        const manager = allUsersGlobal.find(m => m.id === user.reports_to);
        return manager ? `${manager.name} (${manager.role})` : 'N/A';
      }
    },
  ], [allUsersGlobal]);

  const getMultiSelectButtonText = (
    options: FilterOption[], 
    selectedIds: string[], 
    defaultText: string, 
    pluralName: string,
    isLoadingOptions: boolean
  ) => {
    if (isLoadingOptions) return `Loading ${pluralName}...`;
    if (selectedIds.length === 0) return defaultText;
    if (selectedIds.length === 1) {
      const selectedOption = options.find(opt => opt.value === selectedIds[0]);
      return selectedOption ? selectedOption.label : `1 ${pluralName.slice(0,-1)} Selected`;
    }
    return `${selectedIds.length} ${pluralName} Selected`;
  };

  const handleMultiSelectChange = (
    id: string, 
    currentSelectedIds: string[], 
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const newSelectedIds = currentSelectedIds.includes(id)
      ? currentSelectedIds.filter(selectedId => selectedId !== id)
      : [...currentSelectedIds, id];
    setter(newSelectedIds);
  };
  
  const handleClearAllLocalFilters = () => {
    setSelectedZhrIds([]);
    setSelectedBhrIds([]);
    setSearchTerm('');
  };

  if (!user || user.role !== 'CHR') {
    return <PageTitle title="Access Denied" description="You do not have permission to view this page." />;
  }
  
  return (
    <div className="space-y-8">
      <PageTitle title="User Directory" description="View and filter users across the organization. Use global VHR filter in header for vertical-specific views." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FilterIcon className="h-5 w-5 text-primary"/>Local Filters</CardTitle>
          <CardDescription>Refine user list by ZHR, BHR, or Search Term. These are applied in conjunction with any global VHR filter set in the header.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(zhrOptions, selectedZhrIds, "All ZHRs", "ZHRs", isLoadingZhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by ZHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingZhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                  zhrOptions.length > 0 ? zhrOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedZhrIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedZhrIds, setSelectedZhrIds)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No ZHRs match VHR filter.</DropdownMenuLabel>}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedZhrIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedZhrIds([]); }} aria-label="Clear ZHR filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
            <div className="relative flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between pr-10">
                    {getMultiSelectButtonText(bhrOptions, selectedBhrIds, "All BHRs", "BHRs", isLoadingBhrOptions)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>Filter by BHR</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isLoadingBhrOptions ? <DropdownMenuLabel>Loading...</DropdownMenuLabel> :
                  bhrOptions.length > 0 ? bhrOptions.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={selectedBhrIds.includes(option.value)}
                      onCheckedChange={() => handleMultiSelectChange(option.value, selectedBhrIds, setSelectedBhrIds)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  )) : <DropdownMenuLabel>No BHRs match ZHR/VHR filter.</DropdownMenuLabel>}
                </DropdownMenuContent>
              </DropdownMenu>
               {selectedBhrIds.length > 0 && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 z-10" onClick={(e) => { e.stopPropagation(); setSelectedBhrIds([]); }} aria-label="Clear BHR filter">
                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
              )}
            </div>
            <div className="relative">
                <Label htmlFor="search-users" className="sr-only">Search</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-users"
                  placeholder="Search name, email, role, e-code, location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
            </div>
          </div>
          <Button variant="outline" onClick={handleClearAllLocalFilters} className="w-full md:w-auto mt-4">
            <XCircle className="mr-2 h-4 w-4" /> Clear Local Filters
          </Button>
        </CardContent>
      </Card>
      
      {isLoading && allUsersGlobal.length === 0 ? (
         <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading users...</p>
        </div>
      ) : (
        <DataTable
            columns={columns}
            data={filteredUsers}
            emptyStateMessage={
                isLoading ? "Loading users..." : 
                (allUsersGlobal.length === 0 ? "No users found in the system." : "No users match your current filter combination.")
            }
        />
      )}
    </div>
  );
}
