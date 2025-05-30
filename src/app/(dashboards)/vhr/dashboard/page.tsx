
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import { Users, CalendarCheck, BarChart3, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Visit } from '@/types';

export default function VHRDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [zhrCount, setZhrCount] = useState(0);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalSubmittedVisitsInVertical, setTotalSubmittedVisitsInVertical] = useState(0);

  useEffect(() => {
    if (user && user.role === 'VHR') {
      const fetchData = async () => {
        setIsLoading(true);
        console.log("VHRDashboard: Fetching data for VHR:", user.name);
        try {
          // 1. Fetch ZHRs reporting to this VHR
          const { data: zhrUsersData, error: zhrError } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'ZHR')
            .eq('reports_to', user.id);

          if (zhrError) throw zhrError;
          setZhrCount(zhrUsersData?.length || 0);
          console.log("VHRDashboard: Fetched ZHRs:", zhrUsersData);
          const zhrIds = (zhrUsersData || []).map(z => z.id);

          let bhrUsersInVerticalCount = 0;
          let submittedVisitsData: Visit[] = [];

          if (zhrIds.length > 0) {
            // 2. Fetch BHRs reporting to these ZHRs
            const { data: bhrUsersData, error: bhrError } = await supabase
              .from('users')
              .select('id')
              .eq('role', 'BHR')
              .in('reports_to', zhrIds);

            if (bhrError) throw bhrError;
            bhrUsersInVerticalCount = bhrUsersData?.length || 0;
            console.log("VHRDashboard: Fetched BHRs under ZHRs:", bhrUsersData);
            const bhrIds = (bhrUsersData || []).map(b => b.id);

            if (bhrIds.length > 0) {
              // 3. Fetch submitted visits by these BHRs
              const { data: visitsData, error: visitsError } = await supabase
                .from('visits')
                .select('id') // Only need count for this metric
                .in('bhr_id', bhrIds)
                .eq('status', 'submitted');
              
              if (visitsError) throw visitsError;
              submittedVisitsData = (visitsData as Visit[]) || [];
              setTotalSubmittedVisitsInVertical(submittedVisitsData.length);
              console.log("VHRDashboard: Fetched submitted visits count:", submittedVisitsData.length);
            } else {
              setTotalSubmittedVisitsInVertical(0);
               console.log("VHRDashboard: No BHRs found under ZHRs, so 0 submitted visits.");
            }
          } else {
            setTotalSubmittedVisitsInVertical(0);
            console.log("VHRDashboard: No ZHRs found under VHR, so 0 BHRs and 0 submitted visits.");
          }
          setBhrCount(bhrUsersInVerticalCount);

        } catch (error: any) {
          console.error("VHRDashboard: Error fetching VHR dashboard data:", error);
          toast({ title: "Error", description: `Failed to load dashboard data: ${error.message}`, variant: "destructive" });
          setZhrCount(0);
          setBhrCount(0);
          setTotalSubmittedVisitsInVertical(0);
        } finally {
          setIsLoading(false);
          console.log("VHRDashboard: Fetching data finished.");
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
       {/* Removed chart sections from here */}
    </div>
  );
}
