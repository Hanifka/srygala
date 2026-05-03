"use client";

import { useState, useEffect, useRef } from "react";
import { FolderOpen, ChevronDown, Check, Link2 } from "lucide-react";
import type { Case, Credentials } from "@/lib/types";
import { getCases, linkTickets } from "@/lib/api";

interface CaseLinkDropdownProps {
  ticketId: string;
  creds: Credentials;
  onLinked?: () => void;
}

export default function CaseLinkDropdown({ ticketId, creds, onLinked }: CaseLinkDropdownProps) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load cases when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCases(creds, { size: 50 })
      .then((res) => setCases(res.cases))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, creds]);

  const handleLink = async (caseItem: Case) => {
    setLinking(caseItem.id);
    try {
      await linkTickets(creds, caseItem.id, [ticketId]);
      setLinked(caseItem.id);
      setTimeout(() => {
        setOpen(false);
        setLinked(null);
        onLinked?.();
      }, 800);
    } catch {
      // silent
    } finally {
      setLinking(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-soc-accent bg-soc-accent/10 border border-soc-accent/30 hover:bg-soc-accent/20 transition-colors"
      >
        <Link2 className="w-3 h-3" />
        Link to case
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[280px] bg-soc-surface border border-soc-border rounded-lg shadow-xl overflow-hidden z-30 animate-fade-in">
          <div className="px-3 py-2 border-b border-soc-border bg-soc-surface2">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3 h-3 text-soc-accent" />
              <span className="text-[10px] text-soc-muted uppercase tracking-wider font-semibold">Select case</span>
            </div>
          </div>

          {loading && (
            <div className="py-4 text-center text-[12px] text-soc-muted animate-pulse">Loading…</div>
          )}

          {!loading && cases.length === 0 && (
            <div className="py-4 text-center text-[12px] text-soc-dim">No cases available</div>
          )}

          <div className="max-h-[200px] overflow-auto">
            {cases.map((c) => {
              const isLinked = linked === c.id;
              const isLinking = linking === c.id;
              const alreadyLinked = (c.linked_event_ids ?? []).includes(ticketId);

              return (
                <button
                  key={c.id}
                  onClick={() => !alreadyLinked && !isLinking && handleLink(c)}
                  disabled={alreadyLinked || isLinking}
                  className={`w-full text-left px-3 py-2 border-b border-soc-border/30 transition-colors ${
                    alreadyLinked
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-soc-surface2"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-soc-accent font-semibold">{c.case_number}</span>
                    <span className="text-[11px] text-soc-text truncate flex-1">{c.title}</span>
                    {alreadyLinked && <Check className="w-3 h-3 text-soc-accent2 shrink-0" />}
                    {isLinked && <Check className="w-3 h-3 text-green-400 shrink-0" />}
                    {isLinking && <span className="text-[10px] text-soc-muted animate-pulse">…</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
