"use client";

import { useState } from "react";
import {
  X,
  Eye,
  ChevronDown,
  Save,
  Check,
} from "lucide-react";
import type { Ticket } from "@/lib/types";
import { formatTimestamp, levelColor, levelLabel } from "@/lib/utils";
import { LevelBadge, MitreBadge } from "./Badges";
import CaseLinkDropdown from "./CaseLinkDropdown";
import { useAuth } from "@/lib/auth-context";

interface InvestigationPanelProps {
  ticket: Ticket;
  onClose: () => void;
  onSave: (id: string, data: { assigned?: string; status?: string; note?: string }) => void;
  onLinked?: () => void; // ← tambah
}

export default function InvestigationPanel({
  ticket,
  onClose,
  onSave,
  onLinked, // ← tambah
}: InvestigationPanelProps) {
  const { creds } = useAuth();
  const [assigned, setAssigned] = useState(ticket.assigned || "");
  const [status, setStatus] = useState(ticket.status || "open");
  const [note, setNote] = useState(ticket.note || "");
  const [saved, setSaved] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const rule = ticket.rule || {};
  const agent = ticket.agent || {};
  const mitre = rule.mitre || {};
  const color = levelColor(rule.level);

  const handleSave = () => {
    onSave(ticket.id, { assigned, status, note });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <div className="relative w-full max-w-[680px] h-full bg-soc-bg border-l border-soc-border flex flex-col overflow-hidden animate-slide-in">
        {/* ── Header ──────────────────────────────── */}
        <div className="px-6 py-5 border-b border-soc-border bg-soc-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-soc-accent" />
            <div>
              <div className="text-[15px] font-bold">Investigation</div>
              <div className="font-mono text-[11px] text-soc-muted">
                {ticket.id}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ── Link to case dropdown ── */}
            {creds && (
              <CaseLinkDropdown ticketId={ticket.id} creds={creds} onLinked={onLinked} />
            )}
            <button
              onClick={onClose}
              className="text-soc-muted hover:text-soc-text p-1.5 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6">
          {/* Severity banner */}
          <div
            className="rounded-xl p-4 mb-5"
            style={{
              background: `linear-gradient(135deg, ${color}12, ${color}06)`,
              border: `1px solid ${color}25`,
            }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <LevelBadge level={rule.level} />
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color }}
              >
                {levelLabel(rule.level)} Severity
              </span>
            </div>
            <div className="text-sm font-semibold leading-relaxed">
              {rule.description}
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              {
                label: "Agent",
                value: agent.name || "—",
                sub: agent.ip,
              },
              {
                label: "Rule ID",
                value: rule.id || "—",
                sub: rule.firedtimes ? `Fired ${rule.firedtimes}x` : undefined,
              },
              {
                label: "Timestamp",
                value: formatTimestamp(ticket.timestamp),
              },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-soc-surface border border-soc-border rounded-lg p-3"
              >
                <div className="text-[10px] text-soc-muted uppercase tracking-wider mb-1">
                  {m.label}
                </div>
                <div className="font-mono text-[13px] font-semibold">
                  {m.value}
                </div>
                {m.sub && (
                  <div className="text-[11px] text-soc-dim mt-0.5">
                    {m.sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Groups */}
          {rule.groups && rule.groups.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-soc-muted uppercase tracking-wider mb-1.5">
                Rule Groups
              </div>
              <div className="flex flex-wrap gap-1">
                {rule.groups.map((g: string) => (
                  <span
                    key={g}
                    className="px-2 py-0.5 rounded font-mono text-[11px] bg-soc-surface2 text-soc-muted border border-soc-border"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* MITRE ATT&CK */}
          {(mitre.tactic?.length || mitre.technique?.length) && (
            <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-4 mb-5">
              <div className="text-[11px] text-purple-400 uppercase tracking-wider mb-2 font-semibold">
                MITRE ATT&CK
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mitre.tactic?.map((t) => (
                  <MitreBadge key={t} label={t} />
                ))}
                {mitre.technique?.map((t) => (
                  <MitreBadge key={t} label={t} />
                ))}
                {mitre.id?.map((id) => (
                  <MitreBadge key={id} label={id} />
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON */}
          <div className="mb-5">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-1.5 text-soc-muted text-xs py-1.5 hover:text-soc-text transition-colors"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showRaw ? "rotate-180" : ""
                }`}
              />
              Raw Alert Data
            </button>
            {showRaw && (
              <div className="mt-2 rounded-lg border border-soc-border overflow-hidden">
                <div className="bg-soc-surface px-4 py-2 border-b border-soc-border flex items-center justify-between">
                  <span className="text-[11px] text-soc-muted font-mono uppercase tracking-wider">JSON</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(ticket, null, 2))}
                    className="text-[11px] text-soc-accent hover:text-soc-text transition-colors px-2 py-0.5 rounded border border-soc-border"
                  >
                    Copy
                  </button>
                </div>
                <pre className="font-mono bg-soc-bg p-4 text-[12px] leading-6 overflow-auto text-soc-text whitespace-pre-wrap break-all">
                  {JSON.stringify(ticket, null, 2)
                    .split("\n")
                    .map((line, i) => {
                      const keyMatch = line.match(/^(\s*)("[\w@]+")(\s*:\s*)(.*)/);
                      if (keyMatch) {
                        const [, indent, key, colon, value] = keyMatch;
                        const isString = value.startsWith('"');
                        const isNumber = /^-?\d/.test(value);
                        const isBool = /^(true|false)[,]?$/.test(value);
                        const isNull = /^null[,]?$/.test(value);
                        return (
                          <span key={i} className="block">
                            {indent}
                            <span style={{ color: "#60a5fa" }}>{key}</span>
                            <span style={{ color: "#6b7280" }}>{colon}</span>
                            <span style={{ color: isString ? "#4ade80" : isNumber ? "#facc15" : isBool ? "#c084fc" : isNull ? "#f87171" : "#e2e8f0" }}>
                              {value}
                            </span>
                          </span>
                        );
                      }
                      return <span key={i} className="block" style={{ color: "#6b7280" }}>{line}</span>;
                    })}
                </pre>
              </div>
            )}
          </div>

          {/* ── Case Management ────────────────────── */}
          <div className="border-t border-soc-border pt-5">
            <div className="text-[13px] font-semibold mb-3.5">
              Case Management
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3.5">
              <div>
                <label className="text-[11px] text-soc-muted block mb-1">
                  Assigned To
                </label>
                <input
                  value={assigned}
                  onChange={(e) => setAssigned(e.target.value)}
                  placeholder="analyst name"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[11px] text-soc-muted block mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "open" | "investigating" | "closed")}
                  className="w-full"
                >
                  <option value="open">open</option>
                  <option value="investigating">investigating</option>
                  <option value="closed">closed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-soc-muted block mb-1">
                Investigation Notes
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add investigation notes…"
                className="w-full resize-y"
              />
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────── */}
        <div className="px-6 py-4 border-t border-soc-border bg-soc-surface flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="bg-soc-surface2 text-soc-muted px-5 py-2 rounded-md text-[13px] font-medium border border-soc-border hover:text-soc-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-md text-[13px] font-semibold text-black transition-colors duration-300"
            style={{
              background: saved ? "#22c55e" : "#00b4d8",
            }}
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" /> Saved
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
