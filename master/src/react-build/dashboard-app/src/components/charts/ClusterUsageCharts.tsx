// src/components/charts/ClusterUsageChart.tsx
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export type UsagePoint = { t: number; logical: number; physical: number };

export default function ClusterUsageChart({ data }: { data: UsagePoint[] }) {
  // convert bytes to human-readable label in tooltip if needed
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-900/60 to-gray-900/30 border border-gray-800">
      <h3 className="text-lg font-semibold text-gray-200 mb-2">
        Cluster Storage Over Time
      </h3>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <CartesianGrid opacity={0.06} />
            <XAxis
              dataKey="t"
              tickFormatter={(v) => new Date(v).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })}
            />
            <YAxis
              tickFormatter={(v) => `${(v / (1024 * 1024)).toFixed(1)} MB`}
            />
            <Tooltip
              formatter={(v: number) => `${(v / (1024 * 1024)).toFixed(2)} MB`}
              labelFormatter={(l) => new Date(l).toLocaleString()}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="logical"
              name="Logical"
              stroke="#7c3aed"
              fillOpacity={0.15}
            />
            <Area
              type="monotone"
              dataKey="physical"
              name="Physical"
              stroke="#06b6d4"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
