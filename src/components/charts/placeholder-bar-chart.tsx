
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartData } from "@/types"

interface PlaceholderBarChartProps {
  data: ChartData[];
  title: string;
  description?: string;
  xAxisKey: string;
  dataKey: string;
  fillColor?: string; // e.g. "var(--color-desktop)"
}

const chartConfig = {
  value: {
    label: "Count",
    color: "hsl(var(--chart-1))",
  },
} // satisfies ChartConfig // If ChartConfig is exported from ui/chart

export function PlaceholderBarChart({ 
  data, 
  title, 
  description, 
  xAxisKey, 
  dataKey,
  fillColor
}: PlaceholderBarChartProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxisKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              // tickFormatter={(value) => value.slice(0, 3)} // Example formatter
            />
            <YAxis />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar dataKey={dataKey} fill={fillColor || "hsl(var(--chart-1))"} radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
