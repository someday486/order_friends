"use client";

import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

type PieChartProps = {
  data: Array<object>;
  nameKey: string;
  valueKey: string;
  height?: number;
  colors?: string[];
};

const defaultColors = [
  "#2563eb",
  "#22c55e",
  "#f97316",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#eab308",
  "#64748b",
];

export default function PieChart({
  data,
  nameKey,
  valueKey,
  height = 260,
  colors = defaultColors,
}: PieChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
          >
            {data.map((entry, index) => {
              const nameValue = (entry as Record<string, unknown>)[nameKey];
              return (
                <Cell
                  key={`${String(nameValue)}-${index}`}
                  fill={colors[index % colors.length]}
                />
              );
            })}
          </Pie>
          <Tooltip />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            layout="horizontal"
            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
