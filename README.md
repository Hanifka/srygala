<div align="center">

<img src="https://github.com/Hanifka/srygala/blob/main/soc-platform/frontend/public/logo.png" width="200" height="200" alt="Srygala" />

<img width="1911" height="943" alt="image" src="https://github.com/user-attachments/assets/46a8d8fc-ddfd-4473-b0c6-7bc71eeb4fab" />

# Srygala Platform
**Extended Operations for Wazuh | Case Management & Remote Command**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenSearch](https://img.shields.io/badge/OpenSearch-compatible-4051B5?style=flat-square&logo=opensearch)](https://opensearch.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker%20%2F%20Podman-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

</div>
🧪 Beta — Srygala is in active development. Some features (like Remote Command) are still under construction. If you run into bugs, rough edges, or have ideas, please open an issue with as much detail as you can — steps to reproduce, screenshots, logs, environment info. It helps a lot.
---

## Why Srygala Platform?

Srygala Platform is not a new SIEM — it is a **UI and case management layer** that sits on top of your existing Wazuh deployment.

- **Zero database overhead.** There is no separate database whatsoever. All data — events, cases, credentials, and sessions — lives entirely inside your Wazuh Indexer (OpenSearch). No PostgreSQL, no Redis, no user table.
- **80% of the backend is Wazuh.** FastAPI is just a thin proxy. Queries, aggregations, authentication, and storage are all delegated directly to the Wazuh Indexer. If your Wazuh is already running, this platform works out of the box.
- **Credentials are your Wazuh credentials.** You log in with your Wazuh Indexer username and password. No registration, no separate user management — access is controlled entirely by the roles you already have configured in Wazuh.
- **Lightweight and non-invasive.** It does not touch your Wazuh configuration or add any new processes to Wazuh Manager. Run two containers, point them at your Indexer, and you are done.

> ⚠️ **Do not expose this to the public internet.** Because authentication is passed directly to the Wazuh Indexer with no additional security layer, this platform is designed for internal networks only (LAN / VPN). Exposing port 3000 or 8000 publicly means exposing direct access to your Wazuh.

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
<img width="1909" height="940" alt="image" src="https://github.com/user-attachments/assets/13f7d48f-eeb9-4ba8-a333-f73fcec8bf46" />

### Events (Tickets)
Filterable table backed by the `wazuh-offense` index. Supports keyword search across rule description, agent name, and agent IP; minimum severity filter; status filter; and configurable page size (50 → 1000). Bulk select and delete. Click any row to open the investigation panel.
<img width="1916" height="950" alt="image" src="https://github.com/user-attachments/assets/c1fd4a83-2f49-45fa-bccf-3ae0c6d4baf3" />


### Cases
Cases are stored as anchor documents inside `wazuh-offense` with `is_case_anchor: true`. Each anchor holds a `linked_event_ids` list — links are authoritative and survive reindexing. A sidebar lets you create cases, browse them, and open a full case detail view. From the detail view you can link or unlink offense events, edit title/severity/description/notes/analyst/status, and delete the case.
<img width="1903" height="868" alt="image" src="https://github.com/user-attachments/assets/26b6e14c-6ef1-4404-b060-3eca31c946dc" />


### Investigation Panel
Slide-over panel for any event. Shows agent info, rule details, fired-event count, MITRE ATT&CK tactic and technique mapping, rule groups, and an expandable raw JSON view. Inline editable fields: `assigned`, `status`, `note`.
<img width="710" height="939" alt="image" src="https://github.com/user-attachments/assets/a6bacff2-75b3-4db5-8791-4abeff1bca87" />

### Analytics
Four charts computed from the loaded event set: alerts per agent (bar), top triggered rules (horizontal bar), severity trend over time (area), and MITRE ATT&CK coverage (bar).
<img width="1904" height="940" alt="image" src="https://github.com/user-attachments/assets/caccdc6a-7aac-472e-a0db-aedc9aeed1fa" />


### Remote Command Execution ⚠️ *Under Construction*
The main feature is remote command execution on Wazuh agents using built-in capabilities, so there’s no need to install anything extra. It’s useful for incident response and threat hunting directly on the servers, and since it only relies on the existing Wazuh agent, you don’t introduce additional attack surface or extra apps to maintain.

<img width="950" height="440" alt="image" src="https://github.com/user-attachments/assets/03849d1e-4410-430e-a277-580dfa80c03c" />


> **Note:** Remote Command requires non-trivial manual configuration on the Wazuh side (custom rules, decoders, and agent groups). The `install.sh` installer does not yet automate this. Full setup instructions are coming.

### Offense Ingest
A Python script installed at `/var/ossec/integrations/ingest-offense.py` runs every 5 minutes as a Wazuh wodle. It queries `wazuh-alerts-*` for alerts at or above `OFFENSE_RULE_LEVEL` (default 12) from the last 5 minutes and promotes new ones into `wazuh-offense` with `status: open`, `assigned: ""`, and `note: ""`. Duplicates are skipped by `_id`.

---

## Prerequisites 
 
Before installing Srygala Platform you need a working Wazuh deployment. If you don't have one yet:
 
- **Quickest lab setup:** follow the [Wazuh All-in-One installation guide](https://documentation.wazuh.com/current/installation-guide/wazuh-server/installation-assistant.html) — installs Wazuh Manager, Indexer, and Dashboard on a single VM in about 10 minutes.
- **Minimum specs for the lab:** 4 vCPU, 8 GB RAM, 50 GB disk (Ubuntu 22.04 or RHEL 8/9 recommended).
- Once Wazuh is up, enroll at least one agent so you have real alerts flowing into `wazuh-alerts-*`.
You will also need Docker or Podman installed on the machine where you plan to run the platform (can be the same Wazuh server for a lab).
 
---
 
## Step 1 — Verify your Wazuh Indexer is reachable
 
From the machine where you will run the platform, confirm you can reach the Indexer:
 
```bash
curl -k -u admin:YOUR_ADMIN_PASSWORD https://<WAZUH-IP>:9200/_cluster/health
```
 
You should see `"status":"green"` or `"status":"yellow"`. If this fails, check firewall rules — port `9200` must be open between the platform host and the Indexer.
 
Also confirm the Wazuh Manager API is reachable:
 
```bash
curl -k -u wazuh:wazuh https://<WAZUH-IP>:55000/
```
 

 
---
 
## Step 2 — Install the platform
 
Clone the repo onto the **Wazuh Master server** (or any server that can reach it):
 
```bash
git clone https://github.com/srygala/soc-platform.git
cd soc-platform
bash install.sh
```
 
The installer is fully interactive. It will ask you:
 
1. **Deployment mode** — All-in-One (Wazuh on this same server) or Distributed (Wazuh on remote nodes)
2. **Indexer URL** — e.g. `https://192.168.1.10:9200` — the installer auto-detects your LAN IP
3. **Indexer credentials** — same `admin` / password you used in Step 1
4. **Wazuh Manager API credentials** — default is `wazuh` / `wazuh`
5. **SSL verification** — answer `N` for a lab with self-signed certs
6. **RC log filename** — press Enter to accept the default (`srygala-rc.log`)
7. **Offense index name** — press Enter to accept the default (`wazuh-offense`)
8. **Minimum rule level to ingest** — press Enter to accept the default (`12`)
The installer then writes `.env`, updates `docker-compose.yml`, builds and starts the containers, and runs a connectivity test. If the test passes you will see:
 
```
[OK]  Indexer reachable at https://192.168.1.10:9200
[OK]  Login test passed!
```
 
---
 
## Step 3 — Enable offense ingest (Wazuh integration)
 
This is the step that connects the platform to Wazuh alerts. The installer generates the script and gives you a config snippet to paste — you just need to apply it.
 
**3a. Add the wodle block to ossec.conf**
 
The installer prints a block like this at the end — it is also saved at `/var/ossec/integrations/wodle-ingest.conf`:
 
```xml
<!-- Add inside <ossec_config> in /var/ossec/etc/ossec.conf -->
 
  <wodle name="command">
    <disabled>no</disabled>
    <tag>srygala-ingest</tag>
    <command>/usr/bin/python3 /var/ossec/integrations/ingest-offense.py</command>
    <interval>5m</interval>
    <run_on_start>yes</run_on_start>
    <timeout>1200</timeout>
  </wodle>
```
 
Open `ossec.conf` and paste this block inside `<ossec_config>`:
 
```bash
vi /var/ossec/etc/ossec.conf
```
 
**3b. Restart Wazuh Manager**
 
```bash
systemctl restart wazuh-manager
```
 
**3c. Verify ingest is running**
 
Within 5 minutes you should see log output:
 
```bash
tail -f /var/log/wazuh_offense_ingest.log
```
 
Expected output:
```
[INFO] Found 14 alerts to ingest
[INFO] Ingested alert abc123...
[INFO] Done — ingested: 14, skipped (duplicates): 0
```
 
---
 
## Step 4 — Open the dashboard
 
| Service      | URL                              |
|--------------|----------------------------------|
| Dashboard    | `http://<YOUR-IP>:3000`          |
| Backend API  | `http://<YOUR-IP>:8000/docs`     |
 
Log in with your **Wazuh Indexer credentials** (the same `admin` password from Step 1).
 
You should immediately see events populating on the Dashboard and Events tabs as the ingest wodle runs every 5 minutes.
 
> ⚠️ **Keep this on your internal network.** Do not expose ports 3000 or 8000 to the public internet — see [Why Srygala Platform?](#why-srygala-platform) above.
 
---
 
## Deployment modes

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
