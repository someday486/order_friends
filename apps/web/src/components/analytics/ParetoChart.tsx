"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ParetoChartProps = {
  data: Array<object>;
  xKey: string;
  barKey: string;
  lineKey: string;
  height?: number;
  barColor?: string;
  lineColor?: string;
  barName?: string;
  lineName?: string;
};

const formatNumber = (value: number | string | undefined) => {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const formatLabel = (value: number | string | undefined, maxLength = 12) => {
  if (value === null || value === undefined) return "";
  const label = String(value);
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
};

export default function ParetoChart({
  data,
  xKey,
  barKey,
  lineKey,
  height = 280,
  barColor = "#2563eb",
  lineColor = "#22c55e",
  barName,
  lineName,
}: ParetoChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            interval="preserveStartEnd"
            angle={-28}
            textAnchor="end"
            tickFormatter={formatLabel}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
            tickMargin={12}
            minTickGap={12}
            height={76}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatNumber}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
            tickMargin={8}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
            tickMargin={8}
          />
          <Tooltip
            formatter={(value, name) => {
              const normalized = Array.isArray(value) ? value[0] : value;
              if (name === lineName || name === lineKey) {
                return [
                  `${Number(normalized).toFixed(1)}%`,
                  lineName ?? "누적 비율",
                ];
              }
              return [formatNumber(normalized), barName ?? "매출"];
            }}
          />
          <Bar
            yAxisId="left"
            dataKey={barKey}
            fill={barColor}
            name={barName}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={lineKey}
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            name={lineName}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
