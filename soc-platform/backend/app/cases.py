"""
Case Management — stored directly on wazuh-offense documents.

A "case" is represented by an anchor doc in the offense index with:
  is_case_anchor = True

Linked events are tracked via:
  linked_event_ids: ["id1", "id2", ...]   ← stored on the anchor doc

This means links survive even if offense docs are reindexed, and
the link list is always authoritative from a single OpenSearch query.

Fields on the anchor doc:
  case_id           → shared UUID string
  case_title        → str
  case_severity     → low | medium | high | critical
  case_description  → str
  case_notes        → str
  case_created_by   → str
  case_created_at   → ISO timestamp
  is_case_anchor    → True
  linked_event_ids  → list[str]   ← IDs of linked offense docs
  status            → open | investigating | closed
  assigned          → str
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from .config import OFFENSE_INDEX
from .indexer import Indexer


# ── Internal helpers ───────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_anchor(client: Indexer, case_id: str) -> dict:
    """Fetch the anchor doc for a case. Raises 404 if not found."""
    try:
        result = client.client.get(
            index=OFFENSE_INDEX,
            id=f"case-anchor-{case_id}",
        )
        return result
    except Exception:
        raise HTTPException(status_code=404, detail="Case not found")


def _anchor_to_case(anchor_id: str, src: dict, tickets: list[dict] | None = None) -> dict:
    """Build a case summary dict from an anchor doc source."""
    case_id = src.get("case_id", anchor_id.replace("case-anchor-", ""))
    return {
        "id":                case_id,
        "title":             src.get("case_title", "Untitled Case"),
        "severity":          src.get("case_severity", "medium"),
        "description":       src.get("case_description", ""),
        "notes":             src.get("case_notes", ""),
        "created_by":        src.get("case_created_by", ""),
        "created_at":        src.get("case_created_at", ""),
        "assigned":          src.get("assigned", ""),
        "status":            src.get("status", "open"),
        "linked_event_ids":  src.get("linked_event_ids", []),
        "ticket_count":      len(src.get("linked_event_ids", [])),
        "tickets":           tickets if tickets is not None else [],
    }


# ── List all cases ─────────────────────────────────────────

def list_cases(
    client: Indexer,
    size: int = 200,
    from_: int = 0,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
) -> dict:
    """
    Fetch all anchor docs. Each anchor holds linked_event_ids directly.
    Resolves all linked events in a single batch query across all cases.
    """
    must = [{"term": {"is_case_anchor": True}}]

    if severity:
        must.append({"term": {"case_severity": severity}})
    if status:
        must.append({"term": {"status": status}})
    if search:
        must.append({
            "multi_match": {
                "query":  search,
                "fields": ["case_title", "case_description"],
                "type":   "phrase_prefix",
            }
        })

    result = client.search(OFFENSE_INDEX, {
        "size": size,
        "from": from_,
        "query": {"bool": {"must": must}},
        "sort": [{"case_created_at": {"order": "desc"}}],
    })

    hits = result.get("hits", {}).get("hits", [])
    total = result.get("hits", {}).get("total", {}).get("value", 0)

    # Collect all linked_event_ids across every case in one pass
    all_event_ids = []
    for h in hits:
        all_event_ids.extend(h["_source"].get("linked_event_ids", []))

    # Single batch query to OpenSearch for all linked events
    events_by_id: dict[str, dict] = {}
    if all_event_ids:
        events_resp = client.search(OFFENSE_INDEX, {
            "size": len(all_event_ids),
            "query": {"ids": {"values": list(set(all_event_ids))}},
        })
        for e in events_resp.get("hits", {}).get("hits", []):
            s = e["_source"]
            if s.get("is_case_anchor"):
                continue
            events_by_id[e["_id"]] = {
                "id":        e["_id"],
                "timestamp": s.get("@timestamp"),
                "agent":     s.get("agent", {}),
                "rule":      s.get("rule", {}),
                "level":     s.get("rule", {}).get("level"),
                "status":    s.get("status"),
                "assigned":  s.get("assigned"),
                "note":      s.get("note"),
            }

    # Build each case with its resolved tickets
    cases = []
    for h in hits:
        src = h["_source"]
        linked_ids = src.get("linked_event_ids", [])
        tickets = [events_by_id[eid] for eid in linked_ids if eid in events_by_id]
        cases.append(_anchor_to_case(h["_id"], src, tickets))

    return {"total": total, "cases": cases}


# ── Get single case ────────────────────────────────────────

def get_case(client: Indexer, case_id: str) -> dict:
    """Return full case with all linked tickets resolved from OpenSearch."""
    anchor = _get_anchor(client, case_id)
    src = anchor["_source"]
    linked_ids = src.get("linked_event_ids", [])

    tickets = []
    if linked_ids:
        events_resp = client.search(OFFENSE_INDEX, {
            "size": len(linked_ids),
            "query": {"ids": {"values": linked_ids}},
        })
        for e in events_resp.get("hits", {}).get("hits", []):
            s = e["_source"]
            if s.get("is_case_anchor"):
                continue
            tickets.append({
                "id":        e["_id"],
                "timestamp": s.get("@timestamp"),
                "agent":     s.get("agent", {}),
                "rule":      s.get("rule", {}),
                "level":     s.get("rule", {}).get("level"),
                "status":    s.get("status"),
                "assigned":  s.get("assigned"),
                "note":      s.get("note"),
            })

    return _anchor_to_case(anchor["_id"], src, tickets)


# ── Create case ────────────────────────────────────────────

def create_case(client: Indexer, data: dict) -> dict:
    """
    Create a new case anchor doc with optional initial linked event IDs.
    """
    ticket_ids = list(set(data.get("linked_event_ids", [])))
    case_id    = str(uuid.uuid4())
    now        = _now()

    anchor_doc = {
        "case_id":           case_id,
        "case_title":        data.get("title", "Untitled Case"),
        "case_severity":     data.get("severity", "medium"),
        "case_description":  data.get("description", ""),
        "case_notes":        "",
        "case_created_by":   data.get("created_by", ""),
        "case_created_at":   now,
        "@timestamp":        now,
        "status":            "open",
        "assigned":          data.get("assigned", ""),
        "is_case_anchor":    True,
        "linked_event_ids":  ticket_ids,
    }

    client.client.index(
        index=OFFENSE_INDEX,
        id=f"case-anchor-{case_id}",
        body=anchor_doc,
        refresh=True,
    )

    return _anchor_to_case(f"case-anchor-{case_id}", anchor_doc)


# ── Update case metadata ───────────────────────────────────

def update_case(client: Indexer, case_id: str, data: dict) -> dict:
    """Update case-level fields on the anchor doc only."""
    _get_anchor(client, case_id)  # 404 if not found

    field_map = {
        "title":       "case_title",
        "severity":    "case_severity",
        "description": "case_description",
        "notes":       "case_notes",
        "status":      "status",
        "assigned":    "assigned",
    }

    update_doc = {
        field_map.get(k, k): v
        for k, v in data.items()
        if k in field_map
    }

    if not update_doc:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    client.client.update(
        index=OFFENSE_INDEX,
        id=f"case-anchor-{case_id}",
        body={"doc": update_doc},
        refresh=True,
    )

    return {"status": "updated", "case_id": case_id}


# ── Delete case ────────────────────────────────────────────

def delete_case(client: Indexer, case_id: str) -> dict:
    """Delete the anchor doc. Linked offense docs are left untouched."""
    _get_anchor(client, case_id)  # 404 if not found

    client.client.delete(
        index=OFFENSE_INDEX,
        id=f"case-anchor-{case_id}",
        refresh=True,
    )

    return {"status": "deleted", "case_id": case_id}


# ── Link tickets ───────────────────────────────────────────

def link_tickets(client: Indexer, case_id: str, ticket_ids: list[str]) -> dict:
    """
    Add event IDs to the anchor doc's linked_event_ids list.
    Does not modify the offense docs themselves.
    """
    if not ticket_ids:
        raise HTTPException(status_code=400, detail="No ticket IDs provided")

    anchor = _get_anchor(client, case_id)
    existing = set(anchor["_source"].get("linked_event_ids", []))
    updated  = list(existing | set(ticket_ids))

    client.client.update(
        index=OFFENSE_INDEX,
        id=f"case-anchor-{case_id}",
        body={"doc": {"linked_event_ids": updated}},
        refresh=True,
    )

    return {"status": "linked", "case_id": case_id, "linked": len(ticket_ids), "total": len(updated)}


# ── Unlink tickets ─────────────────────────────────────────

def unlink_tickets(client: Indexer, case_id: str, ticket_ids: list[str]) -> dict:
    """
    Remove event IDs from the anchor doc's linked_event_ids list.
    Does not modify the offense docs themselves.
    """
    if not ticket_ids:
        raise HTTPException(status_code=400, detail="No ticket IDs provided")

    anchor = _get_anchor(client, case_id)
    existing = set(anchor["_source"].get("linked_event_ids", []))
    updated  = list(existing - set(ticket_ids))

    client.client.update(
        index=OFFENSE_INDEX,
        id=f"case-anchor-{case_id}",
        body={"doc": {"linked_event_ids": updated}},
        refresh=True,
    )

    return {"status": "unlinked", "case_id": case_id, "unlinked": len(ticket_ids), "remaining": len(updated)}
