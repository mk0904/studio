'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, ListChecks } from 'lucide-react';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { format, parseISO } from 'date-fns';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal'; // Re-using ZHR's detailed view

interface BhrSubmissionsListModalProps {
  bhrUser: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BhrSubmissionsListModal({ bhrUser, isOpen, onClose }: BhrSubmissionsListModalProps) {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allBranches, setAllBranches] = useState<Branch[]>([]); // For branch name lookup

  const [selectedVisitForDetailView, setSelectedVisitForDetailView] = useState<EnrichedVisitForModal | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchSubmissionsAndBranches = useCallback(async () => {
    if (!bhrUser) {
      setSubmissions([]);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch all branches for name lookup
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, category, code'); // Fetch necessary branch fields
      if (branchesError) throw branchesError;
      setAllBranches(branchesData || []);

      // Fetch submitted visits for the BHR
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .eq('bhr_id', bhrUser.id)
        .eq('status', 'submitted')
        .order('visit_date', { ascending: false });
      if (visitsError) throw visitsError;
      setSubmissions(visitsData as Visit[] || []);

    } catch (error: any) {
      console.error("Error fetching BHR submissions or branches:", error);
      toast({ title: "Error", description: `Failed to load submissions: ${error.message}`, variant: "destructive" });
      setSubmissions([]);
      setAllBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, [bhrUser, toast]);

  useEffect(() => {
    if (isOpen && bhrUser) {
      fetchSubmissionsAndBranches();
    }
  }, [isOpen, bhrUser, fetchSubmissionsAndBranches]);

  const columns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'branch_id',
      header: 'Branch Name',
      cell: (visit) => {
        const branch = allBranches.find(b => b.id === visit.branch_id);
        return branch ? branch.name : 'Unknown Branch';
      }
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP')
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (visit) => {
        const handleViewDetailsClick = () => {
          if (!bhrUser) return;
          const branch = allBranches.find(b => b.id === visit.branch_id);
          const enrichedVisit: EnrichedVisitForModal = {
            ...visit,
            branch_name_display: branch?.name || visit.branch_id,
            branch_category_display: branch?.category,
            branch_code_display: branch?.code,
            bhr_name_display: bhrUser.name, // Use the bhrUser from modal prop
          };
          setSelectedVisitForDetailView(enrichedVisit);
          setIsDetailModalOpen(true);
        };
        return (
          <Button variant="default" size="sm" onClick={handleViewDetailsClick} className="bg-[#004C8F] hover:bg-[#004C8F]/90 text-white shadow rounded-lg">
            <Eye className="mr-2 h-4 w-4" /> View
          </Button>
        );
      }
    }
  ], [allBranches, bhrUser]);


  if (!bhrUser) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-3xl bg-white backdrop-blur-lg shadow-2xl border border-slate-200 rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-8 pt-8 pb-2 border-b border-slate-100">
            <DialogTitle className="text-2xl font-bold tracking-tight text-[#004C8F]">Submitted Visits for {bhrUser.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground/80 mt-1 text-base">
              Showing all submitted visit reports by {bhrUser.name} ({bhrUser.email}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 px-8">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading submissions...</p>
              </div>
            ) : submissions.length > 0 ? (
              <div className="rounded-xl overflow-hidden shadow border border-slate-100 bg-white/95">
                <DataTable
                  columns={columns}
                  data={submissions}
                  emptyStateMessage="No submitted visits found for this BHR."
                  className="!border-0 !shadow-none !rounded-xl"
                  rowClassName="hover:bg-primary/5 transition border-b border-slate-100 last:border-0"
                  cellClassName="py-4 px-4 text-base"
                  headerClassName="bg-muted/40 text-slate-700 text-base font-semibold border-b border-slate-100"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                  <ListChecks className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No Submitted Visits</p>
                  <p className="text-xs text-muted-foreground">{bhrUser.name} has not submitted any visit reports yet.</p>
              </div>
            )}
          </div>
          <DialogFooter className="px-8 pb-8">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-lg px-6 py-2 text-base font-semibold shadow-sm transition border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedVisitForDetailView && (
        <ViewVisitDetailsModal
          visit={selectedVisitForDetailView}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedVisitForDetailView(null);
          }}
        />
      )}
    </>
  );
}
