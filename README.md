<div align="center">

<img src="https://raw.githubusercontent.com/srygala/platform/main/frontend/public/logo.png" width="100" height="100" alt="Srygala" />

# Srygala Platform

**Full-stack SOC platform for Wazuh — case management, analytics, and remote command execution**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenSearch](https://img.shields.io/badge/OpenSearch-compatible-4051B5?style=flat-square&logo=opensearch)](https://opensearch.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker%20%2F%20Podman-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## How it works

```
Browser
   │
   ▼
Next.js 14  ·  React 18  ·  TypeScript  ·  Tailwind  ·  Recharts
   │  HTTP Basic Auth  (pass-through)
   ▼
FastAPI  ·  Python  ·  Uvicorn
   │  OpenSearch REST API          │  Wazuh Manager REST API
   ▼                               ▼
Wazuh Indexer (OpenSearch)     Wazuh Manager :55000
```

Credentials you log in with are forwarded directly to the Wazuh Indexer on every request — no separate user database.

---

## Features

### Dashboard
KPI cards for total, open, investigating, closed, and critical (level ≥ 12) events. Alert severity distribution chart, status pie chart, and a live feed of the five most recent critical events.

### Events (Tickets)
Filterable table backed by the `wazuh-offense` index. Supports keyword search across rule description, agent name, and agent IP; minimum severity filter; status filter; and configurable page size (50 → 1000). Bulk select and delete. Click any row to open the investigation panel.

### Cases
Cases are stored as anchor documents inside `wazuh-offense` with `is_case_anchor: true`. Each anchor holds a `linked_event_ids` list — links are authoritative and survive reindexing. A sidebar lets you create cases, browse them, and open a full case detail view. From the detail view you can link or unlink offense events, edit title/severity/description/notes/analyst/status, and delete the case.

### Investigation Panel
Slide-over panel for any event. Shows agent info, rule details, fired-event count, MITRE ATT&CK tactic and technique mapping, rule groups, and an expandable raw JSON view. Inline editable fields: `assigned`, `status`, `note`.

### Analytics
Four charts computed from the loaded event set: alerts per agent (bar), top triggered rules (horizontal bar), severity trend over time (area), and MITRE ATT&CK coverage (bar).

### Remote Command Execution ⚠️ *Under Construction*
Dispatch shell commands to active Wazuh agents in configured groups. The backend writes dispatch entries to a log file on the Wazuh Master server; the Wazuh agent picks them up and writes results back to `wazuh-alerts-*` under rule ID `999019`. The frontend polls `/api/rc/result` every 3 seconds (90 s timeout) and displays stdout, exit code, and status. A 24-hour execution history table is shown below the command panel.

> **Note:** Remote Command requires non-trivial manual configuration on the Wazuh side (custom rules, decoders, and agent groups). The `install.sh` installer does not yet automate this. Full setup instructions are coming.

### Offense Ingest
A Python script installed at `/var/ossec/integrations/ingest-offense.py` runs every 5 minutes as a Wazuh wodle. It queries `wazuh-alerts-*` for alerts at or above `OFFENSE_RULE_LEVEL` (default 12) from the last 5 minutes and promotes new ones into `wazuh-offense` with `status: open`, `assigned: ""`, and `note: ""`. Duplicates are skipped by `_id`.

---

## Installation

Run `install.sh` on the **Wazuh Master server**. It supports Docker and Podman and walks you through everything interactively.

```bash
unzip platform.zip
cd platform
bash install.sh
```

The installer:
1. Auto-detects Docker or Podman (podman-compose / docker-compose / docker compose v2)
2. Detects your LAN IP
3. Prompts for deployment mode — All-in-One or Distributed
4. Collects Indexer URL(s), credentials, and Wazuh Manager API URL/credentials
5. Writes `.env` and `docker-compose.yml`
6. Creates the RC dispatch log file under `/var/log/`
7. Tests Indexer connectivity
8. Builds and starts containers
9. Installs `ingest-offense.py` into `/var/ossec/integrations/` and outputs the wodle config snippet to add to `ossec.conf`

### All-in-One

Wazuh Manager + Indexer on the same server as the platform.

```
INDEXER_URL   →  https://<LAN-IP>:9200
WAZUH_API_URL →  https://<LAN-IP>:55000
```

### Distributed

Wazuh Manager on this server, Indexer on remote nodes.

```
┌─────────────────────┐       ┌──────────────────────────────────┐
│  Platform host      │       │  Wazuh Cluster                   │
│                     │:9200  │  ┌──────────────────────────┐    │
│  Frontend  :3000    ├──────▶│  │  Indexer  10.0.0.11-13   │    │
│  Backend   :8000    │       │  └──────────────────────────┘    │
│                     │:55000 │  ┌──────────────────────────┐    │
│                     ├──────▶│  │  Manager  10.0.0.10      │    │
└─────────────────────┘       │  └──────────────────────────┘    │
                              └──────────────────────────────────┘
```

For multi-node clusters, provide all Indexer IPs comma-separated — `opensearch-py` round-robins automatically:

```env
INDEXER_URL=https://10.0.0.11:9200,https://10.0.0.12:9200,https://10.0.0.13:9200
```

---

## Configuration

`install.sh` generates `.env` for you. Reference:

| Variable | Default | Description |
|----------|---------|-------------|
| `INDEXER_URL` | `https://127.0.0.1:9200` | Comma-separated Indexer node URLs |
| `INDEXER_USER` | `admin` | Indexer username |
| `INDEXER_PASS` | — | Indexer password |
| `INDEXER_VERIFY_SSL` | `false` | Verify Indexer TLS certs |
| `OFFENSE_INDEX` | `wazuh-offense` | Index for cases and promoted events |
| `OFFENSE_RULE_LEVEL` | `12` | Minimum rule level for offense ingest |
| `DEFAULT_PAGE_SIZE` | `50` | Default query page size |
| `MAX_PAGE_SIZE` | `1000` | Maximum query page size |
| `WAZUH_API_URL` | `https://127.0.0.1:55000` | Wazuh Manager API URL |
| `WAZUH_API_USER` | `wazuh` | Wazuh Manager API username |
| `WAZUH_API_PASS` | `wazuh` | Wazuh Manager API password |
| `WAZUH_API_VERIFY_SSL` | `false` | Verify Manager TLS certs |
| `RC_DISPATCH_LOG` | `/var/log/srygala-rc.log` | RC command dispatch log (mounted from host into container) |
| `RC_RESULT_INDEX` | `wazuh-alerts-*` | Index pattern for RC result polling |
| `RC_GROUPS` | `cmd-exec-runner-linux` | Comma-separated Wazuh agent groups for RC |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | Frontend-facing backend URL |

---

## API Reference

All endpoints require **HTTP Basic Auth** (Wazuh Indexer credentials).  
Interactive docs at `http://<host>:8000/docs` · ReDoc at `/redoc`.

### Events

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/tickets` | `size`, `from`, `status`, `min_level`, `search` |
| `GET` | `/api/tickets/{id}` | Full source document |
| `PATCH` | `/api/tickets/{id}` | Allowed fields: `assigned`, `status`, `note`, `cases_no`, `cases_description` |
| `DELETE` | `/api/tickets/{id}` | — |
| `POST` | `/api/tickets/delete` | Body: `{ "ids": [...] }` |

### Cases

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/cases` | `size`, `from`, `status`, `severity`, `search` — resolves all linked events in a single batch query |
| `POST` | `/api/cases` | Body: `title`, `description`, `severity`, `assigned`, `linked_ticket_ids` — `created_by` injected server-side from auth |
| `GET` | `/api/cases/{id}` | Anchor doc + resolved linked events |
| `PATCH` | `/api/cases/{id}` | Any of `title`, `severity`, `description`, `notes`, `status`, `assigned` |
| `DELETE` | `/api/cases/{id}` | Deletes anchor only — linked offense docs are left untouched |
| `POST` | `/api/cases/{id}/link` | Body: `{ "ticket_ids": [...] }` |
| `POST` | `/api/cases/{id}/unlink` | Body: `{ "ticket_ids": [...] }` |

### Alerts (raw)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/alerts` | `size`, `from`, `agent_name`, `rule_id`, `min_level`, `time_range` |
| `GET` | `/api/alerts/stats/agents` | Alert count per agent — `time_range` |
| `GET` | `/api/alerts/stats/levels` | Alert count per rule level — `time_range` |

### Remote Command ⚠️ *Under Construction*

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/rc/agents` | Active agents across all `RC_GROUPS` — uses login credentials to call Wazuh Manager API |
| `POST` | `/api/rc/execute` | Body: `agent_id`, `command`, `requested_by` — appends JSON entry to `RC_DISPATCH_LOG` |
| `POST` | `/api/rc/result` | Body: dispatch metadata — polls `wazuh-alerts-*` for rule ID `999019` |
| `GET` | `/api/rc/history` | `hours` (1–168, default 24) |

### Health

| Method | Path |
|--------|------|
| `GET` | `/api/health` |

---

## Project structure

```
platform/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI app, all routes
│   │   ├── config.py      # Env-driven configuration
│   │   ├── auth.py        # HTTP Basic auth — validates against Indexer on every request
│   │   ├── indexer.py     # OpenSearch client wrapper (single node + cluster)
│   │   ├── tickets.py     # Event CRUD — wazuh-offense index
│   │   ├── cases.py       # Case anchor CRUD + link/unlink
│   │   ├── alerts.py      # Raw wazuh-alerts-* queries + aggregations
│   │   └── rc.py          # RC dispatch (log write), result polling, history
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx       # Dashboard, Events, Analytics, Remote Command views
│   │   └── globals.css
│   ├── components/
│   │   ├── LoginForm.tsx
│   │   ├── Navbar.tsx
│   │   ├── MetricCard.tsx
│   │   ├── Badges.tsx           # LevelBadge, StatusBadge
│   │   ├── TicketTable.tsx
│   │   ├── InvestigationPanel.tsx
│   │   ├── AlertCharts.tsx      # LevelChart, StatusPieChart, AgentChart, TopRulesChart, SeverityAreaChart, MitreChart
│   │   ├── CaseSidebar.tsx
│   │   ├── CaseDetail.tsx
│   │   ├── NewCaseModal.tsx
│   │   ├── CaseLinkDropdown.tsx
│   │   └── RemoteCommandPanel.tsx
│   ├── lib/
│   │   ├── api.ts              # Typed fetch client
│   │   ├── types.ts            # Ticket, Case, Credentials interfaces
│   │   ├── utils.ts
│   │   ├── auth-context.tsx
│   │   └── query-provider.tsx
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── install.sh              # Interactive installer — run on Wazuh Master
```

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Charts | Recharts |
| Data fetching | TanStack React Query, fetch |
| Icons | Lucide React |
| Backend | FastAPI 0.115, Uvicorn, Python 3.11+ |
| Data store | Wazuh Indexer (OpenSearch-compatible) via `opensearch-py` |
| Auth | HTTP Basic — forwarded to Indexer on every request |
| Containers | Docker / Podman + Compose |

---

## Troubleshooting

<details>
<summary><strong>Login fails (401)</strong></summary>

Verify credentials against the Indexer directly:

```bash
curl -k -u admin:YOURPASSWORD https://INDEXER:9200/_plugins/_security/authinfo
```

Test from inside the container:

```bash
docker exec <backend-container> curl -k https://INDEXER:9200
```
</details>

<details>
<summary><strong>Frontend can't reach backend</strong></summary>

Confirm `NEXT_PUBLIC_API_URL` matches the actual backend host and port. In Docker/Podman the `next.config.js` rewrite target must match the compose service name (`backend:8000`).
</details>

<details>
<summary><strong>Cluster — some queries return errors</strong></summary>

All nodes must carry the `wazuh-offense` and `wazuh-alerts-*` indices:

```bash
curl -k -u admin:PASS https://NODE:9200/_cat/nodes
curl -k -u admin:PASS https://NODE:9200/_cat/indices/wazuh-offense
```
</details>

<details>
<summary><strong>Remote Command not working</strong></summary>

- Verify `WAZUH_API_URL` and credentials
- Confirm the agent group in `RC_GROUPS` exists in Wazuh Manager
- The dispatch log must exist and be writable inside the container. The installer mounts `/var/log` from the host, so on the host run:

```bash
touch /var/log/srygala-rc.log && chmod 666 /var/log/srygala-rc.log
```
</details>

<details>
<summary><strong>Offense ingest not picking up alerts</strong></summary>

- Confirm the wodle block is in `/var/ossec/etc/ossec.conf` and Wazuh Manager was restarted after
- Watch the ingest log: `tail -f /var/log/wazuh_offense_ingest.log`
- Confirm `OFFENSE_RULE_LEVEL` matches the severity of alerts you expect to see
</details>
