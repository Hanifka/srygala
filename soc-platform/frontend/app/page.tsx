"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, AlertTriangle, Search, CheckCircle, Flame, Play, Clock, CheckCircle2, XCircle, AlertTriangle as Warn, Copy, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getTickets,
  updateTicket,
  bulkDeleteTickets,
  getTicket,
  getCases,
  createCase,
  updateCase,
  deleteCase,
  linkTickets,
  unlinkTickets,
} from "@/lib/api";
import type { Ticket, Case } from "@/lib/types";
import { formatTimestamp, flattenAgent } from "@/lib/utils";
import {
  LoginForm,
  Navbar,
  MetricCard,
  TicketTable,
  InvestigationPanel,
  LevelBadge,
  StatusBadge,
  LevelChart,
  StatusPieChart,
  AgentChart,
  TopRulesChart,
  SeverityAreaChart,
  MitreChart,
  CaseSidebar,
  CaseDetail,
  NewCaseModal,
} from "@/components";

type View = "dashboard" | "tickets" | "analytics" | "remote-command";

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000];
const API_BASE         = process.env.NEXT_PUBLIC_API_URL || "/api";
const POLL_INTERVAL    = 3000;
const POLL_TIMEOUT     = 90000;

// ── RC Types ──────────────────────────────────────────────

interface RCAgent {
  id: string; name: string; ip: string;
  os_name: string; os_platform: string;
  status: string; last_keepalive: string; group: string;
}

interface RCResult {
  status?: string;
  rc_command_id?: string; rc_agent_id?: string;
  rc_command?: string; rc_requested_by?: string;
  rc_output?: string; rc_status?: string;
  rc_exit_code?: string; rc_executed_at?: string;
}

type RCPhase = "idle" | "processing" | "done" | "error";

// ── RC Helpers ────────────────────────────────────────────

function authHeader(username: string, password: string) {
  return "Basic " + btoa(`${username}:${password}`);
}

function formatOutput(raw: string): string[] {
  if (!raw) return [];
  if (raw.includes("\\n")) return raw.split("\\n").filter(Boolean);
  return raw.split("\n").filter(Boolean);
}

function statusDotClass(s?: string) {
  if (s === "success") return "bg-soc-accent2";
  if (s === "timeout") return "bg-yellow-400";
  return "bg-red-400";
}

function statusTextClass(s?: string) {
  if (s === "success") return "text-soc-accent2";
  if (s === "timeout") return "text-yellow-400";
  return "text-red-400";
}

// ── History detail modal ──────────────────────────────────

