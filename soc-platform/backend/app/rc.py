"""
Remote Command Execution — rc.py
Uses the same credentials the user logs in with to call Wazuh API.
"""

import json
import requests
from datetime import datetime, timezone
from fastapi import HTTPException
from .indexer import Indexer
from .config import (
    RC_DISPATCH_LOG,
    RC_RESULT_INDEX,
    RC_GROUPS,
    WAZUH_API_URL,
    WAZUH_API_SSL,
)


# ── Wazuh Manager API helpers ─────────────────────────────

def _get_wazuh_token(username: str, password: str) -> str:
    try:
        res = requests.post(
            f"{WAZUH_API_URL}/security/user/authenticate",
            auth=(username, password),
            verify=WAZUH_API_SSL,
            timeout=10,
        )
        res.raise_for_status()
        return res.json()["data"]["token"]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Wazuh API auth failed: {e}")


def get_rc_agents(username: str, password: str) -> list:
    """
    Return active agents across all RC groups.
    Uses the same credentials the user logs in with.
    """
    token  = _get_wazuh_token(username, password)
    groups = [g.strip() for g in RC_GROUPS.split(",") if g.strip()]
    seen   = {}

    for group in groups:
        try:
            res = requests.get(
                f"{WAZUH_API_URL}/groups/{group}/agents",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "select": "id,name,ip,os.name,os.platform,status,lastKeepAlive",
                    "limit": 500,
                },
                verify=WAZUH_API_SSL,
                timeout=10,
            )
            res.raise_for_status()
            items = res.json().get("data", {}).get("affected_items", [])
            for a in items:
                if a.get("status") != "active":
                    continue
                aid = a.get("id")
                if aid not in seen:
                    seen[aid] = {
                        "id":             aid,
                        "name":           a.get("name"),
                        "ip":             a.get("ip"),
                        "os_name":        a.get("os", {}).get("name", "Unknown"),
                        "os_platform":    a.get("os", {}).get("platform", ""),
                        "status":         a.get("status"),
                        "last_keepalive": a.get("lastKeepAlive"),
                        "group":          group,
                    }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Wazuh API failed for group {group}: {e}")

    return list(seen.values())


# ── Dispatch ──────────────────────────────────────────────

def dispatch_command(agent_id: str, command: str, requested_by: str) -> dict:
    dispatch_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    entry = {
        "rc_event_type": "cmd_execution_request",
        "agent_id":      agent_id,
        "command":       command,
        "requested_by":  requested_by,
        "timestamp":     dispatch_time,
    }

    try:
        with open(RC_DISPATCH_LOG, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write dispatch log: {e}")

    return {
        "agent_id":     agent_id,
        "command":      command,
        "requested_by": requested_by,
        "dispatch_time": dispatch_time,
        "status":       "dispatched",
    }


# ── Poll ──────────────────────────────────────────────────
def get_result(client: Indexer, agent_id: str, command: str, requested_by: str, dispatch_time: str) -> dict:
    try:
        body = {
            "size": 1,
            "query": {
                "bool": {
                    "must": [
                        {"term":         {"rule.id":              "999019"}},  # string
                        {"match_phrase": {"data.rc_agent_id":     agent_id}},
                        {"match_phrase": {"data.rc_command":      command}},
                        {"match_phrase": {"data.rc_requested_by": requested_by}},
                        {"range":        {"@timestamp": {"gte":   dispatch_time}}},
                    ]
                }
            },
            "sort": [{"@timestamp": {"order": "desc"}}],
        }

        res  = client.search(index=RC_RESULT_INDEX, body=body)
        hits = res.get("hits", {}).get("hits", [])

        if not hits:
            return {"status": "pending"}

        data = hits[0]["_source"].get("data", {})

        return {
            "status":          "done",
            "rc_command_id":   data.get("rc_command_id"),
            "rc_agent_id":     data.get("rc_agent_id"),
            "rc_command":      data.get("rc_command"),
            "rc_requested_by": data.get("rc_requested_by"),
            "rc_output":       data.get("rc_output"),
            "rc_status":       data.get("rc_status"),
            "rc_exit_code":    data.get("rc_exit_code"),
            "rc_executed_at":  data.get("rc_executed_at"),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexer query failed: {e}")


def get_history(client: Indexer, hours: int = 24) -> list:
    """
    Return last N hours of rule 999019 results, newest first.
    """
    try:
        body = {
            "size": 50,
            "query": {
                "bool": {
                    "must": [
                        {"term":  {"rule.id":      "999019"}},  # string
                        {"range": {"@timestamp":   {"gte": f"now-{hours}h"}}},
                    ]
                }
            },
            "sort": [{"@timestamp": {"order": "desc"}}],
        }
        res  = client.search(index="wazuh-alerts-*", body=body)
        hits = res.get("hits", {}).get("hits", [])

        return [
            {
                "rc_command_id":   h["_source"].get("data", {}).get("rc_command_id"),
                "rc_agent_id":     h["_source"].get("data", {}).get("rc_agent_id"),
                "rc_command":      h["_source"].get("data", {}).get("rc_command"),
                "rc_requested_by": h["_source"].get("data", {}).get("rc_requested_by"),
                "rc_output":       h["_source"].get("data", {}).get("rc_output"),
                "rc_status":       h["_source"].get("data", {}).get("rc_status"),
                "rc_exit_code":    h["_source"].get("data", {}).get("rc_exit_code"),
                "rc_executed_at":  h["_source"].get("data", {}).get("rc_executed_at"),
            }
            for h in hits
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History query failed: {e}")
