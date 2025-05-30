
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarCheck, BarChart3, Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Visit, User, Branch } from '@/types';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { format, parseISO } from 'date-fns';
import { ViewVisitDetailsModal, type EnrichedVisitForModal } from '@/components/zhr/view-visit-details-modal'; // Reusing ZHR modal

export default function VHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [zhrCount, setZhrCount] = useState(0);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalSubmittedVisitsInVertical, setTotalSubmittedVisitsInVertical] = useState(0);
  const [recentSubmittedVisits, setRecentSubmittedVisits] = useState<EnrichedVisitForModal[]>([]);
  
  // For modal and name lookups
  const [bhrUsersInVertical, setBhrUsersInVertical] = useState<User[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedVisitForView, setSelectedVisitForView] = useState<EnrichedVisitForModal | null>(null);

  const recentVisitsColumns: ColumnConfig<EnrichedVisitForModal>[] = useMemo(() => [
    {
      accessorKey: 'bhr_id',
      header: 'BHR Name',
      cell: (visit) => visit.bhr_name_display || 'N/A',
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch',
      cell: (visit) => visit.branch_name_display || 'N/A',
    },
    {
      accessorKey: 'visit_date',
      header: 'Visit Date',
      cell: (visit) => format(parseISO(visit.visit_date), 'PPP')
    },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: (visit) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedVisitForView(visit);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="mr-2 h-4 w-4" /> View
        </Button>
      ),
    }
  ], []);

  useEffect(() => {
    if (user && user.role === 'VHR') {
      const fetchData = async () => {
        setIsLoading(true);
        console.log("VHRDashboard: Fetching data for VHR:", user.name);
        try {
          // 1. Fetch ZHRs reporting to this VHR
          const { data: zhrUsersData, error: zhrError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'ZHR')
            .eq('reports_to', user.id);

          if (zhrError) throw zhrError;
          setZhrCount(zhrUsersData?.length || 0);
          const zhrIds = (zhrUsersData || []).map(z => z.id);

          let bhrUsersData: User[] = [];
          let submittedVisitsData: Visit[] = [];

          if (zhrIds.length > 0) {
            // 2. Fetch BHRs reporting to these ZHRs
            const { data: fetchedBhrs, error: bhrError } = await supabase
              .from('users')
              .select('id, name, e_code')
              .eq('role', 'BHR')
              .in('reports_to', zhrIds);

            if (bhrError) throw bhrError;
            bhrUsersData = fetchedBhrs || [];
            setBhrUsersInVertical(bhrUsersData);
            setBhrCount(bhrUsersData.length);
            
            const bhrIds = bhrUsersData.map(b => b.id);

            if (bhrIds.length > 0) {
              // 3. Fetch submitted visits by these BHRs
              const { data: visits, error: visitsError } = await supabase
                .from('visits')
                .select('*')
                .in('bhr_id', bhrIds)
                .eq('status', 'submitted')
                .order('visit_date', { ascending: false }); // Order by most recent
              
              if (visitsError) throw visitsError;
              submittedVisitsData = (visits as Visit[]) || [];
              setTotalSubmittedVisitsInVertical(submittedVisitsData.length);

              // Fetch all branches for name lookup
              const { data: branchesData, error: branchesErr } = await supabase
                .from('branches')
                .select('id, name, category, code');
              if (branchesErr) throw branchesErr;
              setAllBranches(branchesData || []);

              // Enrich top 5 recent visits
              const top5Visits = submittedVisitsData.slice(0, 5);
              const enrichedRecentVisits = top5Visits.map(v => {
                  const branch = (branchesData || []).find(b => b.id === v.branch_id);
                  const bhr = bhrUsersData.find(u => u.id === v.bhr_id);
                  return {
                      ...v,
                      branch_name_display: branch?.name || v.branch_id,
                      branch_category_display: branch?.category,
                      branch_code_display: branch?.code,
                      bhr_name_display: bhr?.name || v.bhr_id,
                  };
              });
              setRecentSubmittedVisits(enrichedRecentVisits);
            } else {
              setTotalSubmittedVisitsInVertical(0);
              setRecentSubmittedVisits([]);
            }
          } else {
            setBhrCount(0);
            setTotalSubmittedVisitsInVertical(0);
            setRecentSubmittedVisits([]);
          }
        } catch (error: any) {
          console.error("VHRDashboard: Error fetching VHR dashboard data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setZhrCount(0);
          setBhrCount(0);
          setTotalSubmittedVisitsInVertical(0);
          setRecentSubmittedVisits([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else {
        setIsLoading(false);
    }
  }, [user, toast]);

  if (!user) return null;

  if (isLoading && user.role === 'VHR') {
    return (
      <div className="space-y-8">
        <PageTitle title={`VHR Dashboard`} description={`Loading vertical overview for ${user.name}...`} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="VHR Dashboard" description={`Vertical overview for ${user.name} (Submitted Data).`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="ZHRs in Vertical" value={zhrCount} icon={Users} description="Total ZHRs reporting to you." />
        <StatCard title="BHRs in Vertical" value={bhrCount} icon={Users} description="Total BHRs under your ZHRs." />
        <StatCard title="Total Submitted Visits" value={totalSubmittedVisitsInVertical} icon={CalendarCheck} description="Submitted visits across your vertical." />
        <Link href="/vhr/analytics" className="lg:col-span-1 md:col-span-2">
          <Button className="w-full h-full text-lg py-6 md:py-8" variant="outline">
            <BarChart3 className="mr-2 h-6 w-6" /> View Detailed Analytics
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
         <DataTable
          columns={recentVisitsColumns}
          data={recentSubmittedVisits}
          title="Recent Submitted Visits in Your Vertical (Top 5)"
          emptyStateMessage={isLoading ? "Loading..." : "No recent submitted visits in your vertical."}
        />
      </div>

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
