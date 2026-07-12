"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AccuracyPoint } from "@/lib/accuracy-series";

interface ComparisonChartProps {
  data: AccuracyPoint[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** One axis, two series, thin lines, legend always present for 2 series — per the dataviz skill's mark specs. */
export function ComparisonChart({ data }: ComparisonChartProps) {
  if (data.length === 0) {
    return (
      <section className="rounded-xl2 border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-ink">Cumulative accuracy — Aggressive × Conservative</p>
        <p className="mt-1 text-xs text-ink-muted">No graded signals yet for this fixture — the chart appears as soon as the first result is confirmed.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl2 border border-border bg-surface-raised p-5">
      <p className="mb-4 text-sm font-medium text-ink">Cumulative accuracy — Aggressive × Conservative</p>
      <div className="h-64 w-full" style={{ ["--surface" as string]: "var(--surface)" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatTime}
              stroke="var(--ink-muted)"
              tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={formatPercent}
              stroke="var(--ink-muted)"
              tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              formatter={(value: number) => formatPercent(value)}
              labelFormatter={(ts: number) => formatTime(ts)}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--ink)",
              }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: "var(--ink-secondary)", fontSize: 12 }}>
                  {value === "aggressive" ? "Agent-Aggressive" : "Agent-Conservative"}
                </span>
              )}
            />
            <Line
              type="stepAfter"
              dataKey="aggressive"
              name="aggressive"
              stroke="var(--aggressive)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="stepAfter"
              dataKey="conservative"
              name="conservative"
              stroke="var(--conservative)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
