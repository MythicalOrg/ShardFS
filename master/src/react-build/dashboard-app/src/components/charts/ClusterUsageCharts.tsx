// src/components/charts/ClusterUsageChart.tsx
import { useMemo, useEffect, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";

export type UsagePoint = { t: number; logical: number; physical: number };

function fmtBytes(n: number) {
  if (!isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

type Props = {
  data: UsagePoint[];
  // window in seconds to display (default 120 = 2 minutes)
  windowSeconds?: number;
  // number of plotted points (defaults to 60 -> ~1 sample per 2s for 2min window)
  points?: number;
  // desired tick interval for x axis labels in seconds (default 120 = 2 minutes)
  tickIntervalSeconds?: number;
};

// Aggregate raw samples into a fixed number of buckets over the requested window.
function aggregateToBuckets(
  raw: UsagePoint[],
  windowMs: number,
  buckets: number,
  nowOverride?: number
) {
  if (!raw || raw.length === 0) return [];

  // Anchor the window to 'now' (or a provided nowOverride). Using the last
  // sample timestamp here makes the axis 'freeze' until new samples arrive;
  // we want the x-axis to progress in real time, so prefer Date.now().
  const endTs = nowOverride ?? Date.now();
  const startTs = endTs - windowMs;

  // select points inside window (if none, fall back to last N points)
  const inWindow = raw.filter((p) => p.t >= startTs && p.t <= endTs);
  const source = inWindow.length ? inWindow : raw.slice(-buckets * 2);

  const bucketMs = Math.max(1, windowMs / buckets);
  const bucketsArr: { t: number; logical: number; physical: number }[] = [];

  // initialize arrays
  for (let i = 0; i < buckets; i++) {
    const bStart = Math.floor(startTs + i * bucketMs);
    const bCenter = bStart + Math.floor(bucketMs / 2);
    bucketsArr.push({ t: bCenter, logical: 0, physical: 0 });
  }

  const counts = new Array(buckets).fill(0);

  for (const p of source) {
    const idx = Math.floor((p.t - startTs) / bucketMs);
    if (idx < 0) continue;
    const i = Math.min(buckets - 1, idx);
    bucketsArr[i].logical += p.logical;
    bucketsArr[i].physical += p.physical;
    counts[i]++;
  }

  // average and backfill empty buckets with previous value (to make smooth)
  let lastLogical = 0;
  let lastPhysical = 0;
  for (let i = 0; i < buckets; i++) {
    if (counts[i] > 0) {
      bucketsArr[i].logical = Math.round(bucketsArr[i].logical / counts[i]);
      bucketsArr[i].physical = Math.round(bucketsArr[i].physical / counts[i]);
      lastLogical = bucketsArr[i].logical;
      lastPhysical = bucketsArr[i].physical;
    } else {
      bucketsArr[i].logical = lastLogical;
      bucketsArr[i].physical = lastPhysical;
    }
  }

  return bucketsArr;
}

export default function ClusterUsageChart({
  data,
  windowSeconds = 120,
  points = 60,
  tickIntervalSeconds = 120,
}: Props) {
  const windowMs = Math.max(10_000, windowSeconds * 1000);

  // tick 'now' every 2 seconds so the chart's x-axis slides in real time but
  // avoids very frequent re-renders that can feel jumpy.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  const plot = useMemo(() => {
    // aggregate to `points` buckets across the requested window, anchored to nowMs
    const aggregated = aggregateToBuckets(data ?? [], windowMs, points, nowMs);
    return aggregated;
  }, [data, windowMs, points, nowMs]);

  // smoothing: animate towards 'plot' over a few ticks to avoid visible jumps.
  const [smoothedPlot, setSmoothedPlot] = useState(() => plot);
  const smoothedRef = useRef(smoothedPlot);
  useEffect(() => {
    // initialize if size changed
    if (!smoothedRef.current || smoothedRef.current.length !== plot.length) {
      smoothedRef.current = plot.map((p) => ({ ...p }));
      setSmoothedPlot(smoothedRef.current);
    }

    let cancelled = false;
    // each tick move smoothed -> target by alpha. Run until close or for N ticks.
    // use a gentler alpha and allow more ticks for smoother transitions
    const alpha = 0.15; // per-tick smoothing (smaller => smoother)
    let ticks = 0;
    const maxTicks = 12; // allow smoothing to converge over more ticks

    const id = setInterval(() => {
      if (cancelled) return;
      ticks++;
      const next = plot.map((p, i) => {
        const prev = smoothedRef.current[i] ?? {
          t: p.t,
          logical: 0,
          physical: 0,
        };
        const logical = Math.round(
          prev.logical + (p.logical - prev.logical) * alpha
        );
        const physical = Math.round(
          prev.physical + (p.physical - prev.physical) * alpha
        );
        return { t: p.t, logical, physical };
      });
      smoothedRef.current = next;
      setSmoothedPlot(next);

      // stop if close enough or too many ticks
      let maxDiff = 0;
      for (let i = 0; i < plot.length; i++) {
        maxDiff = Math.max(
          maxDiff,
          Math.abs(plot[i].logical - next[i].logical),
          Math.abs(plot[i].physical - next[i].physical)
        );
      }
      if (maxDiff <= 2 || ticks >= maxTicks) {
        clearInterval(id);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [plot]);

  // maxVal was previously computed for Y domain in recharts; ECharts will auto-scale.
  // prepare series data for ECharts: [ [timestamp, value], ... ]
  const seriesLogical = smoothedPlot.map((p) => [p.t, p.logical]);
  const seriesPhysical = smoothedPlot.map((p) => [p.t, p.physical]);

  const tickIntervalMs = Math.max(1_000, tickIntervalSeconds * 1000);

  const option = useMemo(() => {
    type TooltipItem = {
      seriesName?: string;
      data?: unknown[];
      value?: unknown[];
      color?: string;
    };

    // anchor the x-axis to the earliest smoothed sample when available so
    // after a refresh the graph starts from the original upload time.
    const earliest =
      smoothedPlot && smoothedPlot.length > 0
        ? smoothedPlot[0].t
        : nowMs - windowMs;
    // initial max is earliest + window, but don't exceed nowMs
    const initialMax = Math.min(earliest + windowMs, nowMs);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        formatter: (params: unknown) => {
          let arr: TooltipItem[] = [];
          if (Array.isArray(params)) arr = params as TooltipItem[];
          else if (params && typeof params === "object") {
            const p = params as { length?: number } & Record<string, unknown>;
            if (typeof p.length === "number" && p.length > 0)
              arr = params as TooltipItem[];
          }
          if (!arr || !arr.length) return "";
          const first = arr[0];
          const timeVal = first.data?.[0] ?? first.value?.[0];
          const time =
            typeof timeVal === "number" || typeof timeVal === "string"
              ? timeVal
              : 0;

          // Use a dark, slightly opaque background + high-contrast text to
          // ensure tooltip contents are readable on any chart colors.
          const header = `<div style="color:#94a3b8;font-size:12px;margin-bottom:6px">${new Date(
            Number(time)
          ).toLocaleString()}</div>`;
          const rows = arr
            .map((p) => {
              const name = p.seriesName ?? "";
              const v = p.data?.[1] ?? p.value?.[1] ?? 0;
              const val = typeof v === "number" ? v : Number(v) || 0;
              const color = p.color ?? "#fff";
              return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><div style="width:10px;height:10px;background:${color};border-radius:3px;flex:0 0 10px"></div><div style="color:#fff;font-weight:600">${name}</div><div style="color:#cbd5e1;margin-left:8px">${fmtBytes(
                val
              )}</div></div>`;
            })
            .join("");

          return `<div style="background:rgba(2,6,23,0.95);padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);max-width:360px">${header}${rows}</div>`;
        },
      },
      grid: { left: 8, right: 12, top: 18, bottom: 28 },
      xAxis: {
        type: "time",
        // anchor to earliest sample on load so users see original timestamps
        min: earliest,
        max: initialMax,
        interval: tickIntervalMs,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#9CA3AF",
          formatter: (val: number) => {
            const d = new Date(val);
            return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#9CA3AF" },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.06)" } },
      },
      legend: {
        data: ["Logical", "Physical"],
        textStyle: { color: "#C7D2FE" },
        top: 0,
      },
      series: [
        {
          name: "Logical",
          type: "line",
          showSymbol: false,
          smooth: true,
          emphasis: { focus: "series" },
          lineStyle: { width: 2, color: "#7c3aed" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(124,58,237,0.36)" },
              { offset: 1, color: "rgba(124,58,237,0.06)" },
            ]),
          },
          data: seriesLogical,
          animationDuration: 800,
          animationEasing: "cubicOut",
        },
        {
          name: "Physical",
          type: "line",
          showSymbol: false,
          smooth: true,
          emphasis: { focus: "series" },
          lineStyle: { width: 2, color: "#06b6d4" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(6,182,212,0.36)" },
              { offset: 1, color: "rgba(6,182,212,0.06)" },
            ]),
          },
          data: seriesPhysical,
          animationDuration: 800,
          animationEasing: "cubicOut",
        },
      ],
    };
  }, [
    seriesLogical,
    seriesPhysical,
    nowMs,
    windowMs,
    tickIntervalMs,
    smoothedPlot,
  ]);

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-900/60 to-gray-900/30 border border-gray-800">
      <h3 className="text-lg font-semibold text-gray-200 mb-2">
        Cluster Storage Over Time
      </h3>
      <div style={{ width: "100%", height: 340 }}>
        <ReactECharts
          option={option}
          // allow ECharts to merge option updates instead of replacing the
          // whole chart, and avoid forcing immediate re-render to smooth
          // animations in real-time updates.
          notMerge={false}
          lazyUpdate={true}
          style={{ height: "100%", width: "100%" }}
        />
      </div>
      <div className="mt-2 text-xs text-gray-400">
        Showing last {Math.round(windowMs / 1000)}s ({points} points)
      </div>
    </div>
  );
}
