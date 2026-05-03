"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import type { Ticket } from "@/lib/types";
import { levelColor } from "@/lib/utils";

// ── Shared styles ────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: "#1a2234",
  border: "1px solid #1e2d4a",
  borderRadius: 8,
  fontSize: 12,
};

const PIE_COLORS = ["#ef4444", "#f59e0b", "#22c55e"];

const CARD =
  "bg-soc-surface border border-soc-border rounded-xl p-5";

// ── Data builders ────────────────────────────────────────

function buildAgentData(tickets: Ticket[]) {
  const map: Record<string, number> = {};
  tickets.forEach((t) => {
    const name = t.agent?.name || "unknown";
    map[name] = (map[name] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function buildLevelData(tickets: Ticket[]) {
  const map: Record<number, number> = {};
  tickets.forEach((t) => {
    const lvl = t.rule?.level ?? 0;
    map[lvl] = (map[lvl] || 0) + 1;
  });
  return Object.entries(map)
    .map(([level, count]) => ({ level: +level, count }))
    .sort((a, b) => a.level - b.level);
}

function buildStatusData(tickets: Ticket[]) {
  const map: Record<string, number> = {};
  tickets.forEach((t) => {
    const s = t.status || "open";
    map[s] = (map[s] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

function buildTopRules(tickets: Ticket[], limit = 8) {
  const map: Record<string, number> = {};
  tickets.forEach((t) => {
    const desc = t.rule?.description || "unknown";
    map[desc] = (map[desc] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([rule, count]) => ({
      rule: rule.length > 40 ? rule.slice(0, 38) + "…" : rule,
      count,
    }));
}

function buildMitreData(tickets: Ticket[]) {
  const map: Record<string, number> = {};
  tickets.forEach((t) => {
    (t.rule?.mitre?.tactic || []).forEach((tac: string) => {
      map[tac] = (map[tac] || 0) + 1;
    });
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([tactic, count]) => ({ tactic, count }));
}

// ═══════════════════════════════════════════════════════════
// Exported chart components
// ═══════════════════════════════════════════════════════════

// ── Level bar chart ──────────────────────────────────────

export function LevelChart({ tickets }: { tickets: Ticket[] }) {
  const data = buildLevelData(tickets);

  return (
    <div className={CARD}>
      <div className="text-[13px] font-semibold mb-4">
        Alerts by Rule Level
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" />
          <XAxis dataKey="level" stroke="#4a5a74" fontSize={11} />
          <YAxis stroke="#4a5a74" fontSize={11} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={levelColor(d.level)}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Status pie chart ─────────────────────────────────────

export function StatusPieChart({ tickets }: { tickets: Ticket[] }) {
  const data = buildStatusData(tickets);

  return (
    <div className={CARD}>
      <div className="text-[13px] font-semibold mb-4">
        Status Distribution
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-soc-muted"
          >
            <div
              className="w-2 h-2 rounded-sm"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agent bar chart ──────────────────────────────────────

export function AgentChart({ tickets }: { tickets: Ticket[] }) {
  const data = buildAgentData(tickets);

  return (
    <div className={CARD}>
      <div className="text-[13px] font-semibold mb-4">Alerts per Agent</div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            stroke="#4a5a74"
            fontSize={10}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis stroke="#4a5a74" fontSize={11} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar
            dataKey="count"
            fill="#00b4d8"
            radius={[4, 4, 0, 0]}
            fillOpacity={0.75}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Top rules horizontal bar ─────────────────────────────

export function TopRulesChart({ tickets }: { tickets: Ticket[] }) {
  const data = buildTopRules(tickets);

  return (
    <div className={CARD}>
      <div className="text-[13px] font-semibold mb-4">
        Top Rules Triggered
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" />
          <XAxis type="number" stroke="#4a5a74" fontSize={11} />
          <YAxis
            dataKey="rule"
            type="category"
            width={160}
            stroke="#4a5a74"
            fontSize={10}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar
            dataKey="count"
            fill="#f59e0b"
            radius={[0, 4, 4, 0]}
            fillOpacity={0.75}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Severity area chart ──────────────────────────────────

export function SeverityAreaChart({ tickets }: { tickets: Ticket[] }) {
  const data = buildLevelData(tickets);

  return (
    <div className={CARD}>
      <div className="text-[13px] font-semibold mb-4">
        Severity Distribution
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="lvlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" />
          <XAxis dataKey="level" stroke="#4a5a74" fontSize={11} />
          <YAxis stroke="#4a5a74" fontSize={11} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#ef4444"
            fill="url(#lvlGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── MITRE ATT&CK coverage bars ───────────────────────────

export function MitreChart({ tickets }: { tickets: Ticket[] }) {
  const data = buildMitreData(tickets);
  const max = data[0]?.count || 1;

  return (
    <div className={CARD}>
      <div className="text-[13px] font-semibold mb-4">
        MITRE ATT&CK Coverage
      </div>
      <div className="flex flex-col gap-2">
        {data.length === 0 && (
          <div className="text-center py-8 text-soc-dim text-xs">
            No MITRE data available
          </div>
        )}
        {data.map(({ tactic, count }) => (
          <div key={tactic}>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-soc-muted">{tactic}</span>
              <span className="font-mono text-[11px] text-purple-400">
                {count}
              </span>
            </div>
            <div className="h-1.5 bg-soc-surface2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(count / max) * 100}%`,
                  background:
                    "linear-gradient(90deg, #8b5cf6, #ec4899)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
