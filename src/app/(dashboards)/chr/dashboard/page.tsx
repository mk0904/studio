
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/contexts/auth-context';
import type { User, Visit, Branch } from '@/types';
import { mockUsers, mockVisits, mockBranches, getVisibleUsers } from '@/lib/mock-data';
import { Users, Building, CalendarDays, Globe2, BarChartBig } from 'lucide-react';
import { PlaceholderBarChart } from '@/components/charts/placeholder-bar-chart';
import { PlaceholderPieChart } from '@/components/charts/placeholder-pie-chart';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CHRDashboardPage() {
  const { user } = useAuth();
  const [vhrCount, setVhrCount] = useState(0);
  const [zhrCount, setZhrCount] = useState(0);
  const [bhrCount, setBhrCount] = useState(0);
  const [totalBranches, setTotalBranches] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [visitsByVHRData, setVisitsByVHRData] = useState<{ name: string; value: number }[]>([]);
  const [visitsByBranchTypeData, setVisitsByBranchTypeData] = useState<{ name: string; value: number }[]>([]); // Example: by location or size

  useEffect(() => {
    if (user && user.role === 'CHR') {
      const allUsers = getVisibleUsers(user); // CHR sees all users
      setVhrCount(allUsers.filter(u => u.role === 'VHR').length);
      setZhrCount(allUsers.filter(u => u.role === 'ZHR').length);
      setBhrCount(allUsers.filter(u => u.role === 'BHR').length);
      
      setTotalBranches(mockBranches.length);
      setTotalVisits(mockVisits.length);

      // Visits per VHR for chart
      const visitsPerVhrMap = new Map<string, number>();
      mockVisits.forEach(visit => {
        const bhr = allUsers.find(u => u.id === visit.bhr_id);
        if (bhr) {
          const zhr = allUsers.find(u => u.id === bhr.reports_to);
          if (zhr) {
            const vhr = allUsers.find(u => u.id === zhr.reports_to && u.role === 'VHR');
            if (vhr) {
              visitsPerVhrMap.set(vhr.name, (visitsPerVhrMap.get(vhr.name) || 0) + 1);
            }
          }
        }
      });
      setVisitsByVHRData(Array.from(visitsPerVhrMap).map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` })));
      
      // Example: Visits by branch location (dummy data for pie chart)
      const visitsByLocation = mockBranches.reduce((acc, branch) => {
        const locationVisits = mockVisits.filter(v => v.branch_id === branch.id).length;
        acc[branch.location] = (acc[branch.location] || 0) + locationVisits;
        return acc;
      }, {} as Record<string, number>);
      setVisitsByBranchTypeData(
        Object.entries(visitsByLocation)
          .filter(([,value]) => value > 0) // Only show locations with visits
          .map(([name, value]) => ({ name, value, fill: `hsl(var(--chart-${(Math.floor(Math.random()*5)+1)}))` }))
          .slice(0,5) // Top 5 locations
      );


    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="CHR Dashboard" description="Global Human Resources Overview." />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total VHRs" value={vhrCount} icon={Users} />
        <StatCard title="Total ZHRs" value={zhrCount} icon={Users} />
        <StatCard title="Total BHRs" value={bhrCount} icon={Users} />
        <StatCard title="Total Branches" value={totalBranches} icon={Building} />
        <StatCard title="Total Visits Logged" value={totalVisits} icon={CalendarDays} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/chr/analytics" className="md:col-span-1">
          <Button className="w-full h-full text-lg py-8" variant="outline">
            <BarChartBig className="mr-2 h-8 w-8" /> View Deep Analytics
          </Button>
        </Link>
        <Link href="/chr/global-overview" className="md:col-span-1">
          <Button className="w-full h-full text-lg py-8" variant="outline">
            <Globe2 className="mr-2 h-8 w-8" /> AI Summary & Overview
          </Button>
        </Link>
         {/* Placeholder for another quick action or stat */}
        <StatCard title="Avg Visits/Branch" value={(totalVisits / (totalBranches || 1)).toFixed(1)} icon={TrendingUp} description="Average visits per branch"/>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderBarChart
          data={visitsByVHRData}
          title="Visits per VHR Vertical"
          description="Total visits across different VHR-led verticals."
          xAxisKey="name"
          dataKey="value"
        />
        <PlaceholderPieChart
          data={visitsByBranchTypeData}
          title="Visits by Branch Location (Top 5)"
          description="Distribution of visits across main branch locations."
          dataKey="value"
          nameKey="name"
        />
      </div>
    </div>
  );
}
