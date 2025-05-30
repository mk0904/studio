
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit, VisitStatus, Branch } from '@/types';
import { getVisibleVisits, mockBranches } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow, getMonth, getYear, parseISO } from 'date-fns';
import { Search, FileText, Eye, CheckCircle2, Trash2, Clock, PlusCircle, FileQuestion } from 'lucide-react';

const columns: ColumnConfig<Visit>[] = [
  {
    accessorKey: 'branch_name',
    header: 'Branch',
  },
  {
    accessorKey: 'visit_date',
    header: 'Visit Date',
    cell: (row) => {
      const date = parseISO(row.visit_date);
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
    cell: (row) => {
      if (!row.status) return <Badge variant="outline">Unknown</Badge>;
      let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
      if (row.status === 'approved') variant = 'default'; // default is primary color
      if (row.status === 'submitted') variant = 'secondary';
      if (row.status === 'rejected') variant = 'destructive';
      return <Badge variant={variant} className="capitalize">{row.status}</Badge>;
    }
  },
  {
    accessorKey: 'additional_remarks',
    header: 'Summary',
    cell: (row) => <p className="max-w-sm whitespace-pre-wrap break-words truncate">{row.additional_remarks || row.notes || 'N/A'}</p>
  },
  {
    accessorKey: 'actions',
    header: 'Actions',
    cell: (row) => (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/bhr/new-visit?visit_id=${row.id}`}>View/Edit</Link>
      </Button>
    )
  }
];

const statusFilters: { value: VisitStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: FileText },
  { value: 'submitted', label: 'Submitted', icon: Eye },
  { value: 'approved', label: 'Approved', icon: CheckCircle2 },
  { value: 'rejected', label: 'Rejected', icon: Trash2 },
  { value: 'draft', label: 'Draft', icon: Clock },
];

const monthOptions = [
  {label: "All Months", value: "all"},
  ...Array.from({length: 12}, (_, i) => ({label: format(new Date(0, i), 'MMMM'), value: i.toString()}))
];


export default function MyVisitsPage() {
  const { user } = useAuth();
  const [myVisits, setMyVisits] = useState<Visit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeStatusTab, setActiveStatusTab] = useState<VisitStatus | 'all'>('all');

  const branchCategories = useMemo(() => {
    const categories = new Set(mockBranches.map(b => b.category));
    return [{label: "All Categories", value: "all"}, ...Array.from(categories).map(c => ({label: c, value: c}))];
  }, []);

  useEffect(() => {
    if (user && user.role === 'BHR') {
      const visits = getVisibleVisits(user).sort((a, b) => parseISO(b.visit_date).getTime() - parseISO(a.visit_date).getTime());
      setMyVisits(visits);
    }
  }, [user]);

  const filteredVisits = useMemo(() => {
    return myVisits.filter(visit => {
      const visitDate = parseISO(visit.visit_date);
      const branch = mockBranches.find(b => b.id === visit.branch_id);

      const matchesSearch = searchTerm === '' ||
        visit.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch?.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesMonth = selectedMonth === 'all' || getMonth(visitDate) === parseInt(selectedMonth);
      
      const matchesCategory = selectedCategory === 'all' || branch?.category === selectedCategory;

      const matchesStatus = activeStatusTab === 'all' || visit.status === activeStatusTab;

      return matchesSearch && matchesMonth && matchesCategory && matchesStatus;
    });
  }, [myVisits, searchTerm, selectedMonth, selectedCategory, activeStatusTab]);

  if (!user) return null;

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
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                 {branchCategories.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Tabs value={activeStatusTab} onValueChange={(value) => setActiveStatusTab(value as VisitStatus | 'all')}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
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

      {filteredVisits.length > 0 ? (
        <DataTable
          columns={columns}
          data={filteredVisits}
          title="My Visits"
        />
      ) : (
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
      )}
    </div>
  );
}
