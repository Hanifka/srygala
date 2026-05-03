"use client";

import { useState, useRef, useEffect } from "react";
import { Terminal, X, Play, Clock, CheckCircle, XCircle, AlertTriangle, Copy, ChevronDown, ChevronUp } from "lucide-react";
import type { Credentials } from "@/lib/types";

const API_BASE      = process.env.NEXT_PUBLIC_API_URL || "/api";
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT  = 90000;

interface RCAgent {
  id: string; name: string; ip: string;
  os_name: string; os_platform: string;
  status: string; last_keepalive: string; group: string;
}

interface DispatchMeta {
  agent_id: string; command: string;
  requested_by: string; dispatch_time: string;
}

interface RCResult {
  rc_command_id: string; rc_agent_id: string;
  rc_command: string; rc_requested_by: string;
  rc_output: string; rc_status: string;
  rc_exit_code: string; rc_executed_at: string;
}

type Phase = "idle" | "processing" | "done" | "error";

interface Props {
  credentials: Credentials;
  onClose: () => void;
}

function authHeader(creds: Credentials) {
  return "Basic " + btoa(`${creds.username}:${creds.password}`);
}

function formatOutput(raw: string): string[] {
  if (!raw) return [];
  if (raw.includes("\\n")) return raw.split("\\n").filter(Boolean);
  return raw.split("\n").filter(Boolean);
}

function statusColor(s?: string) {
  if (s === "success") return "text-soc-accent2";
  if (s === "timeout") return "text-yellow-400";
  return "text-red-400";
}

function statusDot(s?: string) {
  if (s === "success") return "bg-soc-accent2";
  if (s === "timeout") return "bg-yellow-400";
  return "bg-red-400";
}

// ── History detail modal ──────────────────────────────────

