"use client";

type KpiCardProps = {
  title: string;
  value: number | string;
  change?: number;
  formatter?: (value: number | string) => string;
};

export default function KpiCard({ title, value, change, formatter }: KpiCardProps) {
  const formattedValue = formatter
    ? formatter(value)
    : typeof value === "number"
      ? value.toLocaleString()
      : value;

  return (
    <div className="card p-4">
      <div className="text-xs text-text-secondary">{title}</div>
      <div className="text-2xl font-extrabold text-foreground">{formattedValue}</div>
      {change !== undefined && (
        <div className={change >= 0 ? "text-success" : "text-danger-500"}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
