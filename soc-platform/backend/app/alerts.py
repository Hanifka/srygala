"""
Raw alert operations — query the wazuh-alerts-* indices directly.

These are separate from "tickets" (cases). Alerts are raw Wazuh events;
tickets are promoted alerts stored in the wazuh-offense index.
"""

import os
from typing import Optional

from .indexer import Indexer

ALERTS_INDEX = os.getenv("ALERTS_INDEX", "wazuh-alerts-*")


def search_alerts(
    client: Indexer,
    size: int = 25,
    from_: int = 0,
    agent_name: Optional[str] = None,
    rule_id: Optional[str] = None,
    min_level: int = 0,
    time_range: str = "24h",
) -> dict:
    """
    Query raw Wazuh alerts.
    Useful for the investigation panel or a future "Alerts" view.
    """
    must = [
        {"range": {"@timestamp": {"gte": f"now-{time_range}", "lte": "now"}}},
    ]

    if agent_name:
        must.append({"term": {"agent.name": agent_name}})

    if rule_id:
        must.append({"term": {"rule.id": rule_id}})

    if min_level > 0:
        must.append({"range": {"rule.level": {"gte": min_level}}})

    query = {
        "size": size,
        "from": from_,
        "sort": [{"@timestamp": {"order": "desc"}}],
        "query": {"bool": {"must": must}},
    }

    result = client.search(ALERTS_INDEX, query)
    hits = result.get("hits", {})

    alerts = []
    for h in hits.get("hits", []):
        src = h["_source"]
        alerts.append({
            "id": h["_id"],
            "index": h["_index"],
            "timestamp": src.get("@timestamp"),
            "agent": src.get("agent", {}),
            "rule": src.get("rule", {}),
            "data": src.get("data", {}),
            "location": src.get("location"),
            "manager": src.get("manager", {}),
        })

    return {
        "total": hits.get("total", {}).get("value", 0),
        "alerts": alerts,
    }


def get_alert_count_by_agent(client: Indexer, time_range: str = "24h") -> list:
    """Aggregation: alert count grouped by agent name."""

    query = {
        "size": 0,
        "query": {
            "range": {"@timestamp": {"gte": f"now-{time_range}", "lte": "now"}},
        },
        "aggs": {
            "agents": {
                "terms": {"field": "agent.name", "size": 50},
            }
        },
    }

    result = client.search(ALERTS_INDEX, query)
    buckets = result.get("aggregations", {}).get("agents", {}).get("buckets", [])

    return [{"agent": b["key"], "count": b["doc_count"]} for b in buckets]


def get_alert_count_by_level(client: Indexer, time_range: str = "24h") -> list:
    """Aggregation: alert count grouped by rule level."""

    query = {
        "size": 0,
        "query": {
            "range": {"@timestamp": {"gte": f"now-{time_range}", "lte": "now"}},
        },
        "aggs": {
            "levels": {
                "terms": {"field": "rule.level", "size": 20, "order": {"_key": "asc"}},
            }
        },
    }

    result = client.search(ALERTS_INDEX, query)
    buckets = result.get("aggregations", {}).get("levels", {}).get("buckets", [])

    return [{"level": b["key"], "count": b["doc_count"]} for b in buckets]
