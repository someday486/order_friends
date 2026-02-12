"use client";

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type LineSeries = {
  dataKey: string;
  color: string;
  name?: string;
  yAxisId?: string;
};

type LineChartProps = {
  data: Array<object>;
  xKey: string;
  lines: LineSeries[];
  height?: number;
  tooltipFormatter?: (value: number, name?: string) => string;
  xTickFormatter?: (value: string | number) => string;
  xTickInterval?: number | "preserveStart" | "preserveEnd" | "preserveStartEnd";
  leftTickFormatter?: (value: number | string) => string;
  rightTickFormatter?: (value: number | string) => string;
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

export default function LineChart({
  data,
  xKey,
  lines,
  height = 260,
  tooltipFormatter,
  xTickFormatter,
  xTickInterval = "preserveStartEnd",
  leftTickFormatter,
  rightTickFormatter,
}: LineChartProps) {
  const usesRightAxis = lines.some((line) => line.yAxisId === "right");
  const formatter = (value: number | string | undefined, name?: string) => {
    if (tooltipFormatter && typeof value === "number") {
      return tooltipFormatter(value, name);
    }
    return defaultFormatter(value);
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            interval={xTickInterval}
            tickFormatter={xTickFormatter}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
            tickMargin={10}
            minTickGap={20}
            height={44}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
            tickMargin={8}
            tickFormatter={leftTickFormatter}
          />
          {usesRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              tick={{ fontSize: 12, fill: "var(--color-text-secondary)" }}
              tickMargin={8}
              allowDecimals={false}
              tickFormatter={rightTickFormatter}
            />
          )}
          <Tooltip formatter={formatter} />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={2}
              name={line.name}
              yAxisId={line.yAxisId || "left"}
              dot={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
