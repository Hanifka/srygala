"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft, Trash2, Save, Link2, Unlink, ExternalLink,
  ChevronDown, Shield, Clock, User,
} from "lucide-react";
import type { Case, Ticket } from "@/lib/types";
import { formatTimestamp, flattenAgent } from "@/lib/utils";
import { LevelBadge, StatusBadge } from "@/components/Badges";

// ── Props ─────────────────────────────────────────────────

export interface CaseDetailProps {
  caseData: Case;
  tickets: Ticket[];
  onBack: () => void;
  onSaveCase: (id: string, data: Partial<Case>) => Promise<void>;
  onDeleteCase: (id: string) => Promise<void>;
  onLinkTickets: (caseId: string, ticketIds: string[]) => Promise<void>;
  onUnlinkTickets: (caseId: string, ticketIds: string[]) => Promise<void>;
  onInspectTicket: (ticket: Ticket) => void;
}

// ── Helpers ───────────────────────────────────────────────

function SeverityBadge({ severity }: { severity?: string }) {
  const styles: Record<string, string> = {
    critical: "text-red-400 bg-red-500/10 border-red-500/20",
    high:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
    medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    low:      "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase border ${styles[severity || "medium"] || styles.medium}`}>
      {severity || "medium"}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────

export default function CaseDetail({
  caseData,
  tickets,
  onBack,
  onSaveCase,
  onDeleteCase,
  onLinkTickets,
  onUnlinkTickets,
  onInspectTicket,
}: CaseDetailProps) {
  const [saving, setSaving]                 = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);
  const [showLinkPanel, setShowLinkPanel]   = useState(false);
  const [selectedToLink, setSelectedToLink] = useState<Set<string>>(new Set());

  // Editable fields
  const [title, setTitle]             = useState(caseData.title ?? "");
  const [description, setDescription] = useState(caseData.description ?? "");
  const [status, setStatus]           = useState(caseData.status ?? "open");
  const [severity, setSeverity]       = useState(caseData.severity ?? "medium");
  const [assigned, setAssigned]       = useState(caseData.assigned ?? "");

  // ── Reset all local state when switching to a different case ──
  useEffect(() => {
    setTitle(caseData.title ?? "");
    setDescription(caseData.description ?? "");
    setStatus(caseData.status ?? "open");
    setSeverity(caseData.severity ?? "medium");
    setAssigned(caseData.assigned ?? "");
    setShowLinkPanel(false);
    setSelectedToLink(new Set());
    setConfirmDelete(false);
  }, [caseData.id]);

  // ── Linked events ──────────────────────────────────────────
  const linkedIds = new Set([
    ...(caseData.linked_event_ids ?? []),
    ...(caseData.tickets ?? []).map((t) => t.id),
  ]);

  const linked   = tickets.filter((t) => linkedIds.has(t.id));
  const unlinked = tickets.filter((t) => !linkedIds.has(t.id));

  const isDirty =
    title       !== (caseData.title       ?? "") ||
    description !== (caseData.description ?? "") ||
    status      !== (caseData.status      ?? "open") ||
    severity    !== (caseData.severity    ?? "medium") ||
    assigned    !== (caseData.assigned    ?? "");

  // ── Handlers ─────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveCase(caseData.id, { title, description, status, severity, assigned });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await onDeleteCase(caseData.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleLink = async () => {
    if (selectedToLink.size === 0) return;
    await onLinkTickets(caseData.id, Array.from(selectedToLink));
    setSelectedToLink(new Set());
    setShowLinkPanel(false);
  };

  const handleUnlink = async (ticketId: string) => {
    await onUnlinkTickets(caseData.id, [ticketId]);
  };

  const toggleSelect = (id: string) => {
    setSelectedToLink((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-soc-surface border border-soc-border rounded-xl overflow-hidden animate-fade-in">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-soc-border bg-soc-surface2 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-soc-muted hover:text-soc-text transition-colors text-[12px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="w-px h-4 bg-soc-border" />

        <SeverityBadge severity={caseData.severity} />
        <span className="text-[13px] font-semibold text-soc-text truncate flex-1">{caseData.title}</span>

        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-soc-accent text-soc-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-50 ${
              confirmDelete
                ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
                : "bg-soc-surface border-soc-border text-soc-muted hover:text-red-400 hover:border-red-500/40"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "Deleting…" : confirmDelete ? "Confirm?" : "Delete"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">

        {/* Edit fields */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">

          {/* Left: title + description */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] text-soc-muted uppercase tracking-wider mb-1 block">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-soc-surface2 border border-soc-border rounded-lg px-3 py-2 text-[13px] text-soc-text outline-none focus:border-soc-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-soc-muted uppercase tracking-wider mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-soc-surface2 border border-soc-border rounded-lg px-3 py-2 text-[13px] text-soc-text outline-none focus:border-soc-accent transition-colors resize-none"
              />
            </div>
          </div>

          {/* Right: metadata */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] text-soc-muted uppercase tracking-wider mb-1 block">Status</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "open" | "investigating" | "closed")}
                  className="w-full appearance-none bg-soc-surface2 border border-soc-border rounded-lg px-3 py-2 text-[13px] text-soc-text outline-none focus:border-soc-accent transition-colors pr-8"
                >
                  {["open", "investigating", "closed"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-soc-dim pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-soc-muted uppercase tracking-wider mb-1 block">Severity</label>
              <div className="relative">
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as "low" | "medium" | "high" | "critical")}
                  className="w-full appearance-none bg-soc-surface2 border border-soc-border rounded-lg px-3 py-2 text-[13px] text-soc-text outline-none focus:border-soc-accent transition-colors pr-8"
                >
                  {["critical", "high", "medium", "low"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-soc-dim pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-soc-muted uppercase tracking-wider mb-1 block">Assigned To</label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-soc-dim" />
                <input
                  value={assigned}
                  onChange={(e) => setAssigned(e.target.value)}
                  placeholder="analyst@soc.local"
                  className="w-full pl-7 bg-soc-surface2 border border-soc-border rounded-lg px-3 py-2 text-[13px] text-soc-text outline-none focus:border-soc-accent transition-colors"
                />
              </div>
            </div>

            <div className="mt-auto pt-2 border-t border-soc-border/50 flex flex-col gap-1">
              {caseData.created_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-soc-dim">
                  <Clock className="w-3 h-3" />
                  Created {new Date(caseData.created_at).toLocaleString()}
                </div>
              )}
              {caseData.updated_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-soc-dim">
                  <Clock className="w-3 h-3" />
                  Updated {new Date(caseData.updated_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Linked Events ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-soc-accent" />
              <span className="text-[11px] text-soc-muted uppercase tracking-wider font-semibold">
                Linked Events
              </span>
              <span className="font-mono text-[10px] bg-soc-surface border border-soc-border px-1.5 py-0.5 rounded text-soc-muted">
                {linked.length}
              </span>
            </div>
            <button
              onClick={() => setShowLinkPanel((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-soc-border text-soc-muted hover:text-soc-accent hover:border-soc-accent/40 transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Link Events
            </button>
          </div>

          {/* Link picker */}
          {showLinkPanel && (
            <div className="bg-soc-surface2 border border-soc-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-soc-border bg-soc-surface flex items-center justify-between">
                <span className="text-[11px] text-soc-muted">
                  Select events to link ({selectedToLink.size} selected)
                </span>
                <button
                  onClick={handleLink}
                  disabled={selectedToLink.size === 0}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-soc-accent text-soc-bg disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  Link selected
                </button>
              </div>
              <div className="max-h-48 overflow-auto">
                {unlinked.length === 0 && (
                  <div className="py-6 text-center text-[12px] text-soc-dim">All events are already linked</div>
                )}
                {unlinked.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleSelect(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 border-b border-soc-border/50 last:border-0 text-left transition-colors ${
                      selectedToLink.has(t.id) ? "bg-soc-accent/5" : "hover:bg-soc-surface"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      selectedToLink.has(t.id)
                        ? "border-soc-accent bg-soc-accent"
                        : "border-soc-border bg-soc-surface"
                    }`}>
                      {selectedToLink.has(t.id) && <div className="w-1.5 h-1.5 rounded-sm bg-soc-bg" />}
                    </div>
                    <LevelBadge level={t.rule?.level} />
                    <span className="flex-1 text-[12px] text-soc-text truncate">{t.rule?.description}</span>
                    <span className="font-mono text-[10px] text-soc-dim">{formatTimestamp(t.timestamp)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Linked ticket rows */}
          <div className="bg-soc-surface2 border border-soc-border rounded-xl overflow-hidden">
            {linked.length === 0 && (
              <div className="py-8 text-center text-[12px] text-soc-dim">No events linked to this case yet</div>
            )}
            {linked.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-soc-border/50 last:border-0 hover:bg-soc-surface transition-colors"
              >
                <LevelBadge level={t.rule?.level} />
                <span className="font-mono text-[11px] text-soc-dim w-20 shrink-0 truncate">{flattenAgent(t.agent)}</span>
                <span className="flex-1 text-[12px] text-soc-text truncate">{t.rule?.description}</span>
                <StatusBadge status={t.status} />
                <span className="font-mono text-[10px] text-soc-dim w-28 shrink-0 text-right">{formatTimestamp(t.timestamp)}</span>

                <button
                  onClick={() => onInspectTicket(t)}
                  className="p-1 text-soc-dim hover:text-soc-accent transition-colors"
                  title="Inspect"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleUnlink(t.id)}
                  className="p-1 text-soc-dim hover:text-red-400 transition-colors"
                  title="Unlink"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
