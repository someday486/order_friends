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

// ✅ 코드(영문) -> 한글 라벨
const SEGMENT_LABEL: Record<string, string> = {
  Champions: "최우수고객",
  Loyal: "충성고객",
  Potential: "잠재고객",
  New: "신규고객",
  Lost: "이탈고객",
  "At Risk": "위험고객",
};

// ✅ 코드(영문) -> 색상
const SEGMENT_COLORS: Record<string, string> = {
  Champions: "#ef4444",
  Loyal: "#22c55e",
  New: "#a855f7",
  Potential: "#f59e0b",
  "At Risk": "#f97316",
  Lost: "#64748b",
};

// ✅ 범례 순서도 코드(영문) 기준
const LEGEND_ORDER = ["Champions", "Loyal", "Potential", "New", "At Risk", "Lost"];


// ✅ 여기에 추가
function RfmTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const p = payload[0].payload as RfmPoint;

  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-3 py-2 shadow-lg">
      <div className="text-xs font-semibold text-foreground mb-1">
        고객군: {SEGMENT_LABEL[p.segment] ?? p.segment}
      </div>

      <div className="space-y-0.5 text-xs text-text-secondary">
        <div>마지막 주문: {p.recency}일 전</div>
        <div>총 방문: {p.frequency}회</div>
        <div>총 구매금액: ₩{Number(p.monetary).toLocaleString()}</div>
      </div>
    </div>
  );
}

export default function RfmScatterChart({ data, height = 320 }: RfmScatterChartProps) {
  const normalized = data.map((d) => ({
    ...d,
    recency: Number(d.recency),
    frequency: Number(d.frequency),
    monetary: Number(d.monetary),
    segment: String(d.segment), // ✅ 코드 유지
  }));

  const grouped = normalized.reduce<Record<string, RfmPoint[]>>((acc, item) => {
    (acc[item.segment] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart margin={{ top: 30, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="recency"
            name="마지막 주문 이후 경과일"
            label={{
              value: "마지막 주문 이후 경과일",
              position: "insideBottom",
              offset: -5,
              style: { fontSize: 12, fill: "var(--color-text-secondary)" },
            }}
            tickFormatter={(value) => `${value}일`}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            dataKey="frequency"
            name="방문 횟수"
            label={{
              value: "방문 횟수",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: "var(--color-text-secondary)" },
            }}
            tick={{ fontSize: 12 }}
          />
          <ZAxis dataKey="monetary" name="금액" range={[20, 120]} />
          
          <Tooltip content={<RfmTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 13, fontSize: 14 }} />
          {LEGEND_ORDER
            .filter((segment) => grouped[segment]?.length)
            .map((segment) => (
              <Scatter
                key={segment}
                data={grouped[segment]}
                name={SEGMENT_LABEL[segment] ?? segment} // ✅ 범례는 한글
                fill={SEGMENT_COLORS[segment] ?? "#94a3b8"} // ✅ 색상은 코드 기준으로 안정
              />
            ))}
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
