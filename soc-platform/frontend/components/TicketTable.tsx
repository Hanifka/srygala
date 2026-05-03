"use client";

import { useState, useMemo } from "react";
import { Search, Trash2, Eye, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { formatTimestamp, flattenAgent, flattenRule } from "@/lib/utils";
import { StatusBadge, LevelBadge } from "./Badges";

interface TicketTableProps {
  tickets: Ticket[];
  onInspect: (ticket: Ticket) => void;
  onDelete: (ids: string[]) => void;
}

type SortField = "timestamp" | "level" | "agent" | "status" | "assigned";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-soc-accent" />
    : <ChevronDown className="w-3 h-3 text-soc-accent" />;
}

function SortableHeader({ field, label, sortField, sortDir, onSort }: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-soc-text transition-colors"
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );
}

export default function TicketTable({
  tickets,
  onInspect,
  onDelete,
}: TicketTableProps) {
  const [search, setSearch] = useState("");
  const [minLevel, setMinLevel] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    const result = tickets.filter((t) => {
      const desc = (t.rule?.description || "").toLowerCase();
      const agent = flattenAgent(t.agent).toLowerCase();
      const q = search.toLowerCase();

      if (q && !desc.includes(q) && !agent.includes(q)) return false;
      if ((t.rule?.level ?? 0) < minLevel) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortField) {
        case "timestamp":
          valA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          valB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          break;
        case "level":
          valA = a.rule?.level ?? 0;
          valB = b.rule?.level ?? 0;
          break;
        case "agent":
          valA = flattenAgent(a.agent).toLowerCase();
          valB = flattenAgent(b.agent).toLowerCase();
          break;
        case "status":
          valA = a.status || "";
          valB = b.status || "";
          break;
        case "assigned":
          valA = a.assigned || "";
          valB = b.assigned || "";
          break;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [tickets, search, minLevel, statusFilter, sortField, sortDir]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };

  const handleDelete = () => {
    onDelete(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <div className="animate-fade-in">
      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-soc-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts…"
            className="w-full pl-8"
          />
        </div>

        {/* Min level */}
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-soc-muted">Min Level</label>
          <input
            type="number"
            value={minLevel}
            onChange={(e) => setMinLevel(+e.target.value)}
            min={0}
            max={15}
            className="w-14 text-center"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="closed">Closed</option>
        </select>

        <div className="flex-1" />

        {/* Bulk delete */}
        {selected.size > 0 && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 bg-red-500/10 text-red-400 px-4 py-1.5 rounded-md text-xs font-semibold border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {selected.size}
          </button>
        )}

        <span className="font-mono text-[11px] text-soc-dim">
          {filtered.length} cases
        </span>
      </div>

      {/* ── Table ───────────────────────────────────── */}
      <div className="bg-soc-surface border border-soc-border rounded-xl overflow-hidden">
        {/* Header */}
        <div
          className="grid px-4 py-2.5 bg-soc-surface2 border-b border-soc-border text-[10px] font-semibold text-soc-muted uppercase tracking-wider"
          style={{
            gridTemplateColumns: "40px 52px 110px 1fr 100px 90px 130px 48px",
          }}
        >
          <div>
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 cursor-pointer accent-soc-accent"
            />
          </div>
          <div>
            <SortableHeader field="level" label="Lvl" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>
          <div>
            <SortableHeader field="agent" label="Agent" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>
          <div>Description</div>
          <div>
            <SortableHeader field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>
          <div>
            <SortableHeader field="assigned" label="Assigned" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>
          <div>
            <SortableHeader field="timestamp" label="Time" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
          </div>
          <div />
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          {filtered.map((t, i) => {
            const isSelected = selected.has(t.id);
            return (
              <div
                key={t.id}
                className="table-row grid px-4 py-2.5 items-center text-[13px] border-b border-soc-border/5"
                style={{
                  gridTemplateColumns: "40px 52px 110px 1fr 100px 90px 130px 48px",
                  background: isSelected
                    ? "rgba(0,180,216,0.06)"
                    : i % 2 === 0
                    ? "transparent"
                    : "rgba(26,34,52,0.3)",
                }}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(t.id)}
                    className="w-3.5 h-3.5 cursor-pointer accent-soc-accent"
                  />
                </div>
                <div>
                  <LevelBadge level={t.rule?.level} />
                </div>
                <div className="font-mono text-xs text-soc-muted truncate">
                  {flattenAgent(t.agent)}
                </div>
                <div className="truncate pr-2.5">
                  {flattenRule(t.rule)}
                </div>
                <div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-soc-muted">
                  {t.assigned || "—"}
                </div>
                <div className="font-mono text-[11px] text-soc-dim">
                  {formatTimestamp(t.timestamp)}
                </div>
                <div>
                  <button
                    onClick={() => onInspect(t)}
                    className="flex items-center bg-soc-surface2 text-soc-accent px-2 py-1 rounded border border-soc-border text-[11px] hover:bg-soc-surface3 transition-colors"
                    title="Investigate"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-10 text-center text-soc-dim text-sm">
              No cases match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
