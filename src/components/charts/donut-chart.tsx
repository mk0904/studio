'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChartData } from "@/types";

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DonutChartProps {
  data: ChartData[];
  title: string;
  description?: string;
}

const categoryColors = {
  'Premium': '#9333EA',  // Purple
  'Regular': '#10B981',  // Emerald
  'Small': '#0EA5E9',   // Sky Blue
  'Rural': '#F59E0B',   // Amber
  'Urban': '#6366F1',   // Indigo
  'Uncategorized': '#64748B' // Slate
};

export function DonutChart({ data, title, description }: DonutChartProps) {
  const options: ApexOptions = {
    chart: {
      type: 'donut' as const,
      animations: {
        enabled: true,
        speed: 500,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      fontFamily: 'inherit'
    },
    colors: data.map(item => categoryColors[item.name as keyof typeof categoryColors] || '#64748B'),
    labels: data.map(item => item.name),
    legend: {
      position: 'bottom' as const,
      horizontalAlign: 'center' as const,
      fontSize: '14px',
      markers: {
        size: 8,
        strokeWidth: 0,
        shape: 'circle' as const
      },
      itemMargin: {
        horizontal: 12,
        vertical: 8
      }
    },
    stroke: {
      show: false
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: string) {
        return Math.round(parseFloat(val)) + '%';
      },
      style: {
        fontSize: '12px',
        fontFamily: 'inherit'
      },
      dropShadow: {
        enabled: true,
        opacity: 0.3
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontFamily: 'inherit',
              color: 'hsl(var(--foreground))' as const
            },
            value: {
              show: true,
              fontSize: '22px',
              fontFamily: 'inherit',
              color: 'hsl(var(--foreground))' as const,
              formatter: function(val: string) {
                return parseFloat(val) + ' visits';
              }
            },
            total: {
              show: true,
              label: 'Total Visits',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: 'hsl(var(--foreground))' as const
            }
          }
        }
      }
    },
    tooltip: {
      enabled: true,
      theme: 'dark' as const,
      style: {
        fontSize: '12px',
        fontFamily: 'inherit'
      },
      y: {
        formatter: function(value: number) {
          return value + ' visits';
        }
      }
    },
    states: {
      hover: {
        filter: {
          type: 'darken' as const
        }
      },
      active: {
        filter: {
          type: 'darken' as const
        }
      }
    }
  };

  return (
    <Card className="shadow-lg flex flex-col overflow-hidden bg-gradient-to-br from-white to-slate-50/50 border-slate-200/60">
      <CardHeader className="items-center pb-2">
        <CardTitle className="text-sm font-medium text-[#004C8F]">{title}</CardTitle>
        {description && <CardDescription className="text-xs text-muted-foreground/70">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pb-4">
        <div className="w-full h-[300px] flex items-center justify-center">
          <ApexChart
            type="donut"
            series={data.map(item => item.value)}
            options={options}
            height={300}
          />
        </div>
      </CardContent>
    </Card>
  );
}
