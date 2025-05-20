
import * as React from "react";
import { Line, Bar, Area, ResponsiveContainer } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface ChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showGridLines?: boolean;
  startEndOnly?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  index,
  categories,
  colors = ["blue"],
  valueFormatter = (value) => `${value}`,
  showLegend = true,
  showGridLines = false,
  startEndOnly = false,
  className,
}: ChartProps) {
  // Create config for chart
  const config = categories.reduce(
    (acc, category, i) => ({
      ...acc,
      [category]: {
        label: category,
        color: colors[i % colors.length],
      },
    }),
    {}
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartContainer config={config}>
          <>
            <ChartTooltip content={<ChartTooltipContent />} />
            {categories.map((category, i) => (
              <Area
                key={category}
                dataKey={category}
                type="monotone"
                stroke={config[category].color || colors[i % colors.length]}
                fillOpacity={0.2}
                fill={config[category].color || colors[i % colors.length]}
                data={data}
              />
            ))}
          </>
        </ChartContainer>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart({
  data,
  index,
  categories,
  colors = ["blue"],
  valueFormatter = (value) => `${value}`,
  showLegend = true,
  showGridLines = false,
  startEndOnly = false,
  className,
}: ChartProps) {
  // Create config for chart
  const config = categories.reduce(
    (acc, category, i) => ({
      ...acc,
      [category]: {
        label: category,
        color: colors[i % colors.length],
      },
    }),
    {}
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartContainer config={config}>
          <>
            <ChartTooltip content={<ChartTooltipContent />} />
            {categories.map((category, i) => (
              <Bar
                key={category}
                dataKey={category}
                fill={config[category].color || colors[i % colors.length]}
                data={data}
              />
            ))}
          </>
        </ChartContainer>
      </ResponsiveContainer>
    </div>
  );
}
