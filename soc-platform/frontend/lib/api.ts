import type { Credentials, Ticket, Case, CaseListResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

function authHeader(creds: Credentials) {
  return "Basic " + btoa(`${creds.username}:${creds.password}`);
}

function headers(creds: Credentials) {
  return {
    Authorization: authHeader(creds),
    "Content-Type": "application/json",
  };
}

// ── Auth ──────────────────────────────────────────────────

export async function testAuth(creds: Credentials): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/tickets?size=1`, {
      headers: { Authorization: authHeader(creds) },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Tickets ───────────────────────────────────────────────

export async function getTickets(
  creds: Credentials,
  params: { size?: number; from?: number; status?: string; min_level?: number; search?: string } = {}
): Promise<{ total: number; tickets: Ticket[] }> {
  const qs = new URLSearchParams();
  if (params.size)      qs.set("size",      String(params.size));
  if (params.from)      qs.set("from",      String(params.from));
  if (params.status)    qs.set("status",    params.status);
  if (params.min_level) qs.set("min_level", String(params.min_level));
  if (params.search)    qs.set("search",    params.search);

  const res = await fetch(`${API_BASE}/tickets?${qs}`, {
    headers: { Authorization: authHeader(creds) },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function getTicket(creds: Credentials, id: string): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/tickets/${id}`, {
    headers: { Authorization: authHeader(creds) },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function updateTicket(creds: Credentials, id: string, data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/tickets/${id}`, {
    method: "PATCH",
    headers: headers(creds),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function bulkDeleteTickets(creds: Credentials, ids: string[]): Promise<any> {
  const res = await fetch(`${API_BASE}/tickets/delete`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

// ── Cases ─────────────────────────────────────────────────

export async function getCases(
  creds: Credentials,
  params: { size?: number; from?: number; status?: string; severity?: string; search?: string } = {}
): Promise<CaseListResponse> {
  const qs = new URLSearchParams();
  if (params.size)     qs.set("size",     String(params.size));
  if (params.from)     qs.set("from",     String(params.from));
  if (params.status)   qs.set("status",   params.status);
  if (params.severity) qs.set("severity", params.severity);
  if (params.search)   qs.set("search",   params.search);

  const res = await fetch(`${API_BASE}/cases?${qs}`, {
    headers: { Authorization: authHeader(creds) },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function getCase(creds: Credentials, id: string): Promise<Case> {
  const res = await fetch(`${API_BASE}/cases/${id}`, {
    headers: { Authorization: authHeader(creds) },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function createCase(
  creds: Credentials,
  data: { title: string; description?: string; severity?: string; assigned?: string; linked_ticket_ids?: string[] }
): Promise<Case> {
  const res = await fetch(`${API_BASE}/cases`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function updateCase(creds: Credentials, id: string, data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${id}`, {
    method: "PATCH",
    headers: headers(creds),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function deleteCase(creds: Credentials, id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${id}`, {
    method: "DELETE",
    headers: { Authorization: authHeader(creds) },
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function linkTickets(creds: Credentials, caseId: string, ticketIds: string[]): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/link`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify({ ticket_ids: ticketIds }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function unlinkTickets(creds: Credentials, caseId: string, ticketIds: string[]): Promise<any> {
  // POST to /unlink — DELETE with body is unreliable
  const res = await fetch(`${API_BASE}/cases/${caseId}/unlink`, {
    method: "POST",
    headers: headers(creds),
    body: JSON.stringify({ ticket_ids: ticketIds }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}