function HistoryDetail({ item, onClose }: { item: RCResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-[620px] mx-4 bg-soc-surface border border-soc-border rounded-xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-soc-border bg-soc-surface2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(item.rc_status)}`} />
            <span className="font-mono text-[13px] font-semibold text-soc-text">{item.rc_command}</span>
          </div>
          <button onClick={onClose} className="text-soc-muted hover:text-soc-text p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-4 gap-px bg-soc-border">
          {[
            { label: "Agent",     value: item.rc_agent_id },
            { label: "Status",    value: item.rc_status,   extra: statusTextClass(item.rc_status) },
            { label: "Exit code", value: item.rc_exit_code },
            { label: "Executed",  value: item.rc_executed_at ? new Date(item.rc_executed_at).toLocaleString() : "—" },
          ].map((m) => (
            <div key={m.label} className="bg-soc-surface p-3">
              <div className="text-[10px] text-soc-muted uppercase tracking-wider mb-1">{m.label}</div>
              <div className={`font-mono text-[12px] font-semibold truncate ${m.extra || "text-soc-text"}`}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Output */}
        <div className="border-t border-soc-border">
          <div className="bg-soc-surface2 px-4 py-2 flex items-center justify-between border-b border-soc-border">
            <span className="font-mono text-[11px] text-soc-muted">output</span>
            <button
              onClick={() => navigator.clipboard.writeText(formatOutput(item.rc_output || "").join("\n"))}
              className="flex items-center gap-1 text-[11px] text-soc-accent hover:text-soc-text px-2 py-0.5 rounded border border-soc-border transition-colors"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="font-mono bg-soc-bg p-4 text-[12px] leading-6 text-soc-text whitespace-pre-wrap overflow-auto max-h-64">
            {formatOutput(item.rc_output || "").map((line, i) => (
              <span key={i} className="block">{line}</span>
            ))}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-soc-border bg-soc-surface flex items-center justify-between">
          <span className="font-mono text-[10px] text-soc-dim">command_id: {item.rc_command_id}</span>
          <span className="font-mono text-[10px] text-soc-dim">by {item.rc_requested_by}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function Home() {
  const { creds, isAuthed } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView]               = useState<View>("dashboard");
  const [inspecting, setInspecting]   = useState<Ticket | null>(null);
  const [fullTicket, setFullTicket]   = useState<Ticket | null>(null);
  const [pageSize, setPageSize]       = useState(200);

  // ── Case State ───────────────────────────────────────────
  const [selectedCase, setSelectedCase]         = useState<Case | null>(null);
  const [showNewCaseModal, setShowNewCaseModal]  = useState(false);

  // ── RC State ─────────────────────────────────────────────
  const [rcAgents, setRcAgents]               = useState<RCAgent[]>([]);
  const [rcAgentsLoading, setRcAgentsLoading] = useState(false);
  const [rcAgentsLoaded, setRcAgentsLoaded]   = useState(false);
  const [selectedAgent, setSelectedAgent]     = useState<RCAgent | null>(null);
  const [command, setCommand]                 = useState("");
  const [rcPhase, setRcPhase]                 = useState<RCPhase>("idle");
  const [rcResult, setRcResult]               = useState<RCResult | null>(null);
  const [rcError, setRcError]                 = useState("");
  const [history, setHistory]                 = useState<RCResult[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<RCResult | null>(null);
  const pollRef                               = useRef<NodeJS.Timeout | null>(null);
  const dispatchRef                           = useRef<any>(null);

  // ── Ticket fetch ──────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", creds?.username, pageSize],
    queryFn: () => getTickets(creds!, { size: pageSize }),
    enabled: isAuthed,
    refetchInterval: 0,
  });

  const tickets = data?.tickets ?? [];

  // ── Cases fetch ───────────────────────────────────────────
  const { data: casesData, isLoading: casesLoading } = useQuery({
    queryKey: ["cases", creds?.username],
    queryFn: () => getCases(creds!, { size: 200 }),
    enabled: isAuthed,
    refetchInterval: 0,
  });

  const cases = casesData?.cases ?? [];

  const currentCase = selectedCase
    ? cases.find((c) => c.id === selectedCase.id) ?? selectedCase
    : null;

  // ── Handlers ─────────────────────────────────────────────

  const handleSave = useCallback(async (id: string, patch: any) => {
    if (!creds) return;
    await updateTicket(creds, id, patch);
    await new Promise((r) => setTimeout(r, 500));
    await queryClient.resetQueries({ queryKey: ["tickets", creds.username, pageSize] });
  }, [creds, queryClient, pageSize]);

  const handleDelete = useCallback(async (ids: string[]) => {
    if (!creds) return;
    await bulkDeleteTickets(creds, ids);
    await new Promise((r) => setTimeout(r, 500));
    await queryClient.resetQueries({ queryKey: ["tickets", creds.username, pageSize] });
  }, [creds, queryClient, pageSize]);

  const handleRefresh = useCallback(() => {
    queryClient.resetQueries({ queryKey: ["tickets", creds?.username, pageSize] });
    queryClient.resetQueries({ queryKey: ["cases", creds?.username] });
  }, [queryClient, creds, pageSize]);

  const handleInspect = useCallback(async (ticket: Ticket) => {
    setInspecting(ticket);
    setFullTicket(null);
    if (!creds) return;
    try {
      const full = await getTicket(creds, ticket.id);
      setFullTicket(full);
    } catch {
      setFullTicket(ticket);
    }
  }, [creds]);

  // ── Case Handlers ─────────────────────────────────────────

  const refreshCases = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["cases", creds?.username] });
  }, [queryClient, creds]);

  const handleCreateCase = useCallback(async (data: { title: string; description: string; severity: string; assigned: string }) => {
    if (!creds) return;
    const newCase = await createCase(creds, data);
    queryClient.setQueryData(["cases", creds.username], (old: any) => ({
      ...old,
      cases: [newCase, ...(old?.cases ?? [])],
    }));
    refreshCases();
  }, [creds, queryClient, refreshCases]);

  const handleSaveCase = useCallback(async (id: string, data: Partial<Case>) => {
    if (!creds) return;
    queryClient.setQueryData(["cases", creds.username], (old: any) => ({
      ...old,
      cases: (old?.cases ?? []).map((c: Case) => c.id === id ? { ...c, ...data } : c),
    }));
    await updateCase(creds, id, data);
    refreshCases();
  }, [creds, queryClient, refreshCases]);

  const handleDeleteCase = useCallback(async (id: string) => {
    if (!creds) return;
    queryClient.setQueryData(["cases", creds.username], (old: any) => ({
      ...old,
      cases: (old?.cases ?? []).filter((c: Case) => c.id !== id),
    }));
    setSelectedCase(null);
    deleteCase(creds, id).then(() => refreshCases()).catch(() => refreshCases());
  }, [creds, queryClient, refreshCases]);

  const handleLinkTickets = useCallback(async (caseId: string, ticketIds: string[]) => {
    if (!creds) return;
    queryClient.setQueryData(["cases", creds.username], (old: any) => ({
      ...old,
      cases: (old?.cases ?? []).map((c: Case) =>
        c.id === caseId
          ? { ...c, linked_event_ids: Array.from(new Set([...(c.linked_event_ids ?? []), ...ticketIds])) }
          : c
      ),
    }));
    await linkTickets(creds, caseId, ticketIds);
    refreshCases();
  }, [creds, queryClient, refreshCases]);

  const handleUnlinkTickets = useCallback(async (caseId: string, ticketIds: string[]) => {
    if (!creds) return;
    queryClient.setQueryData(["cases", creds.username], (old: any) => ({
      ...old,
      cases: (old?.cases ?? []).map((c: Case) =>
        c.id === caseId
          ? { ...c, linked_event_ids: (c.linked_event_ids ?? []).filter((id) => !ticketIds.includes(id)) }
          : c
      ),
    }));
    await unlinkTickets(creds, caseId, ticketIds);
    refreshCases();
  }, [creds, queryClient, refreshCases]);

  // ── RC Handlers ───────────────────────────────────────────

  const loadRcAgents = useCallback(async () => {
    if (!creds || rcAgentsLoading) return;
    setRcAgentsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rc/agents`, {
        headers: { Authorization: authHeader(creds.username, creds.password) },
      });
      if (!res.ok) throw new Error("Failed to load agents");
      const data = await res.json();
      setRcAgents(data);
      if (data.length > 0 && !selectedAgent) setSelectedAgent(data[0]);
      setRcAgentsLoaded(true);
    } catch (e: any) {
      setRcError(e.message);
    } finally {
      setRcAgentsLoading(false);
    }
  }, [creds, rcAgentsLoading, selectedAgent]);

  const loadHistory = useCallback(async () => {
    if (!creds) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rc/history`, {
        headers: { Authorization: authHeader(creds.username, creds.password) },
      });
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setHistory(data);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  }, [creds]);

  const handleViewChange = useCallback((v: View) => {
    setView(v);
    if (v === "remote-command") {
      if (!rcAgentsLoaded) loadRcAgents();
      loadHistory();
    }
  }, [rcAgentsLoaded, loadRcAgents, loadHistory]);

  const handleExecute = useCallback(async () => {
    if (!command.trim() || !selectedAgent || !creds || rcPhase === "processing") return;

    setRcPhase("processing");
    setRcResult(null);
    setRcError("");

    try {
      const res = await fetch(`${API_BASE}/rc/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader(creds.username, creds.password),
        },
        body: JSON.stringify({
          agent_id:     selectedAgent.id,
          command:      command.trim(),
          requested_by: creds.username,
        }),
      });
      if (!res.ok) throw new Error(`Dispatch failed: ${res.status}`);
      const meta = await res.json();
      dispatchRef.current = meta;

      const start = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - start > POLL_TIMEOUT) {
          clearInterval(pollRef.current!);
          setRcPhase("error");
          setRcError("No response from agent within timeout.");
          return;
        }
        try {
          const poll = await fetch(`${API_BASE}/rc/result`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader(creds.username, creds.password),
            },
            body: JSON.stringify(dispatchRef.current),
          });
          const data = await poll.json();
          if (data.status === "done") {
            clearInterval(pollRef.current!);
            setRcResult(data);
            setRcPhase("done");
            setHistory((h) => [data, ...h].slice(0, 50));
          }
        } catch {}
      }, POLL_INTERVAL);
    } catch (e: any) {
      setRcPhase("error");
      setRcError(e.message || "Unknown error");
    }
  }, [command, selectedAgent, creds, rcPhase]);

  // ── Not logged in ─────────────────────────────────────────
  if (!isAuthed) return <LoginForm />;

  const stats = {
    total:         tickets.length,
    open:          tickets.filter((t) => t.status === "open").length,
    investigating: tickets.filter((t) => t.status === "investigating").length,
    closed:        tickets.filter((t) => t.status === "closed").length,
    critical:      tickets.filter((t) => (t.rule?.level ?? 0) >= 12).length,
  };

  const rcStatusColor = statusTextClass(rcResult?.rc_status);

  return (
    <div className="h-screen flex flex-col bg-soc-bg">
      <Navbar currentView={view} onViewChange={handleViewChange} onRefresh={handleRefresh} />

      <main className="flex-1 overflow-auto p-6">

        {view !== "remote-command" && view !== "tickets" && (
          <div className="flex items-center justify-end mb-4 gap-2">
            <span className="text-[11px] text-soc-muted uppercase tracking-wider">Show</span>
            <div className="flex gap-1">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button key={size} onClick={() => setPageSize(size)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                    pageSize === size
                      ? "bg-soc-accent text-black border-soc-accent"
                      : "bg-soc-surface text-soc-muted border-soc-border hover:text-soc-text"
                  }`}>
                  {size}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-soc-muted uppercase tracking-wider">events</span>
          </div>
        )}

        {isLoading && view !== "remote-command" && (
          <div className="flex items-center justify-center h-64 text-soc-muted text-sm">
            Loading events..
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* DASHBOARD                               */}
        {/* ════════════════════════════════════════ */}
        {!isLoading && view === "dashboard" && (
          <div className="animate-fade-in">
            <div className="flex gap-3.5 mb-6 flex-wrap">
              <MetricCard label="Total Events" value={stats.total} color="#00b4d8" icon={<Shield className="w-4 h-4" />} sub="All time" />
              <MetricCard label="Open" value={stats.open} color="#ef4444" icon={<AlertTriangle className="w-4 h-4" />} sub="Needs triage" />
              <MetricCard label="Investigating" value={stats.investigating} color="#f59e0b" icon={<Search className="w-4 h-4" />} sub="In progress" />
              <MetricCard label="Closed" value={stats.closed} color="#22c55e" icon={<CheckCircle className="w-4 h-4" />} sub="Resolved" />
              <MetricCard label="Critical" value={stats.critical} color="#ec4899" icon={<Flame className="w-4 h-4" />} sub="Level ≥ 12" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
              <LevelChart tickets={tickets} />
              <StatusPieChart tickets={tickets} />
            </div>
            <div className="bg-soc-surface border border-soc-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[13px] font-semibold">Recent Critical Events</span>
                <button onClick={() => setView("tickets")} className="text-soc-accent text-xs font-medium hover:underline">View all →</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {tickets.filter((t) => (t.rule?.level ?? 0) >= 10).slice(0, 5).map((t) => (
                  <div key={t.id} onClick={() => handleInspect(t)}
                    className="flex items-center gap-3 px-3.5 py-2.5 bg-soc-surface2 rounded-lg cursor-pointer border border-transparent hover:border-soc-border2 transition-colors">
                    <LevelBadge level={t.rule?.level} />
                    <span className="font-mono text-[11px] text-soc-dim min-w-[80px]">{flattenAgent(t.agent)}</span>
                    <span className="flex-1 text-[13px] truncate">{t.rule?.description}</span>
                    <StatusBadge status={t.status} />
                    <span className="font-mono text-[11px] text-soc-dim">{formatTimestamp(t.timestamp)}</span>
                  </div>
                ))}
                {tickets.filter((t) => (t.rule?.level ?? 0) >= 10).length === 0 && (
                  <div className="text-center py-6 text-soc-dim text-sm">No critical events found</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* TICKETS + CASES (split layout)          */}
        {/* ════════════════════════════════════════ */}
        {!isLoading && view === "tickets" && (
          <div className="flex gap-4 h-[calc(100vh-120px)] animate-fade-in">
            {/* Left: Case sidebar */}
            <CaseSidebar
              cases={cases}
              selectedCaseId={currentCase?.id ?? null}
              onSelectCase={(c) => setSelectedCase(c)}
              onNewCase={() => setShowNewCaseModal(true)}
              loading={casesLoading}
            />

            {/* Right: Either ticket table or case detail */}
            <div className="flex-1 min-w-0 flex flex-col">
              {!currentCase && (
                <div className="flex items-center justify-end mb-3 gap-2 shrink-0">
                  <span className="text-[11px] text-soc-muted uppercase tracking-wider">Show</span>
                  <div className="flex gap-1">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <button key={size} onClick={() => setPageSize(size)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                          pageSize === size
                            ? "bg-soc-accent text-black border-soc-accent"
                            : "bg-soc-surface text-soc-muted border-soc-border hover:text-soc-text"
                        }`}>
                        {size}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-soc-muted uppercase tracking-wider">events</span>
                </div>
              )}

              {currentCase ? (
                <CaseDetail
                  caseData={currentCase}
                  tickets={tickets}
                  onBack={() => setSelectedCase(null)}
                  onSaveCase={handleSaveCase}
                  onDeleteCase={handleDeleteCase}
                  onLinkTickets={handleLinkTickets}
                  onUnlinkTickets={handleUnlinkTickets}
                  onInspectTicket={handleInspect}
                />
              ) : (
                <TicketTable tickets={tickets} onInspect={handleInspect} onDelete={handleDelete} />
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* ANALYTICS                               */}
        {/* ════════════════════════════════════════ */}
        {!isLoading && view === "analytics" && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <AgentChart tickets={tickets} />
              <TopRulesChart tickets={tickets} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SeverityAreaChart tickets={tickets} />
              <MitreChart tickets={tickets} />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* REMOTE COMMAND                          */}
        {/* ════════════════════════════════════════ */}
        {view === "remote-command" && (
          <div className="animate-fade-in max-w-5xl mx-auto flex flex-col gap-5">

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

              {/* ── Left: Agent picker ── */}
              <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-soc-muted uppercase tracking-wider">Agents</span>
                  <button onClick={loadRcAgents} disabled={rcAgentsLoading}
                    className="text-soc-muted hover:text-soc-text transition-colors disabled:opacity-40">
                    <RefreshCw className={`w-3.5 h-3.5 ${rcAgentsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {rcAgentsLoading && (
                  <div className="text-[13px] text-soc-muted animate-pulse py-4 text-center">Loading agents…</div>
                )}
                {!rcAgentsLoading && rcAgents.length === 0 && rcAgentsLoaded && (
                  <div className="text-[13px] text-soc-muted py-4 text-center">No active agents found.</div>
                )}

                <div className="flex flex-col gap-1.5">
                  {rcAgents.map((agent) => (
                    <button key={agent.id} onClick={() => rcPhase !== "processing" && setSelectedAgent(agent)}
                      disabled={rcPhase === "processing"}
                      className={`text-left p-3 rounded-lg border transition-all duration-150 disabled:opacity-50 ${
                        selectedAgent?.id === agent.id
                          ? "border-soc-accent bg-soc-accent/5"
                          : "border-soc-border bg-soc-surface2 hover:border-soc-border2"
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-soc-accent2 shrink-0" />
                        <span className="text-[13px] font-semibold text-soc-text truncate">{agent.name}</span>
                        <span className="ml-auto font-mono text-[10px] text-soc-dim shrink-0">{agent.id}</span>
                      </div>
                      <div className="font-mono text-[11px] text-soc-muted truncate">{agent.ip} · {agent.os_name}</div>
                      <div className="font-mono text-[10px] text-soc-dim mt-0.5 truncate">{agent.group}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Right: Command + Result ── */}
              <div className="flex flex-col gap-4">

                {/* Command input */}
                <div className="bg-soc-surface border border-soc-border rounded-xl p-4">
                  <div className="text-[11px] text-soc-muted uppercase tracking-wider mb-2">Command</div>
                  <div className="flex gap-2">
                    <input value={command} onChange={(e) => setCommand(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleExecute()}
                      placeholder="e.g. df -h"
                      disabled={rcPhase === "processing"}
                      className="flex-1 font-mono text-[13px] bg-soc-surface2 border border-soc-border text-soc-text rounded-lg px-3 py-2 outline-none focus:border-soc-accent transition-colors disabled:opacity-50" />
                    <button onClick={handleExecute}
                      disabled={!command.trim() || !selectedAgent || rcPhase === "processing"}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-soc-accent text-soc-bg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                      <Play className="w-3.5 h-3.5" />
                      Run
                    </button>
                  </div>

                  {/* Status bar */}
                  {rcPhase !== "idle" && (
                    <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-soc-surface2 border border-soc-border text-[13px]">
                      {rcPhase === "processing" && <Clock className="w-3.5 h-3.5 text-soc-accent animate-spin" />}
                      {rcPhase === "done" && rcResult?.rc_status === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-soc-accent2" />}
                      {rcPhase === "done" && rcResult?.rc_status === "timeout"  && <Warn className="w-3.5 h-3.5 text-yellow-400" />}
                      {rcPhase === "done" && rcResult?.rc_status === "failed"   && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      {rcPhase === "error" && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      <span className={`font-mono text-[12px] ${
                        rcPhase === "processing" ? "text-soc-accent"
                        : rcPhase === "error"    ? "text-red-400"
                        : rcStatusColor
                      }`}>
                        {rcPhase === "processing" ? "Running…"
                          : rcPhase === "error"   ? rcError
                          : rcResult?.rc_status}
                      </span>
                      {rcPhase === "processing" && (
                        <span className="ml-auto font-mono text-[11px] text-soc-dim">polling every {POLL_INTERVAL / 1000}s</span>
                      )}
                      {rcPhase === "done" && (
                        <span className="ml-auto font-mono text-[11px] text-soc-dim">exit {rcResult?.rc_exit_code}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Result output */}
                {rcPhase === "done" && rcResult && (
                  <div className="bg-soc-surface border border-soc-border rounded-xl overflow-hidden">
                    <div className="grid grid-cols-3 gap-px bg-soc-border">
                      {[
                        { label: "Status",    value: rcResult.rc_status,    color: rcStatusColor },
                        { label: "Exit code", value: rcResult.rc_exit_code, color: "text-soc-text" },
                        { label: "Executed",  value: rcResult.rc_executed_at ? new Date(rcResult.rc_executed_at).toLocaleString() : "—", color: "text-soc-text" },
                      ].map((m) => (
                        <div key={m.label} className="bg-soc-surface p-3">
                          <div className="text-[10px] text-soc-muted uppercase tracking-wider mb-1">{m.label}</div>
                          <div className={`font-mono text-[12px] font-semibold truncate ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-soc-surface px-4 py-2 border-t border-soc-border flex items-center justify-between">
                      <span className="font-mono text-[11px] text-soc-muted">{rcResult.rc_command}</span>
                      <button onClick={() => navigator.clipboard.writeText(formatOutput(rcResult.rc_output || "").join("\n"))}
                        className="flex items-center gap-1 text-[11px] text-soc-accent hover:text-soc-text transition-colors px-2 py-0.5 rounded border border-soc-border">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <pre className="font-mono bg-soc-bg p-4 text-[12px] leading-6 overflow-auto text-soc-text whitespace-pre-wrap max-h-80">
                      {formatOutput(rcResult.rc_output || "").map((line, i) => (
                        <span key={i} className="block">{line}</span>
                      ))}
                    </pre>
                    <div className="px-4 py-2 border-t border-soc-border">
                      <span className="font-mono text-[10px] text-soc-dim">command_id: {rcResult.rc_command_id}</span>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ── History table — full width below the grid ── */}
            <div className="bg-soc-surface border border-soc-border rounded-xl overflow-hidden">

              <div className="flex items-center justify-between px-4 py-3 border-b border-soc-border bg-soc-surface2">
                <span className="text-[11px] text-soc-muted uppercase tracking-wider">
                  Execution history · last 24h
                </span>
                <div className="flex items-center gap-3">
                  {history.length > 0 && (
                    <span className="font-mono text-[10px] bg-soc-surface border border-soc-border px-1.5 py-0.5 rounded text-soc-muted">
                      {history.length}
                    </span>
                  )}
                  <button onClick={loadHistory} disabled={historyLoading}
                    className="text-soc-muted hover:text-soc-text transition-colors disabled:opacity-40">
                    <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[16px_1fr_100px_80px_60px_160px] gap-0 px-4 py-2 bg-soc-surface2 border-b border-soc-border">
                {["", "Command", "Agent", "Status", "Exit", "Executed"].map((h) => (
                  <div key={h} className="text-[10px] text-soc-muted uppercase tracking-wider">{h}</div>
                ))}
              </div>

              {historyLoading && (
                <div className="px-4 py-8 text-[13px] text-soc-muted text-center animate-pulse">Loading…</div>
              )}

              {!historyLoading && history.length === 0 && (
                <div className="px-4 py-8 text-[13px] text-soc-muted text-center">No executions in the last 24h</div>
              )}

              {!historyLoading && history.map((h, i) => (
                <button key={h.rc_command_id || i}
                  onClick={() => setSelectedHistory(h)}
                  className="w-full grid grid-cols-[16px_1fr_100px_80px_60px_160px] gap-0 px-4 py-2.5 border-b border-soc-border last:border-0 hover:bg-soc-surface2 transition-colors text-left">
                  <div className="flex items-center">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(h.rc_status)}`} />
                  </div>
                  <div className="font-mono text-[12px] text-soc-text truncate pr-3">{h.rc_command}</div>
                  <div className="font-mono text-[11px] text-soc-muted truncate">{h.rc_agent_id}</div>
                  <div className={`font-mono text-[11px] ${statusTextClass(h.rc_status)}`}>{h.rc_status}</div>
                  <div className="font-mono text-[11px] text-soc-muted">{h.rc_exit_code}</div>
                  <div className="font-mono text-[11px] text-soc-dim truncate">
                    {h.rc_executed_at ? new Date(h.rc_executed_at).toLocaleString() : "—"}
                  </div>
                </button>
              ))}
            </div>

          </div>
        )}

      </main>

      {/* Investigation Panel */}
      {inspecting && (
        <InvestigationPanel
          ticket={fullTicket || inspecting}
          onClose={() => { setInspecting(null); setFullTicket(null); }}
          onSave={async (id, data) => { await handleSave(id, data); setInspecting(null); setFullTicket(null); }}
          onLinked={handleRefresh}
        />
      )}

      {/* History detail modal */}
      {selectedHistory && (
        <HistoryDetail item={selectedHistory} onClose={() => setSelectedHistory(null)} />
      )}

      {/* New case modal */}
      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => setShowNewCaseModal(false)}
          onCreate={handleCreateCase}
        />
      )}
    </div>
  );
}
