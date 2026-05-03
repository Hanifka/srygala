"""
Wazuh SOC Platform — FastAPI Backend
"""

from typing import Optional

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auth import get_client, get_credentials
from .indexer import Indexer
from .tickets import (
    list_tickets,
    get_ticket,
    update_ticket,
    delete_ticket,
    bulk_delete_tickets,
)
from .alerts import (
    search_alerts,
    get_alert_count_by_agent,
    get_alert_count_by_level,
)
from .cases import (
    list_cases,
    get_case,
    create_case,
    update_case,
    delete_case,
    link_tickets,
    unlink_tickets,
)
#from .auto_case import run_auto_case
from .rc import dispatch_command, get_result, get_rc_agents


# ── App ────────────────────────────────────────────────────

app = FastAPI(
    title="Wazuh SOC Platform API",
    version="1.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ─────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════
# TICKET ENDPOINTS
# ══════════════════════════════════════════════════════════

@app.get("/api/tickets")
def api_list_tickets(
    size: int = Query(50, ge=1, le=1000),
    from_: int = Query(0, ge=0, alias="from"),
    status: Optional[str] = None,
    min_level: int = Query(0, ge=0, le=15),
    search: Optional[str] = None,
    client: Indexer = Depends(get_client),
):
    return list_tickets(
        client, size=size, from_=from_,
        status=status, min_level=min_level, search=search,
    )


@app.get("/api/tickets/{ticket_id}")
def api_get_ticket(ticket_id: str, client: Indexer = Depends(get_client)):
    return get_ticket(client, ticket_id)


@app.patch("/api/tickets/{ticket_id}")
def api_update_ticket(
    ticket_id: str, body: dict, client: Indexer = Depends(get_client)
):
    return update_ticket(client, ticket_id, body)


@app.delete("/api/tickets/{ticket_id}")
def api_delete_ticket(ticket_id: str, client: Indexer = Depends(get_client)):
    return delete_ticket(client, ticket_id)


@app.post("/api/tickets/delete")
def api_bulk_delete(body: dict, client: Indexer = Depends(get_client)):
    return bulk_delete_tickets(client, body.get("ids", []))


# ══════════════════════════════════════════════════════════
# ALERT ENDPOINTS
# ══════════════════════════════════════════════════════════

@app.get("/api/alerts")
def api_search_alerts(
    size: int = Query(25, ge=1, le=200),
    from_: int = Query(0, ge=0, alias="from"),
    agent_name: Optional[str] = None,
    rule_id: Optional[str] = None,
    min_level: int = Query(0, ge=0),
    time_range: str = Query("24h"),
    client: Indexer = Depends(get_client),
):
    return search_alerts(
        client, size=size, from_=from_,
        agent_name=agent_name, rule_id=rule_id,
        min_level=min_level, time_range=time_range,
    )


@app.get("/api/alerts/stats/agents")
def api_alert_stats_agents(
    time_range: str = Query("24h"),
    client: Indexer = Depends(get_client),
):
    return get_alert_count_by_agent(client, time_range)


@app.get("/api/alerts/stats/levels")
def api_alert_stats_levels(
    time_range: str = Query("24h"),
    client: Indexer = Depends(get_client),
):
    return get_alert_count_by_level(client, time_range)


# ══════════════════════════════════════════════════════════
# CASE ENDPOINTS
# NOTE: /api/cases/auto MUST stay above /api/cases/{case_id}
#       otherwise FastAPI treats "auto" as a case_id → 404.
# ══════════════════════════════════════════════════════════

class CreateCaseRequest(BaseModel):
    title:             str
    description:       str = ""
    severity:          str = "medium"
    assigned:          str = ""
    linked_ticket_ids: list[str] = []


class LinkTicketsRequest(BaseModel):
    ticket_ids: list[str]


# ── Auto-case ──────────────────────────────────────────────



# ── List / Create ──────────────────────────────────────────

@app.get("/api/cases")
def api_list_cases(
    size: int = Query(200, ge=1, le=1000),
    from_: int = Query(0, ge=0, alias="from"),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    client: Indexer = Depends(get_client),
):
    return list_cases(
        client, size=size, from_=from_,
        status=status, severity=severity, search=search,
    )


@app.post("/api/cases")
def api_create_case(
    body: CreateCaseRequest,
    client: Indexer = Depends(get_client),
    creds: tuple = Depends(get_credentials),
):
    data = body.dict()
    data["created_by"] = creds[0]  # inject username server-side
    return create_case(client, data)


# ── Single case ────────────────────────────────────────────

@app.get("/api/cases/{case_id}")
def api_get_case(case_id: str, client: Indexer = Depends(get_client)):
    return get_case(client, case_id)


@app.patch("/api/cases/{case_id}")
def api_update_case(
    case_id: str,
    body: dict,
    client: Indexer = Depends(get_client),
):
    return update_case(client, case_id, body)


@app.delete("/api/cases/{case_id}")
def api_delete_case(case_id: str, client: Indexer = Depends(get_client)):
    return delete_case(client, case_id)


# ── Link / Unlink ──────────────────────────────────────────

@app.post("/api/cases/{case_id}/link")
def api_link_tickets(
    case_id: str,
    body: LinkTicketsRequest,
    client: Indexer = Depends(get_client),
):
    return link_tickets(client, case_id, body.ticket_ids)


@app.post("/api/cases/{case_id}/unlink")
def api_unlink_tickets(
    case_id: str,
    body: LinkTicketsRequest,
    client: Indexer = Depends(get_client),
):
    return unlink_tickets(client, case_id, body.ticket_ids)


# ══════════════════════════════════════════════════════════
# REMOTE COMMAND ENDPOINTS
# ══════════════════════════════════════════════════════════

class RCExecuteRequest(BaseModel):
    agent_id:     str
    command:      str
    requested_by: str


class RCPollRequest(BaseModel):
    agent_id:      str
    command:       str
    requested_by:  str
    dispatch_time: str


@app.get("/api/rc/agents")
def api_rc_agents(creds: tuple = Depends(get_credentials)):
    username, password = creds
    return get_rc_agents(username, password)


@app.post("/api/rc/execute")
def api_rc_execute(body: RCExecuteRequest, client: Indexer = Depends(get_client)):
    return dispatch_command(
        agent_id=body.agent_id,
        command=body.command,
        requested_by=body.requested_by,
    )


@app.post("/api/rc/result")
def api_rc_result(body: RCPollRequest, client: Indexer = Depends(get_client)):
    return get_result(
        client,
        agent_id=body.agent_id,
        command=body.command,
        requested_by=body.requested_by,
        dispatch_time=body.dispatch_time,
    )


@app.get("/api/rc/history")
def api_rc_history(
    hours: int = Query(24, ge=1, le=168),
    client: Indexer = Depends(get_client),
):
    from .rc import get_history
    return get_history(client, hours=hours)
