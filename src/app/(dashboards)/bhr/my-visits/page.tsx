
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/shared/page-title';
import { DataTable, ColumnConfig } from '@/components/shared/data-table';
import { useAuth } from '@/contexts/auth-context';
import type { Visit } from '@/types';
import { getVisibleVisits } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

const columns: ColumnConfig<Visit>[] = [
  { 
    accessorKey: 'branch_name', 
    header: 'Branch',
  },
  { 
    accessorKey: 'visit_date', 
    header: 'Visit Date',
    cell: (row) => {
      const date = new Date(row.visit_date);
      return (
        <div className="flex flex-col">
          <span>{date.toLocaleDateString()}</span>
          <Badge variant="outline" className="w-fit text-xs mt-1">
            {formatDistanceToNow(date, { addSuffix: true })}
          </Badge>
        </div>
      );
    }
  },
  { 
    accessorKey: 'notes', 
    header: 'Notes',
    cell: (row) => <p className="max-w-md whitespace-pre-wrap break-words">{row.notes}</p>
  },
];

export default function MyVisitsPage() {
  const { user } = useAuth();
  const [myVisits, setMyVisits] = useState<Visit[]>([]);

  useEffect(() => {
    if (user && user.role === 'BHR') {
      const visits = getVisibleVisits(user).sort((a,b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
      setMyVisits(visits);
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageTitle title="My Visit History" description="A log of all branch visits you have conducted." />
      <DataTable
        columns={columns}
        data={myVisits}
        title="All My Visits"
        emptyStateMessage="You haven't logged any visits yet."
      />
    </div>
  );
}
