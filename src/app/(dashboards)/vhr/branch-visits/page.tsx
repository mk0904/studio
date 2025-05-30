
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit } from '@/types';
import { getVisibleVisits } from '@/lib/mock-data';
import { format } from 'date-fns';
// Filters could be added here similar to ZHR's visits-made page if complex filtering is needed

const columns: ColumnConfig<Visit>[] = [
  { 
    accessorKey: 'bhr_name', 
    header: 'BHR Name',
    cell: (row) => {
        // In a real app, you'd fetch the ZHR this BHR reports to.
        // For mock, we can just display BHR name.
        return row.bhr_name;
    }
  },
  { accessorKey: 'branch_name', header: 'Branch Name' },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => format(new Date(row.visit_date), 'PPP') 
  },
  { 
    accessorKey: 'notes', 
    header: 'Notes',
    cell: (row) => <p className="max-w-md whitespace-pre-wrap break-words">{row.notes}</p>
  },
];

export default function VHRBranchVisitsPage() {
  const { user } = useAuth();
  const [allVisits, setAllVisits] = useState<Visit[]>([]);

  useEffect(() => {
    if (user && user.role === 'VHR') {
      const visits = getVisibleVisits(user).sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
      setAllVisits(visits);
    }
  }, [user]);


  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="All Branch Visits in Vertical" description="A comprehensive log of all visits within your vertical." />
      {/* Add filter components here if needed */}
      <DataTable
        columns={columns}
        data={allVisits}
        emptyStateMessage="No visits recorded in your vertical yet."
      />
    </div>
  );
}
