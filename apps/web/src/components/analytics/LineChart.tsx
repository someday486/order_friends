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
}: LineChartProps) {
  const formatter = (value: number | string | undefined, name?: string) => {
    if (tooltipFormatter && typeof value === "number") {
      return tooltipFormatter(value, name);
    }
    return defaultFormatter(value);
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip formatter={formatter} />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={2}
              name={line.name}
              yAxisId={line.yAxisId}
              dot={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
