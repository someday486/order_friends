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
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} interval={0} angle={-35} textAnchor="end" height={60} />
          <YAxis yAxisId="left" tickFormatter={formatNumber} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
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
