"use client";

import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  color: string;
  icon: ReactNode;
  sub?: string;
}

export default function MetricCard({
  label,
  value,
  color,
  icon,
  sub,
}: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-soc-border bg-soc-surface p-5 flex-1 min-w-[150px]">
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${color}44, ${color}, ${color}44)`,
        }}
      />

      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider font-semibold text-soc-muted">
          {label}
        </span>
      </div>

      <div
        className="text-[28px] font-bold font-mono"
        style={{ color }}
      >
        {value}
      </div>

      {sub && (
        <div className="text-[11px] text-soc-dim mt-1">{sub}</div>
      )}
    </div>
  );
}
