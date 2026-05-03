"use client";

import { useState, useMemo } from "react";
import { Plus, Search, FolderOpen, ChevronRight } from "lucide-react";
import type { Case } from "@/lib/types";

interface CaseSidebarProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (c: Case | null) => void;
  onNewCase: () => void;
  loading?: boolean;
}

function SeverityDot({ severity }: { severity?: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500",
    high:     "bg-orange-400",
    medium:   "bg-yellow-400",
    low:      "bg-blue-400",
  };
  return (
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[severity || "medium"] || "bg-soc-dim"}`} />
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const styles: Record<string, string> = {
    critical: "text-red-400 bg-red-500/10 border-red-500/20",
    high:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
    medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    low:      "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${styles[severity || "medium"] || styles.medium}`}>
      {severity || "medium"}
    </span>
  );
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CaseSidebar({
  cases,
  selectedCaseId,
  onSelectCase,
  onNewCase,
  loading,
}: CaseSidebarProps) {
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return (cases ?? []).filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.title?.toLowerCase().includes(q) &&
          !(c.assigned || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [cases, search, statusFilter]);

  return (
    <div className="w-[280px] shrink-0 bg-soc-surface border border-soc-border rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-3 border-b border-soc-border bg-soc-surface2">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-soc-accent" />
            <span className="text-[11px] text-soc-muted uppercase tracking-wider font-semibold">Cases</span>
            <span className="font-mono text-[10px] bg-soc-surface border border-soc-border px-1.5 py-0.5 rounded text-soc-muted">
              {(cases ?? []).length}
            </span>
          </div>
          <button
            onClick={onNewCase}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-soc-accent text-soc-bg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-soc-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases…"
            className="w-full pl-6 pr-2 py-1.5 bg-soc-surface border border-soc-border rounded-md text-[11px] text-soc-text outline-none focus:border-soc-accent transition-colors"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-0.5">
          {["all", "open", "investigating", "closed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 py-1 rounded text-[10px] font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-soc-accent/10 text-soc-accent border border-soc-accent/30"
                  : "text-soc-muted border border-transparent hover:text-soc-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* All events option */}
      <button
        onClick={() => onSelectCase(null)}
        className={`flex items-center gap-2 px-3.5 py-2.5 border-b border-soc-border text-left transition-colors ${
          selectedCaseId === null
            ? "bg-soc-accent/5 border-l-2 border-l-soc-accent"
            : "hover:bg-soc-surface2 border-l-2 border-l-transparent"
        }`}
      >
        <span className="text-[12px] font-semibold text-soc-text">All Events</span>
        <ChevronRight className={`w-3 h-3 ml-auto ${selectedCaseId === null ? "text-soc-accent" : "text-soc-dim"}`} />
      </button>

      {/* Case list */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="text-center py-6 text-[12px] text-soc-muted animate-pulse">Loading cases…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-6 text-[12px] text-soc-dim">
            {(cases ?? []).length === 0 ? "No cases yet" : "No matches"}
          </div>
        )}

        {filtered.map((c) => {
          const isSelected = selectedCaseId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelectCase(c)}
              className={`w-full text-left px-3.5 py-2.5 border-b border-soc-border/50 transition-all duration-150 ${
                isSelected
                  ? "bg-soc-accent/5 border-l-2 border-l-soc-accent"
                  : "hover:bg-soc-surface2 border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <SeverityDot severity={c.severity} />
                <SeverityBadge severity={c.severity} />
                <span className="ml-auto font-mono text-[10px] text-soc-dim">
                  {timeAgo(c.created_at)}
                </span>
              </div>
              <div className="text-[12px] font-semibold text-soc-text truncate mb-1">
                {c.title}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-soc-dim">
                {c.assigned && <span>{c.assigned}</span>}
                <span className="ml-auto font-mono bg-soc-surface2 border border-soc-border px-1 py-0.5 rounded">
                  {c.ticket_count ?? 0} events
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
