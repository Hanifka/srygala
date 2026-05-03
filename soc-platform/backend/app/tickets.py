"""
Ticket (case) operations — search, get, update, delete.
All functions receive an authenticated Indexer client.
"""

import json
from typing import Optional

from fastapi import HTTPException

from .config import OFFENSE_INDEX, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from .indexer import Indexer

# Exclude anchor placeholder docs from all ticket queries
EXCLUDE_ANCHORS = {"must_not": [{"term": {"is_case_anchor": True}}]}


# ── List / search ──────────────────────────────────────────

def list_tickets(
    client: Indexer,
    size: int = DEFAULT_PAGE_SIZE,
    from_: int = 0,
    status: Optional[str] = None,
    min_level: int = 0,
    search: Optional[str] = None,
) -> dict:
    size = min(size, MAX_PAGE_SIZE)

    must_clauses = []

    if status:
        must_clauses.append({"term": {"status": status}})

    if min_level > 0:
        must_clauses.append({"range": {"rule.level": {"gte": min_level}}})

    if search:
        must_clauses.append({
            "multi_match": {
                "query":  search,
                "fields": ["rule.description", "agent.name", "agent.ip"],
                "type":   "phrase_prefix",
            }
        })

    query = {
        "size": size,
        "from": from_,
        "sort": [{"@timestamp": {"order": "desc"}}],
        "query": {
            "bool": {
                "must":     must_clauses if must_clauses else [{"match_all": {}}],
                "must_not": [{"term": {"is_case_anchor": True}}],  # ← exclude anchors
            }
        },
    }

    result = client.search(OFFENSE_INDEX, query)
    hits   = result.get("hits", {})

    tickets = []
    for h in hits.get("hits", []):
        src = h["_source"]
        tickets.append({
            "id":                h["_id"],
            "timestamp":         src.get("@timestamp"),
            "agent":             src.get("agent", {}),
            "rule":              src.get("rule", {}),
            "level":             src.get("rule", {}).get("level"),
            "status":            src.get("status"),
            "assigned":          src.get("assigned"),
            "note":              src.get("note"),
            "case_id":           src.get("case_id"),
            "case_title":        src.get("case_title"),
            "cases_no":          src.get("cases_no", ""),
            "cases_description": src.get("cases_description", ""),
        })

    return {
        "total":   hits.get("total", {}).get("value", 0),
        "tickets": tickets,
    }


# ── Single ticket ──────────────────────────────────────────

def get_ticket(client: Indexer, ticket_id: str) -> dict:
    """Fetch a single ticket by _id — returns full source."""
    try:
        doc = client.get_doc(OFFENSE_INDEX, ticket_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Ticket not found")

    src       = doc.get("_source", {})
    src["id"] = doc["_id"]
    return src


# ── Update ─────────────────────────────────────────────────

ALLOWED_UPDATE_FIELDS = {"assigned", "status", "note", "cases_no", "cases_description"}

def update_ticket(client: Indexer, ticket_id: str, data: dict) -> dict:
    update_doc = {k: v for k, v in data.items() if k in ALLOWED_UPDATE_FIELDS}

    if not update_doc:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    try:
        result = client.update_doc(OFFENSE_INDEX, ticket_id, update_doc)
        return {"status": "updated", "id": ticket_id, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


# ── Delete single ──────────────────────────────────────────

def delete_ticket(client: Indexer, ticket_id: str) -> dict:
    try:
        client.delete_doc(OFFENSE_INDEX, ticket_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Delete failed")

    return {"status": "deleted", "id": ticket_id}


# ── Bulk delete ────────────────────────────────────────────

def bulk_delete_tickets(client: Indexer, ids: list[str]) -> dict:
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    actions = []
    for ticket_id in ids:
        actions.append(json.dumps({"delete": {"_index": OFFENSE_INDEX, "_id": ticket_id}}))

    payload = "\n".join(actions) + "\n"

    try:
        client.bulk(payload)
    except Exception:
        raise HTTPException(status_code=500, detail="Bulk delete failed")

    return {"status": "deleted", "count": len(ids)}
