"use client";

type KpiCardProps = {
  title: string;
  titleTooltip?: string;
  value: number | string;
  change?: number;
  formatter?: (value: number | string) => string;
};

export default function KpiCard({
  title,
  titleTooltip,
  value,
  change,
  formatter,
}: KpiCardProps) {
  const formattedValue = formatter
    ? formatter(value)
    : typeof value === "number"
      ? value.toLocaleString()
      : value;

  return (
    <div className="card p-4">
      <div className="text-xs text-text-secondary flex items-center gap-1">
        <span>{title}</span>
        {titleTooltip && (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-bg-tertiary text-[10px] text-text-tertiary cursor-help"
            title={titleTooltip}
            aria-label={`${title} 도움말`}
          >
            ?
          </span>
        )}
      </div>
      <div className="text-2xl font-extrabold text-foreground">{formattedValue}</div>
      {change !== undefined && (
        <div className={change >= 0 ? "text-success" : "text-danger-500"}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
