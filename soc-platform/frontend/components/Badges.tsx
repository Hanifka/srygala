"use client";

import { levelColor, levelLabel, statusColor } from "@/lib/utils";

export function StatusBadge({ status }: { status?: string }) {
  const c = statusColor(status);
  const icon = status === "open" ? "●" : status === "investigating" ? "◐" : "✓";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize tracking-wide"
      style={{ background: c + "18", color: c, border: `1px solid ${c}30` }}
    >
      <span className="text-[8px]">{icon}</span>
      {status || "—"}
    </span>
  );
}

export function LevelBadge({ level }: { level?: number }) {
  const c = levelColor(level);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold"
      style={{ background: c + "20", color: c }}
    >
      {level ?? "—"}
    </span>
  );
}

export function LevelBadgeWithLabel({ level }: { level?: number }) {
  const c = levelColor(level);
  return (
    <div className="flex items-center gap-2">
      <LevelBadge level={level} />
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: c }}>
        {levelLabel(level)}
      </span>
    </div>
  );
}

export function MitreBadge({ label }: { label: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
      {label}
    </span>
  );
}
