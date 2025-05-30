
'use client';

import React from 'react';
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
}

export function DataTable<T>({
  columns,
  data,
  caption,
  title,
  emptyStateMessage = "No data available.",
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
    <Card className="shadow-lg">
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            {caption && <TableCaption>{caption}</TableCaption>}
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={String(column.accessorKey)} className="whitespace-nowrap">
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.length > 0 ? (
                data.map((item, rowIndex) => (
                  <TableRow key={`row-${rowIndex}`}>
                    {columns.map((column) => (
                      <TableCell key={`${String(column.accessorKey)}-${rowIndex}`} className="whitespace-nowrap">
                        {renderCellContent(item, column)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {emptyStateMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
