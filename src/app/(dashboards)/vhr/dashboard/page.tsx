
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { mockUsers, mockVisits, mockBranches, getVisibleUsers, getVisibleVisits } from '@/lib/mock-data';
import { Users, CalendarCheck, Building, BarChart3, TrendingUp } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';


export default function VHRDashboardPage() {
  const { user } = useAuth();
  const [zhrCount, setZhrCount] = useState(0);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalVisitsInVertical, setTotalVisitsInVertical] = useState(0);
  const [topPerformingBranches, setTopPerformingBranches] = useState<{ name: string; value: number }[]>([]);
  const [visitsByZHRData, setVisitsByZHRData] = useState<{name: string, value: number}[]>([]);


  useEffect(() => {
    if (user && user.role === 'VHR') {
      const usersInVertical = getVisibleUsers(user);
      const zhrsInVertical = usersInVertical.filter(u => u.role === 'ZHR' && u.reports_to === user.id);
      setZhrCount(zhrsInVertical.length);

      const bhrsInVertical = usersInVertical.filter(u => u.role === 'BHR' && zhrsInVertical.find(z => z.id === u.reports_to));
      setBhrCount(bhrsInVertical.length);

      const visitsInVertical = getVisibleVisits(user);
      setTotalVisitsInVertical(visitsInVertical.length);

      // Top performing branches (by visit count for simplicity)
      const visitsPerBranch = visitsInVertical.reduce((acc, visit) => {
        acc[visit.branch_name] = (acc[visit.branch_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const sortedBranches = Object.entries(visitsPerBranch)
        .map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setTopPerformingBranches(sortedBranches);

      // Visits per ZHR
      const visitsPerZHRMap = new Map<string, number>();
      visitsInVertical.forEach(visit => {
        const bhr = usersInVertical.find(u => u.id === visit.bhr_id);
        if (bhr) {
          const zhr = usersInVertical.find(u => u.id === bhr.reports_to && u.role === 'ZHR');
          if (zhr) {
             visitsPerZHRMap.set(zhr.name, (visitsPerZHRMap.get(zhr.name) || 0) + 1);
          }
        }
      });
      setVisitsByZHRData(Array.from(visitsPerZHRMap).map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` })));


    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="VHR Dashboard" description={`Vertical overview for ${user.name}.`} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="ZHRs in Vertical" value={zhrCount} icon={Users} description="Total ZHRs reporting to you." />
        <StatCard title="BHRs in Vertical" value={bhrCount} icon={Users} description="Total BHRs under your ZHRs." />
        <StatCard title="Total Visits in Vertical" value={totalVisitsInVertical} icon={CalendarCheck} description="All visits across your vertical." />
        <Link href="/vhr/analytics">
          <Button className="w-full h-full text-lg" variant="outline">
            <BarChart3 className="mr-2 h-6 w-6" /> View Detailed Analytics
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderBarChart
          data={topPerformingBranches}
          title="Top Branches by Visit Count"
          description="Branches with the most HR visits in your vertical."
          xAxisKey="name"
          dataKey="value"
        />
        <PlaceholderPieChart
          data={visitsByZHRData}
          title="Visits Distribution by ZHR"
          description="Breakdown of visits by ZHRs in your vertical."
          dataKey="value"
          nameKey="name"
        />
      </div>
    </div>
  );
}
