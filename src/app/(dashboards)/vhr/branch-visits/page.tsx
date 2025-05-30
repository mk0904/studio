
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit } from '@/types';
import { getVisibleVisits, mockBranches, mockUsers } from '@/lib/mock-data'; 
import { format } from 'date-fns';

const columns: ColumnConfig<Visit>[] = [
  { 
    accessorKey: 'bhr_id', 
    header: 'BHR Name',
    cell: (row) => {
        const bhr = mockUsers.find(u => u.id === row.bhr_id);
        return bhr ? bhr.name : 'N/A';
    }
  },
  { 
    accessorKey: 'branch_id', 
    header: 'Branch Name',
    cell: (row) => {
        const branch = mockBranches.find(b => b.id === row.branch_id);
        return branch ? branch.name : 'N/A';
    }
  },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => format(new Date(row.visit_date), 'PPP') 
  },
  { 
    accessorKey: 'additional_remarks', 
    header: 'Remarks', 
    cell: (row) => <p className="max-w-md whitespace-pre-wrap break-words">{row.additional_remarks}</p>
  },
];

export default function VHRBranchVisitsPage() {
  const { user } = useAuth();
  const [allSubmittedVisits, setAllSubmittedVisits] = useState<Visit[]>([]);

  useEffect(() => {
    if (user && user.role === 'VHR') {
      // getVisibleVisits for VHR will now only return 'submitted' visits
      const visits = getVisibleVisits(user).sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
      setAllSubmittedVisits(visits);
    }
  }, [user]);


  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="All Submitted Branch Visits in Vertical" description="A comprehensive log of all submitted visits within your vertical." />
      <DataTable
        columns={columns}
        data={allSubmittedVisits}
        emptyStateMessage="No submitted visits recorded in your vertical yet."
      />
    </div>
  );
}
