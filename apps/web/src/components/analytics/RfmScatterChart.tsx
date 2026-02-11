"use client";

import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type RfmPoint = {
  recency: number;
  frequency: number;
  monetary: number;
  segment: string;
};

type RfmScatterChartProps = {
  data: RfmPoint[];
  height?: number;
};

const SEGMENT_COLORS: Record<string, string> = {
  Champions: "#2563eb",
  Loyal: "#22c55e",
  Potential: "#f59e0b",
  New: "#a855f7",
  "At Risk": "#ef4444",
  Lost: "#64748b",
};

export default function RfmScatterChart({ data, height = 320 }: RfmScatterChartProps) {
  const grouped = data.reduce<Record<string, RfmPoint[]>>((acc, item) => {
    if (!acc[item.segment]) {
      acc[item.segment] = [];
    }
    acc[item.segment].push(item);
    return acc;
  }, {});

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="recency"
            name="Recency"
            tickFormatter={(value) => `${value}일`}
          />
          <YAxis dataKey="frequency" name="Frequency" />
          <ZAxis dataKey="monetary" range={[60, 260]} name="Monetary" />
          <Tooltip
            formatter={(value, name) => {
              if (name === "Recency") return [`${value}일`, name];
              if (name === "Frequency") return [value, name];
              if (name === "Monetary") return [`₩${Number(value).toLocaleString()}`, name];
              return [value, name];
            }}
          />
          <Legend />
          {Object.entries(grouped).map(([segment, items]) => (
            <Scatter
              key={segment}
              data={items}
              name={segment}
              fill={SEGMENT_COLORS[segment] ?? "#94a3b8"}
            />
          ))}
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