function HistoryDetail({ item, onClose }: { item: RCResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-[620px] mx-4 bg-soc-surface border border-soc-border rounded-xl overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="px-5 py-4 border-b border-soc-border bg-soc-surface2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(item.rc_status)}`} />
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
            { label: "Status",    value: item.rc_status,    extra: statusColor(item.rc_status) },
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
              onClick={() => navigator.clipboard.writeText(formatOutput(item.rc_output).join("\n"))}
              className="flex items-center gap-1 text-[11px] text-soc-accent hover:text-soc-text px-2 py-0.5 rounded border border-soc-border transition-colors"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="font-mono bg-soc-bg p-4 text-[12px] leading-6 text-soc-text whitespace-pre-wrap overflow-auto max-h-64">
            {formatOutput(item.rc_output).map((line, i) => (
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

// ── Main component ────────────────────────────────────────

export default function RemoteCommandPanel({ credentials, onClose }: Props) {
  const [agents, setAgents]               = useState<RCAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<RCAgent | null>(null);
  const [command, setCommand]             = useState("");
  const [phase, setPhase]                 = useState<Phase>("idle");
  const [result, setResult]               = useState<RCResult | null>(null);
  const [errorMsg, setErrorMsg]           = useState("");
  const [history, setHistory]             = useState<RCResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<RCResult | null>(null);
  const [historyOpen, setHistoryOpen]     = useState(true);
  const pollRef                           = useRef<NodeJS.Timeout | null>(null);
  const dispatchRef                       = useRef<DispatchMeta | null>(null);

  // ── Load agents ───────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/rc/agents`, {
          headers: { Authorization: authHeader(credentials) },
        });
        if (!res.ok) throw new Error("Failed to load agents");
        const data = await res.json();
        setAgents(data);
        if (data.length > 0) setSelectedAgent(data[0]);
      } catch (e: any) {
        setErrorMsg(e.message);
      } finally {
        setAgentsLoading(false);
      }
    }
    load();
  }, []);

  // ── Load history ──────────────────────────────────────────
  useEffect(() => {
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const res = await fetch(`${API_BASE}/rc/history`, {
          headers: { Authorization: authHeader(credentials) },
        });
        if (!res.ok) throw new Error("Failed to load history");
        const data = await res.json();
        setHistory(data);
      } catch {
        // silent — history is non-critical
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Execute ───────────────────────────────────────────────
  async function handleExecute() {
    if (!command.trim() || !selectedAgent || phase === "processing") return;
    setPhase("processing");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/rc/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader(credentials) },
        body: JSON.stringify({
          agent_id:     selectedAgent.id,
          command:      command.trim(),
          requested_by: credentials.username,
        }),
      });
      if (!res.ok) throw new Error(`Dispatch failed: ${res.status}`);
      const meta: DispatchMeta = await res.json();
      dispatchRef.current = meta;

      const start = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - start > POLL_TIMEOUT) {
          clearInterval(pollRef.current!);
          setPhase("error");
          setErrorMsg("No response from agent within timeout.");
          return;
        }
        try {
          const poll = await fetch(`${API_BASE}/rc/result`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader(credentials) },
            body: JSON.stringify(dispatchRef.current),
          });
          const data = await poll.json();
          if (data.status === "done") {
            clearInterval(pollRef.current!);
            setResult(data);
            setPhase("done");
            setHistory((h) => [data, ...h].slice(0, 50));
          }
        } catch {}
      }, POLL_INTERVAL);
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e.message || "Unknown error");
    }
  }

  const statusConfig = {
    idle:       { icon: null, text: "", color: "" },
    processing: { icon: <Clock className="w-3.5 h-3.5 text-soc-accent animate-spin" />, text: "Running…", color: "text-soc-accent" },
    done: {
      icon: result?.rc_status === "success"
        ? <CheckCircle className="w-3.5 h-3.5 text-soc-accent2" />
        : result?.rc_status === "timeout"
        ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
        : <XCircle className="w-3.5 h-3.5 text-red-400" />,
      text: result?.rc_status ?? "",
      color: statusColor(result?.rc_status),
    },
    error: { icon: <XCircle className="w-3.5 h-3.5 text-red-400" />, text: "Error", color: "text-red-400" },
  }[phase];

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div onClick={phase !== "processing" ? onClose : undefined} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div className="relative w-full max-w-[700px] h-full bg-soc-bg border-l border-soc-border flex flex-col overflow-hidden animate-slide-in">

          {/* Header */}
          <div className="px-6 py-4 border-b border-soc-border bg-soc-surface flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-soc-accent" />
              <div>
                <div className="text-[15px] font-semibold text-soc-text">Remote command</div>
                <div className="font-mono text-[11px] text-soc-muted mt-0.5">
                  {agents.length} agent{agents.length !== 1 ? "s" : ""} available
                </div>
              </div>
            </div>
            <button onClick={phase !== "processing" ? onClose : undefined} disabled={phase === "processing"}
              className="text-soc-muted hover:text-soc-text p-1.5 rounded-md transition-colors disabled:opacity-30">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">

            {/* Agent picker */}
            <div>
              <div className="text-[11px] text-soc-muted uppercase tracking-wider mb-2">Select agent</div>
              {agentsLoading ? (
                <div className="text-[13px] text-soc-muted animate-pulse">Loading agents…</div>
              ) : agents.length === 0 ? (
                <div className="text-[13px] text-soc-muted">No active agents found in RC groups.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {agents.map((agent) => (
                    <button key={agent.id}
                      onClick={() => phase !== "processing" && setSelectedAgent(agent)}
                      disabled={phase === "processing"}
                      className={`text-left p-3 rounded-lg border transition-all duration-150 disabled:opacity-50 ${
                        selectedAgent?.id === agent.id
                          ? "border-soc-accent bg-soc-accent/5"
                          : "border-soc-border bg-soc-surface hover:border-soc-border2"
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
              )}
            </div>

            <div className="border-t border-soc-border" />

            {/* Command input */}
            <div>
              <div className="text-[11px] text-soc-muted uppercase tracking-wider mb-2">Command</div>
              <div className="flex gap-2">
                <input value={command} onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExecute()}
                  placeholder="e.g. df -h" disabled={phase === "processing"}
                  className="flex-1 font-mono text-[13px] bg-soc-surface2 border border-soc-border text-soc-text rounded-lg px-3 py-2 outline-none focus:border-soc-accent transition-colors disabled:opacity-50" />
                <button onClick={handleExecute}
                  disabled={!command.trim() || !selectedAgent || phase === "processing"}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-soc-accent text-soc-bg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
                  <Play className="w-3.5 h-3.5" /> Run
                </button>
              </div>
            </div>

            {/* Status bar */}
            {phase !== "idle" && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-soc-surface border border-soc-border text-[13px]">
                {statusConfig.icon}
                <span className={`font-mono ${statusConfig.color}`}>{statusConfig.text}</span>
                {phase === "processing" && (
                  <span className="ml-auto font-mono text-[11px] text-soc-dim">polling every {POLL_INTERVAL / 1000}s</span>
                )}
                {phase === "done" && result && (
                  <span className="ml-auto font-mono text-[11px] text-soc-dim">exit {result.rc_exit_code}</span>
                )}
              </div>
            )}

            {/* Error */}
            {phase === "error" && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-400">{errorMsg}</div>
            )}

            {/* Result */}
            {phase === "done" && result && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Status",    value: result.rc_status,    color: statusColor(result.rc_status) },
                    { label: "Exit code", value: result.rc_exit_code, color: "text-soc-text" },
                    { label: "Executed",  value: result.rc_executed_at ? new Date(result.rc_executed_at).toLocaleString() : "—", color: "text-soc-text" },
                  ].map((m) => (
                    <div key={m.label} className="bg-soc-surface border border-soc-border rounded-lg p-3">
                      <div className="text-[10px] text-soc-muted uppercase tracking-wider mb-1">{m.label}</div>
                      <div className={`font-mono text-[12px] font-semibold truncate ${m.color}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-soc-border overflow-hidden">
                  <div className="bg-soc-surface px-4 py-2 border-b border-soc-border flex items-center justify-between">
                    <span className="font-mono text-[11px] text-soc-muted">{result.rc_command}</span>
                    <button onClick={() => navigator.clipboard.writeText(formatOutput(result.rc_output).join("\n"))}
                      className="text-[11px] text-soc-accent hover:text-soc-text transition-colors px-2 py-0.5 rounded border border-soc-border">
                      Copy
                    </button>
                  </div>
                  <pre className="font-mono bg-soc-bg p-4 text-[12px] leading-6 overflow-auto text-soc-text whitespace-pre-wrap max-h-72">
                    {formatOutput(result.rc_output).map((line, i) => (
                      <span key={i} className="block">{line}</span>
                    ))}
                  </pre>
                </div>
                <div className="font-mono text-[10px] text-soc-dim text-right">command_id: {result.rc_command_id}</div>
              </div>
            )}

            {/* ── History table ── */}
            <div className="border-t border-soc-border pt-4">
              <button onClick={() => setHistoryOpen((o) => !o)}
                className="flex items-center gap-2 text-[11px] text-soc-muted uppercase tracking-wider mb-3 hover:text-soc-text transition-colors w-full">
                {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Execution history · last 24h
                {history.length > 0 && (
                  <span className="ml-auto font-mono text-[10px] bg-soc-surface2 border border-soc-border px-1.5 py-0.5 rounded">
                    {history.length}
                  </span>
                )}
              </button>

              {historyOpen && (
                <div className="rounded-lg border border-soc-border overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[24px_1fr_80px_70px_50px_120px] gap-0 bg-soc-surface2 border-b border-soc-border px-3 py-2">
                    {["", "Command", "Agent", "Status", "Exit", "Executed"].map((h) => (
                      <div key={h} className="text-[10px] text-soc-muted uppercase tracking-wider">{h}</div>
                    ))}
                  </div>

                  {historyLoading && (
                    <div className="px-4 py-6 text-[13px] text-soc-muted text-center animate-pulse">Loading…</div>
                  )}

                  {!historyLoading && history.length === 0 && (
                    <div className="px-4 py-6 text-[13px] text-soc-muted text-center">No executions in the last 24h</div>
                  )}

                  {!historyLoading && history.map((h, i) => (
                    <button key={h.rc_command_id || i}
                      onClick={() => setSelectedHistory(h)}
                      className="w-full grid grid-cols-[24px_1fr_80px_70px_50px_120px] gap-0 px-3 py-2.5 border-b border-soc-border last:border-0 hover:bg-soc-surface transition-colors text-left">
                      <div className="flex items-center">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(h.rc_status)}`} />
                      </div>
                      <div className="font-mono text-[12px] text-soc-text truncate pr-2">{h.rc_command}</div>
                      <div className="font-mono text-[11px] text-soc-muted truncate">{h.rc_agent_id}</div>
                      <div className={`font-mono text-[11px] ${statusColor(h.rc_status)}`}>{h.rc_status}</div>
                      <div className="font-mono text-[11px] text-soc-muted">{h.rc_exit_code}</div>
                      <div className="font-mono text-[11px] text-soc-dim truncate">
                        {h.rc_executed_at ? new Date(h.rc_executed_at).toLocaleString() : "—"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-soc-border bg-soc-surface shrink-0 flex justify-end">
            <button onClick={phase !== "processing" ? onClose : undefined} disabled={phase === "processing"}
              className="px-5 py-2 rounded-lg text-[13px] font-medium text-soc-muted bg-soc-surface2 border border-soc-border hover:text-soc-text transition-colors disabled:opacity-40">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* History detail modal */}
      {selectedHistory && (
        <HistoryDetail item={selectedHistory} onClose={() => setSelectedHistory(null)} />
      )}
    </>
  );
}
