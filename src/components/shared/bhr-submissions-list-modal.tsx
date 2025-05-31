
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Visit, Branch, User } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { DataTable, type ColumnConfig } from '@/components/shared/data-table';
import { format, parseISO } from 'date-fns';
import { Eye, Loader2 } from 'lucide-react';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Card, CardDescription } from '../ui/card';

export interface BhrSubmissionsListModalProps {
  bhrUser: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BhrSubmissionsListModal({ bhrUser, isOpen, onClose }: BhrSubmissionsListModalProps) {
  const [submissions, setSubmissions] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [selectedVisitForDetailView, setSelectedVisitForDetailView] = useState<EnrichedVisitForModal | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSubmissionsAndBranches = async () => {
      if (!isOpen || !bhrUser) {
        setSubmissions([]);
        return;
      }
      setIsLoading(true);
      try {
        // Fetch all branches for name lookup
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, category, code'); // Fetch necessary branch details
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
        console.error("Error fetching submissions for BHR:", error);
        toast({ title: "Error", description: `Could not load submissions: ${error.message}`, variant: "destructive" });
        setSubmissions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissionsAndBranches();
  }, [isOpen, bhrUser, toast]);

  const columns: ColumnConfig<Visit>[] = useMemo(() => [
    {
      accessorKey: 'branch_id',
      header: 'Branch Name',
      cell: (visit) => {
        const branch = allBranches.find(b => b.id === visit.branch_id);
        return branch ? branch.name : visit.branch_id;
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
        const handleViewClick = () => {
          const branch = allBranches.find(b => b.id === visit.branch_id);
          if (bhrUser) { // Ensure bhrUser is not null
            const enrichedVisit: EnrichedVisitForModal = {
              ...(visit as Visit), // Cast to Visit
              branch_name_display: branch?.name || visit.branch_id,
              branch_category_display: branch?.category,
              branch_code_display: branch?.code,
              bhr_name_display: bhrUser.name, // Use bhrUser from props
            };
            setSelectedVisitForDetailView(enrichedVisit);
            setIsDetailModalOpen(true);
          }
        };
        return (
          <Button variant="outline" size="sm" onClick={handleViewClick}>
            <Eye className="mr-2 h-4 w-4" /> View
          </Button>
        );
      }
    }
  ], [allBranches, bhrUser]); // Add bhrUser to dependencies

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Submissions for {bhrUser?.name || 'BHR'}</DialogTitle>
            <DialogDescription>
              Viewing all submitted visit reports for {bhrUser?.email || 'this BHR'}.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(80vh-150px)] pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading submissions...</p>
              </div>
            ) : submissions.length > 0 ? (
              <DataTable columns={columns} data={submissions} />
            ) : (
               <Card className="mt-4">
                 <CardContent className="pt-6 text-center text-muted-foreground">
                   No submitted visits found for this BHR.
                 </CardContent>
               </Card>
            )}
          </ScrollArea>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
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
