"use client";

type HeatmapTableProps = {
  rows: string[];
  columns: string[];
  values: number[][];
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
  baseColor?: string;
};

const defaultFormatter = (value: number) => value.toFixed(1);

export default function HeatmapTable({
  rows,
  columns,
  values,
  valueFormatter = defaultFormatter,
  emptyLabel = "-",
  baseColor = "37,99,235",
}: HeatmapTableProps) {
  const maxValue = values.flat().reduce((max, value) => Math.max(max, value), 0);

  const getCellStyle = (value: number) => {
    if (value <= 0 || maxValue <= 0) {
      return { backgroundColor: "transparent" };
    }
    const intensity = Math.min(0.9, Math.max(0.1, value / maxValue));
    return { backgroundColor: `rgba(${baseColor}, ${intensity})` };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="text-left py-2 px-2 text-text-secondary font-semibold">항목</th>
            {columns.map((column) => (
              <th key={column} className="text-center py-2 px-2 text-text-secondary font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row} className="border-t border-border">
              <td className="py-2 px-2 text-foreground font-medium whitespace-nowrap">{row}</td>
              {columns.map((column, columnIndex) => {
                const value = values[rowIndex]?.[columnIndex] ?? 0;
                return (
                  <td
                    key={`${row}-${column}`}
                    className="py-2 px-2 text-center text-foreground"
                    style={getCellStyle(value)}
                    title={value > 0 ? valueFormatter(value) : emptyLabel}
                  >
                    {value > 0 ? valueFormatter(value) : emptyLabel}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
