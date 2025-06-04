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
import { cn } from '@/lib/utils';
import { Building2, Calendar, CheckCircle, Edit, Eye, FileEdit, FileQuestion, ListFilter, Loader2, PlusCircle, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EditVisitModal } from '@/components/bhr/edit-visit-modal';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';

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
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const columns: ColumnConfig<Visit>[] = [
    {
      accessorKey: 'branch_id',
      header: 'Branch',
      cell: (row) => {
        const branch = allBranches.find(b => b.id === row.branch_id);
        return <span className="font-medium text-slate-700">{branch?.name || 'Unknown Branch'}</span>;
      }
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (row) => {
        const date = parseISO(row.visit_date);
        return (
          <div className="flex flex-col space-y-0.5">
            <span className="text-slate-700">{format(date, 'PPP')}</span>
            <span className="text-xs text-slate-500">
              {formatDistanceToNow(date, { addSuffix: true })}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: 'branch_category',
      header: 'Category',
      cell: (row) => {
        const branch = allBranches.find(b => b.id === row.branch_id);
        const category = (branch?.category || 'uncategorized').toLowerCase();

        const categoryColors = {
          'diamond': 'bg-[#ECF9FF] text-[#0B4D76] hover:bg-[#ECF9FF]/80',
          'platinum': 'bg-[#F7F7F7] text-[#374151] hover:bg-[#F7F7F7]/80',
          'gold': 'bg-[#FFF7E6] text-[#976A1D] hover:bg-[#FFF7E6]/80',
          'silver': 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#F3F4F6]/80',
          'bronze': 'bg-[#FBF0E4] text-[#8B4513] hover:bg-[#FBF0E4]/80',
          'uncategorized': 'bg-slate-50 text-slate-600 hover:bg-slate-50/80'
        };

        return (
          <Badge
            variant="secondary"
            className={cn(
              'font-medium px-2.5 py-0.5 text-xs',
              categoryColors[category as keyof typeof categoryColors] || categoryColors.uncategorized
            )}
          >
            {category}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (row) => {
        const status = row.status;
        return (
          <Badge
            variant={status === 'draft' ? 'outline' : 'default'}
            className={cn(
              'capitalize font-medium px-2.5 py-0.5 text-xs inline-flex items-center gap-1.5',
              status === 'draft'
                ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50/80'
                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-50/80'
            )}
          >
            {status === 'draft' ? (
              <>
                <FileQuestion className="h-3 w-3" />
                Draft
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Submitted
              </>
            )}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'id',
      header: 'Actions',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenModal(row)}
          className={cn(
            "h-9 px-3 text-sm font-medium transition-colors duration-150",
            "text-slate-700 bg-white border-slate-200 shadow-sm",
            row.status === 'draft'
              ? "hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900"
              : "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800"
          )}
        >
          {row.status === 'draft' ? (
            <>
              <Edit className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Edit
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1.5 text-slate-500" />
              View
            </>
          )}
        </Button>
      )
    }
  ];

  const statusFilters: { value: VisitStatus | 'all'; label: string; icon: React.ElementType }[] = [
    { value: 'all', label: 'All', icon: ListFilter },
    { value: 'draft', label: 'Draft', icon: FileEdit },
    { value: 'submitted', label: 'Submitted', icon: CheckCircle },
  ];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: format(new Date(2024, i, 1), 'MMMM')
  }));

  const allMonthsOption = { value: 'all', label: 'All Months' };
  const monthOptions = [allMonthsOption, ...months];

  const branchCategories = useMemo(() => {
    const categories = new Set(allBranches.map(b => b.category).filter(Boolean));
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
        setMyVisits(visitsData as Visit[] || []);

        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, category, location, code');

        if (branchesError) throw branchesError;
        setAllBranches((branchesData || []) as Branch[]);

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
        (branch?.name && branch.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (branch?.location && branch.location.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesMonth = selectedMonth === 'all' || getMonth(visitDate) === parseInt(selectedMonth);

      const matchesCategory = selectedCategory === 'all' || branch?.category === selectedCategory;

      const matchesStatus = activeStatusTab === 'all' || visit.status === activeStatusTab;

      return matchesSearch && matchesMonth && matchesCategory && matchesStatus;
    });
  }, [myVisits, allBranches, searchTerm, selectedMonth, selectedCategory, activeStatusTab]);

  const handleOpenModal = (visit: Visit) => {
    if (visit.status === 'draft') {
      setSelectedVisitForEdit(visit);
      setIsEditModalOpen(true);
      setSelectedVisitForView(null);
      setIsViewModalOpen(false);
    } else if (visit.status === 'submitted') {
      const branch = allBranches.find(b => b.id === visit.branch_id);
      // Prepare enriched data for the view modal
      const enrichedVisit: EnrichedVisitForModal = {
        ...visit,
        branch_name_display: branch?.name || 'N/A',
        branch_category_display: branch?.category || 'N/A',
        branch_code_display: branch?.code || 'N/A',
        // Assuming bhr_name is already on the visit object fetched
      };
      setSelectedVisitForView(enrichedVisit);
      setIsViewModalOpen(true);
      setSelectedVisitForEdit(null);
      setIsEditModalOpen(false);
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedVisitForEdit(null);
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
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-gradient-to-br from-white via-white/95 to-white/90 p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200/50">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#004C8F]">My Branch Visits</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/80 mt-0.5 sm:mt-1">View and manage your branch visit records</p>
        </div>
        <Button asChild className="bg-[#004C8F] hover:bg-[#004C8F]/90 transition-all duration-200 text-white h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm shadow hover:shadow-md w-full sm:w-auto">
          <Link href="/bhr/new-visit" className="inline-flex items-center justify-center gap-1.5 sm:gap-2">
            <PlusCircle className="h-3.5 w-3.5" />
            <span>New Visit</span>
          </Link>
        </Button>
      </div>

      <Card className="border-0 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="px-4 sm:px-6 pb-6 space-y-5 sm:space-y-6">
          <div className="space-y-4 sm:space-y-0 mb-6">
            {/* Top Row: Search, Clear, Status Tabs */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center w-full mb-6">
              {/* Search Input and Clear Button Group (Phone View) */}
              <div className="flex gap-2 items-center w-full md:flex-1">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-[#004C8F]" />
                  </div>
                  <Input
                    placeholder="Search branch name or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200"
                  />
                </div>
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedMonth('all');
                    setSelectedCategory('all');
                    setActiveStatusTab('all');
                  }}
                  variant="ghost"
                  className="h-10 text-sm font-medium border text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors duration-200 whitespace-nowrap rounded-lg px-3 md:px-4 inline-flex items-center gap-2 shadow-sm"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden md:inline">Clear Filters</span>
                </Button>
              </div>
              {/* Status Tabs */}
              <div className="w-full md:w-auto md:flex-shrink-0 mt-2 md:mt-0">
                <Tabs value={activeStatusTab} onValueChange={(value) => setActiveStatusTab(value as VisitStatus | 'all')} className="w-full">
                  <TabsList className="grid grid-cols-3 h-10 p-1 bg-white/80 backdrop-blur-sm border border-slate-200/70 shadow-sm rounded-lg">
                    <TabsTrigger
                      value="all"
                      className="text-sm font-medium data-[state=active]:bg-[#004C8F] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200 hover:bg-slate-50 data-[state=active]:hover:bg-[#004C8F]/90 inline-flex items-center justify-center"
                      title="All Status"
                    >
                      <ListFilter className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1.5">All</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="draft"
                      className="text-sm font-medium data-[state=active]:bg-[#004C8F] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200 hover:bg-slate-50 data-[state=active]:hover:bg-[#004C8F]/90 inline-flex items-center justify-center" title="Draft"
                    >
                      <FileQuestion className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1.5">Draft</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="submitted"
                      className="text-sm font-medium data-[state=active]:bg-[#004C8F] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200 hover:bg-slate-50 data-[state=active]:hover:bg-[#004C8F]/90 inline-flex items-center justify-center" title="Submitted"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1.5">Submitted</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Bottom Row: Month and Category Selects */}
            <div className="flex flex-col sm:flex-row gap-3 items-center w-full">
              {/* Month Select */}
              <div className="flex-1 w-full mb-2 sm:mb-6">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200">
                    <Calendar className="mr-2 h-4 w-4 text-[#004C8F]" />
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="border-0 shadow-md max-h-60 overflow-y-auto">
                    {monthOptions.map(month => (
                      <SelectItem
                        key={month.value}
                        value={month.value}
                        className="text-sm py-2 px-3 cursor-pointer hover:bg-slate-50 focus:bg-slate-50 outline-none relative"
                      >
                        <span className="block pl-5">{month.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Category Select */}
              <div className="flex-1 w-full mb-2 sm:mb-6">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full h-10 bg-white/80 backdrop-blur-sm border-slate-200/70 hover:bg-slate-50/50 text-sm shadow-sm focus:ring-1 focus:ring-[#004C8F]/20 focus:ring-offset-1 rounded-lg transition-all duration-200">
                    <Building2 className="mr-2 h-4 w-4 text-[#004C8F]" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="border-0 shadow-md max-h-60 overflow-y-auto">
                    {branchCategories.map(category => (
                      <SelectItem
                        key={category.value}
                        value={category.value}
                        className="text-sm py-2 px-3 cursor-pointer hover:bg-slate-50 focus:bg-slate-50 outline-none relative"
                      >
                        <span className="block pl-5">{category.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-sm">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#004C8F]/60" />
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100/80 rounded-full p-4 sm:p-5 mb-4 sm:mb-5 shadow-sm ring-1 ring-slate-100">
                    <FileQuestion className="h-8 w-8 sm:h-9 sm:w-9 text-[#004C8F]/60" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">No visits found</h3>
                  <p className="text-sm sm:text-base text-slate-600 max-w-sm mb-6">Try adjusting your filters or create a new visit report</p>
                  <Button asChild className="h-9 sm:h-10 px-4 sm:px-5 bg-[#004C8F] hover:bg-[#004C8F]/90 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
                    <Link href="/bhr/new-visit" className="inline-flex items-center gap-2 text-sm font-medium">
                      <PlusCircle className="h-4 w-4" />
                      Create New Visit
                    </Link>
                  </Button>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={filteredVisits}
                  tableClassName="[&_thead_th]:bg-slate-50/80 [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:text-slate-600 [&_thead_th]:h-14 [&_thead_th]:px-6 [&_thead]:border-b [&_thead]:border-slate-200/60 [&_tbody_td]:px-6 [&_tbody_td]:py-4 [&_tbody_td]:text-sm [&_tbody_tr:hover]:bg-blue-50/30 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100/60 [&_tr]:transition-colors [&_td]:align-middle [&_tbody_tr:last-child]:border-0"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* View Visit Details Modal */}
      {selectedVisitForView && (
        <ViewVisitDetailsModal
          visit={selectedVisitForView}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedVisitForView(null);
          }}
        />
      )}
    </div>
  );
}


    