
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define a generic ColumnConfig type
export interface ColumnConfig<T> {
  accessorKey: keyof T | string; // Allow string for custom accessors or nested paths
  header: string;
  cell?: (row: T) => React.ReactNode; // Custom cell renderer
  enableSorting?: boolean; // Future enhancement
}

interface DataTableProps<T> {
  columns: ColumnConfig<T>[];
  data: T[];
  caption?: string;
  title?: string;
  emptyStateMessage?: string;
  tableClassName?: string;
}

export function DataTable<T>({
  columns,
  data,
  caption,
  title,
  emptyStateMessage = "No data available.",
  tableClassName,
}: DataTableProps<T>) {
  
  const renderCellContent = (item: T, column: ColumnConfig<T>) => {
    if (column.cell) {
      return column.cell(item);
    }
    // Basic accessor for non-nested properties
    const value = item[column.accessorKey as keyof T];
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value ?? ''); // Handle null/undefined
  };

  return (
    <div className="w-full">
      {title && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
      )}
      <div className="-mx-4 sm:mx-0 overflow-x-auto">
        <Table className={cn('min-w-full', tableClassName)}>
          {caption && <TableCaption>{caption}</TableCaption>}
          <TableHeader>
            <TableRow className="border-0">
              {columns.map((column) => (
                <TableHead 
                  key={String(column.accessorKey)} 
                  className="whitespace-nowrap border-0 bg-slate-50/80 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium text-slate-600"
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data && data.length > 0 ? (
              data.map((item, rowIndex) => (
                <TableRow 
                  key={`row-${rowIndex}`} 
                  className="border-0 hover:bg-blue-50/30 transition-colors"
                >
                  {columns.map((column) => (
                    <TableCell 
                      key={`${String(column.accessorKey)}-${rowIndex}`} 
                      className="whitespace-nowrap border-0 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm"
                    >
                      {renderCellContent(item, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="border-0">
                <TableCell 
                  colSpan={columns.length} 
                  className="h-20 sm:h-24 text-center text-xs sm:text-sm text-slate-500 border-0"
                >
                  {emptyStateMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
