
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, VisitStatus, Branch } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card'; 
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow, getMonth, parseISO } from 'date-fns';
import { Search, FileText, Eye, Trash2, Clock, PlusCircle, FileQuestion, Loader2, Edit } from 'lucide-react'; // Removed CheckCircle2
import { useToast } from '@/hooks/use-toast';
import { EditVisitModal } from '@/components/bhr/edit-visit-modal'; 

export default function MyVisitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [myVisits, setMyVisits] = useState<Visit[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeStatusTab, setActiveStatusTab] = useState<VisitStatus | 'all'>('all');

  const [selectedVisitForEdit, setSelectedVisitForEdit] = useState<Visit | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const columns: ColumnConfig<Visit>[] = [
    {
      accessorKey: 'branch_name',
      header: 'Branch',
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => {
        const date = parseISO(visit.visit_date);
        return (
          <div className="flex flex-col">
            <span>{format(date, 'PPP')}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(date, { addSuffix: true })}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (visit) => {
        if (!visit.status) return <Badge variant="outline">Unknown</Badge>;
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        // With only 'draft' and 'submitted', 'default' and 'secondary' are less distinct.
        // Let's use 'secondary' for 'submitted' and 'outline' for 'draft' for now.
        if (visit.status === 'submitted') variant = 'secondary'; 
        if (visit.status === 'draft') variant = 'outline';
        return <Badge variant={variant} className="capitalize">{visit.status}</Badge>;
      }
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (visit) => {
        if (visit.status === 'draft') {
          return (
            <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(visit)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          );
        }
        // For 'submitted'
        return (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bhr/new-visit?visit_id=${visit.id}`}>
              <Eye className="mr-2 h-4 w-4" /> View
            </Link>
          </Button>
        );
      }
    }
  ];

  const statusFilters: { value: VisitStatus | 'all'; label: string; icon: React.ElementType }[] = [
    { value: 'all', label: 'All', icon: FileText },
    { value: 'draft', label: 'Draft', icon: Clock },
    { value: 'submitted', label: 'Submitted', icon: Eye },
  ];

  const monthOptions = [
    {label: "All Months", value: "all"},
    ...Array.from({length: 12}, (_, i) => ({label: format(new Date(0, i), 'MMMM'), value: i.toString()}))
  ];

  const branchCategories = useMemo(() => {
    const categories = new Set(allBranches.map(b => b.category));
    return [{label: "All Categories", value: "all"}, ...Array.from(categories).map(c => ({label: c, value: c}))];
  }, [allBranches]);

  const fetchVisitsAndBranches = useCallback(async () => {
    if (user && user.role === 'BHR') {
      setIsLoading(true);
      try {
        const { data: visitsData, error: visitsError } = await supabase
          .from('visits')
          .select('*')
          .eq('bhr_id', user.id)
          .order('visit_date', { ascending: false });

        if (visitsError) throw visitsError;
        setMyVisits(visitsData || []);

        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, category, location');
        
        if (branchesError) throw branchesError;
        setAllBranches(branchesData || []);

      } catch (error: any) {
        console.error("Error fetching visits or branches:", error);
        toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      setMyVisits([]);
      setAllBranches([]);
    }
  }, [user, toast]);


  useEffect(() => {
    fetchVisitsAndBranches();
  }, [fetchVisitsAndBranches]);

  const filteredVisits = useMemo(() => {
    return myVisits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      const branch = allBranches.find(b => b.id === visit.branch_id);

      const matchesSearch = searchTerm === '' ||
        (visit.branch_name && visit.branch_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (branch?.location && branch.location.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesMonth = selectedMonth === 'all' || getMonth(visitDate) === parseInt(selectedMonth);
      
      const matchesCategory = selectedCategory === 'all' || branch?.category === selectedCategory;

      const matchesStatus = activeStatusTab === 'all' || visit.status === activeStatusTab;

      return matchesSearch && matchesMonth && matchesCategory && matchesStatus;
    });
  }, [myVisits, allBranches, searchTerm, selectedMonth, selectedCategory, activeStatusTab]);

  const handleOpenEditModal = (visit: Visit) => {
    setSelectedVisitForEdit(visit);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedVisitForEdit(null);
  };

  const handleVisitUpdated = () => {
    fetchVisitsAndBranches(); 
  };

  if (!user) return null;

  if (isLoading && myVisits.length === 0) { 
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading your visits...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageTitle title="My Branch Visits" description="View and manage your branch visit records." />
        <Button asChild>
          <Link href="/bhr/new-visit">
            <PlusCircle className="mr-2 h-4 w-4" /> New Visit
          </Link>
        </Button>
      </div>

      <Card className="shadow-md">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by branch name, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue placeholder="All Months" /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={branchCategories.length <= 1}>
              <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                 {branchCategories.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Tabs value={activeStatusTab} onValueChange={(value) => setActiveStatusTab(value as VisitStatus | 'all')}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3"> {/* Adjusted grid columns */}
              {statusFilters.map(filter => (
                <TabsTrigger key={filter.value} value={filter.value} className="gap-2">
                  <filter.icon className="h-4 w-4" />
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {isLoading && myVisits.length > 0 && ( 
        <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
            <p className="ml-2 text-muted-foreground text-sm">Refreshing visits...</p>
        </div>
      )}

      {!isLoading && filteredVisits.length > 0 ? (
        <DataTable
          columns={columns}
          data={filteredVisits}
        />
      ) : (
        !isLoading && ( 
          <Card className="shadow-md">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-primary/10 rounded-full">
                  <FileQuestion className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">No visit reports found</h3>
              <p className="text-muted-foreground max-w-md">
                No branch visit reports match your current filters or you haven't created any yet.
              </p>
              <Button asChild className="mt-4">
                <Link href="/bhr/new-visit">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Visit Report
                </Link>
              </Button>
            </CardContent>
          </Card>
        )
      )}
      {selectedVisitForEdit && (
        <EditVisitModal
          visitToEdit={selectedVisitForEdit}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onVisitUpdated={() => {
            handleCloseEditModal(); 
            fetchVisitsAndBranches(); 
          }}
        />
      )}
    </div>
  );
}
