"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BarChartProps = {
  data: Array<object>;
  xKey: string;
  valueKey: string;
  layout?: "vertical" | "horizontal";
  height?: number;
  barColor?: string;
  valueFormatter?: (value: number) => string;
};

const defaultFormatter = (value: number | string | undefined) => {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
};

export default function BarChart({
  data,
  xKey,
  valueKey,
  layout = "vertical",
  height = 260,
  barColor = "#2563eb",
  valueFormatter,
}: BarChartProps) {
  const formatter = valueFormatter
    ? (value: number | string | undefined) =>
        typeof value === "number" ? valueFormatter(value) : value ?? ""
    : defaultFormatter;

  const isVertical = layout === "vertical";

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          {isVertical ? (
            <>
              <XAxis type="number" />
              <YAxis dataKey={xKey} type="category" width={120} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} />
              <YAxis type="number" />
            </>
          )}
          <Tooltip formatter={formatter} />
          <Bar dataKey={valueKey} fill={barColor} radius={[4, 4, 4, 4]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
