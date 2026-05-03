#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Srygala — Installer
#  Supports: All-in-One  |  Distributed (master + remote indexer)
#  Compatible: Docker / Podman + podman-compose
#  Note: Run this ON the Wazuh Master server
# ─────────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Srygala — Installer                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ═════════════════════════════════════════════════════════════
#  PART 1 — SRYGALA PLATFORM (Docker)
# ═════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────
#  Detect container runtime
# ─────────────────────────────────────────────────────────────
COMPOSE_CMD=""
if command -v podman-compose >/dev/null 2>&1; then
  COMPOSE_CMD="podman-compose"
  info "Detected runtime: Podman (podman-compose)"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
  info "Detected runtime: Docker (docker-compose)"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  info "Detected runtime: Docker (docker compose v2)"
else
  error "No container runtime found. Install docker-compose or podman-compose first."
fi

[[ -f "$SCRIPT_DIR/docker-compose.yml" ]] || error "docker-compose.yml not found. Run from inside the srygala/ directory."
cd "$SCRIPT_DIR"

# ─────────────────────────────────────────────────────────────
#  Detect LAN IP
# ─────────────────────────────────────────────────────────────
LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
[[ -z "$LAN_IP" ]] && LAN_IP=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^10\.89\.' | grep -v '^127\.' | head -1)
[[ -z "$LAN_IP" ]] && LAN_IP="localhost"
info "Detected host LAN IP: $LAN_IP"

# ─────────────────────────────────────────────────────────────
#  Deployment mode
# ─────────────────────────────────────────────────────────────
echo ""
echo "Select deployment mode:"
echo "  1) All-in-One     (Wazuh Manager + Indexer on THIS server)"
echo "  2) Distributed    (Wazuh Master on THIS server, Indexer on remote nodes)"
echo ""
read -rp "Enter choice [1 or 2]: " MODE
[[ "$MODE" == "1" || "$MODE" == "2" ]] || error "Invalid choice. Enter 1 or 2."

if [[ "$MODE" == "1" ]]; then
  echo ""
  info "All-in-One mode — using LAN IP so containers can reach the host."
  read -rp "  Confirm host LAN IP [$LAN_IP]: " LAN_IP_INPUT
  LAN_IP="${LAN_IP_INPUT:-$LAN_IP}"
  INDEXER_URL="https://${LAN_IP}:9200"
  WAZUH_API_URL="https://${LAN_IP}:55000"
else
  echo ""
  echo -e "${CYAN}── Wazuh Indexer Nodes ────────────────────────────${NC}"
  INDEXER_NODES=(); IDX=1
  while true; do
    read -rp "  Indexer node $IDX IP (leave blank to finish): " NODE
    [[ -z "$NODE" ]] && break
    INDEXER_NODES+=("https://${NODE}:9200")
    ((IDX++))
  done
  [[ ${#INDEXER_NODES[@]} -eq 0 ]] && error "At least one Indexer node is required."
  INDEXER_URL=$(IFS=','; echo "${INDEXER_NODES[*]}")
  info "Indexer URL(s): $INDEXER_URL"

  echo ""
  echo -e "${CYAN}── Wazuh Manager API ───────────────────────────────${NC}"
  read -rp "  Confirm this server LAN IP [$LAN_IP]: " LAN_IP_INPUT
  LAN_IP="${LAN_IP_INPUT:-$LAN_IP}"
  WAZUH_API_URL="https://${LAN_IP}:55000"
fi

# ─────────────────────────────────────────────────────────────
#  Credentials
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}── Wazuh Indexer Credentials ───────────────────────${NC}"
read -rp "  Indexer username [admin]: " INDEXER_USER
INDEXER_USER="${INDEXER_USER:-admin}"
read -srp "  Indexer password: " INDEXER_PASS; echo
[[ -z "$INDEXER_PASS" ]] && error "Indexer password cannot be empty."

echo ""
echo -e "${CYAN}── Wazuh Manager API Credentials ───────────────────${NC}"
echo "  (Different from Indexer — default: wazuh / wazuh)"
read -rp "  Wazuh API username [wazuh]: " WAZUH_API_USER
WAZUH_API_USER="${WAZUH_API_USER:-wazuh}"
read -srp "  Wazuh API password [wazuh]: " WAZUH_API_PASS; echo
WAZUH_API_PASS="${WAZUH_API_PASS:-wazuh}"

echo ""
read -rp "  Srygala host IP for frontend [$LAN_IP]: " FRONTEND_HOST_INPUT
FRONTEND_HOST="${FRONTEND_HOST_INPUT:-$LAN_IP}"

echo ""
read -rp "  Verify SSL certificates? (y/N) [N recommended]: " VERIFY_SSL_INPUT
if [[ "$VERIFY_SSL_INPUT" =~ ^[Yy]$ ]]; then
  INDEXER_VERIFY_SSL=true; WAZUH_API_VERIFY_SSL=true
  warn "SSL verify ON — make sure certs are trusted."
else
  INDEXER_VERIFY_SSL=false; WAZUH_API_VERIFY_SSL=false
fi

# ─────────────────────────────────────────────────────────────
#  Remote Command config
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}── Remote Command ──────────────────────────────────${NC}"
read -rp "  RC agent group [cmd-exec-runner-linux]: " RC_GROUPS_INPUT
RC_GROUPS="${RC_GROUPS_INPUT:-cmd-exec-runner-linux}"

read -rp "  RC dispatch log filename [srygala-rc.log]: " RC_LOG_INPUT
RC_LOG_NAME="$(basename "${RC_LOG_INPUT:-srygala-rc.log}")"
RC_DISPATCH_LOG="/var/log/${RC_LOG_NAME}"
info "RC dispatch log: ${RC_DISPATCH_LOG}"

# ─────────────────────────────────────────────────────────────
#  Offense Ingest config
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}── Offense Ingest ──────────────────────────────────${NC}"
read -rp "  Offense index name [wazuh-offense]: " OFFENSE_INDEX_INPUT
OFFENSE_INDEX="${OFFENSE_INDEX_INPUT:-wazuh-offense}"

read -rp "  Minimum rule level to ingest [12]: " RULE_LEVEL_INPUT
OFFENSE_RULE_LEVEL="${RULE_LEVEL_INPUT:-12}"

# ─────────────────────────────────────────────────────────────
#  Write .env
# ─────────────────────────────────────────────────────────────
cat > .env <<EOF
# Generated by install.sh — $(date)

# ── Indexer ───────────────────────────────────────────────────
INDEXER_URL=${INDEXER_URL}
INDEXER_USER=${INDEXER_USER}
INDEXER_PASS=${INDEXER_PASS}
INDEXER_VERIFY_SSL=${INDEXER_VERIFY_SSL}
OFFENSE_INDEX=${OFFENSE_INDEX}
OFFENSE_RULE_LEVEL=${OFFENSE_RULE_LEVEL}
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=1000

# ── Wazuh Manager API ─────────────────────────────────────────
WAZUH_API_URL=${WAZUH_API_URL}
WAZUH_API_USER=${WAZUH_API_USER}
WAZUH_API_PASS=${WAZUH_API_PASS}
WAZUH_API_VERIFY_SSL=${WAZUH_API_VERIFY_SSL}

# ── Remote Command ────────────────────────────────────────────
RC_DISPATCH_LOG=${RC_DISPATCH_LOG}
RC_RESULT_INDEX=wazuh-alerts-*
RC_GROUPS=${RC_GROUPS}

# ── Frontend ──────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://${FRONTEND_HOST}:8000/api
EOF
success ".env written."

# ─────────────────────────────────────────────────────────────
#  Write docker-compose.yml
# ─────────────────────────────────────────────────────────────
cat > docker-compose.yml <<'COMPOSE'
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - /var/log:/var/log
    networks:
      - srygala-net

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - backend
    networks:
      - srygala-net

networks:
  srygala-net:
    driver: bridge
COMPOSE
success "docker-compose.yml updated."

# ─────────────────────────────────────────────────────────────
#  Ensure RC log file exists
# ─────────────────────────────────────────────────────────────
if [[ ! -f "$RC_DISPATCH_LOG" ]]; then
  touch "$RC_DISPATCH_LOG" && chmod 666 "$RC_DISPATCH_LOG"
  success "${RC_DISPATCH_LOG} created."
fi

# ─────────────────────────────────────────────────────────────
#  Connectivity test
# ─────────────────────────────────────────────────────────────
echo ""
info "Testing Indexer connectivity..."
FIRST_INDEXER=$(echo "$INDEXER_URL" | cut -d',' -f1)
if curl -sk -u "${INDEXER_USER}:${INDEXER_PASS}" \
   "${FIRST_INDEXER}/_cluster/health" --connect-timeout 5 | grep -q '"status"'; then
  success "Indexer reachable at ${FIRST_INDEXER}"
else
  warn "Could not reach Indexer at ${FIRST_INDEXER} — check IP and credentials."
fi

# ─────────────────────────────────────────────────────────────
#  Build and start containers
# ─────────────────────────────────────────────────────────────
echo ""
read -rp "Build and start Srygala now? (Y/n): " START_NOW
if [[ ! "$START_NOW" =~ ^[Nn]$ ]]; then

  info "Tearing down existing containers..."
  $COMPOSE_CMD down 2>/dev/null || true

  info "Removing old images to force clean build..."
  if command -v podman >/dev/null 2>&1; then
    podman rmi localhost/soc-platform_backend:latest 2>/dev/null || true
    podman rmi localhost/soc-platform_frontend:latest 2>/dev/null || true
  else
    docker rmi soc-platform_backend:latest 2>/dev/null || true
    docker rmi soc-platform_frontend:latest 2>/dev/null || true
  fi

  info "Building and starting containers..."
  $COMPOSE_CMD up --build -d

  echo ""
  info "Waiting for backend to be ready..."
  READY=false
  for i in {1..15}; do
    sleep 2
    if curl -s http://localhost:8000/api/health 2>/dev/null | grep -q "ok"; then
      READY=true; break
    fi
    echo -n "."
  done
  echo ""

  if $READY; then
    success "Backend is up!"
  else
    warn "Backend health check timed out. Check: $COMPOSE_CMD logs backend"
  fi

  RESULT=$(curl -s -u "${INDEXER_USER}:${INDEXER_PASS}" \
    "http://localhost:8000/api/tickets?size=1" 2>/dev/null || echo "error")
  if echo "$RESULT" | grep -q '"detail"'; then
    warn "Login test failed — check .env then: $COMPOSE_CMD down && $COMPOSE_CMD up -d"
  else
    success "Login test passed!"
  fi

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  Srygala is running!                                 ║${NC}"
  echo -e "${GREEN}║                                                      ║${NC}"
  echo -e "${GREEN}║  Dashboard  →  http://${FRONTEND_HOST}:3000             ║${NC}"
  echo -e "${GREEN}║  API Docs   →  http://${FRONTEND_HOST}:8000/docs        ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  $COMPOSE_CMD logs -f backend    # live backend logs"
  echo "  $COMPOSE_CMD logs -f frontend   # live frontend logs"
  echo "  $COMPOSE_CMD down               # stop everything"

else
  info "Skipped. To start later: cd $SCRIPT_DIR && $COMPOSE_CMD up --build -d"
fi

# ═════════════════════════════════════════════════════════════
#  PART 2 — OFFENSE INGEST (always on this server = Wazuh Master)
# ═════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Wazuh Offense Ingest — Installer           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

WAZUH_INTEG_DIR="/var/ossec/integrations"
INGEST_SCRIPT="${WAZUH_INTEG_DIR}/ingest-offense.py"
INGEST_ENV="${WAZUH_INTEG_DIR}/.env"
INGEST_LOG="/var/log/wazuh_offense_ingest.log"

# ─────────────────────────────────────────────────────────────
#  Check Wazuh Manager
# ─────────────────────────────────────────────────────────────
if [[ ! -f "/var/ossec/etc/ossec.conf" ]]; then
  warn "Wazuh Manager not found on this server (ossec.conf missing)."
  warn "Offense Ingest requires Wazuh Manager to be installed first."
  warn "Install Wazuh Manager then re-run this installer."
  echo ""
  echo -e "${CYAN}Done.${NC}"
  exit 0
fi

read -rp "Install Offense Ingest now? (Y/n): " INSTALL_INGEST
if [[ "$INSTALL_INGEST" =~ ^[Nn]$ ]]; then
  info "Skipped. Re-run this installer anytime to install Offense Ingest."
  echo -e "${CYAN}Done.${NC}"
  exit 0
fi

# ─────────────────────────────────────────────────────────────
#  Install pip3 + opensearch-py
# ─────────────────────────────────────────────────────────────
echo ""
info "Checking pip3..."
if ! command -v pip3 &>/dev/null; then
  warn "pip3 not found. Installing..."
  if command -v dnf &>/dev/null; then
    dnf install -y python3-pip &>/dev/null && success "pip3 installed via dnf."
  elif command -v yum &>/dev/null; then
    yum install -y python3-pip &>/dev/null && success "pip3 installed via yum."
  elif command -v apt-get &>/dev/null; then
    apt-get update -qq && apt-get install -y python3-pip &>/dev/null && success "pip3 installed via apt-get."
  elif command -v zypper &>/dev/null; then
    zypper install -y python3-pip &>/dev/null && success "pip3 installed via zypper."
  else
    error "Unsupported package manager. Install pip3 manually and re-run."
  fi
else
  success "pip3 already available."
fi

info "Installing opensearch-py..."
pip3 install opensearch-py --quiet 2>/dev/null || \
pip3 install opensearch-py --quiet --break-system-packages 2>/dev/null || \
python3 -m pip install opensearch-py --quiet || \
error "Failed to install opensearch-py."
success "opensearch-py installed."

# ─────────────────────────────────────────────────────────────
#  Generate ingest-offense.py directly to /var/ossec/integrations/
# ─────────────────────────────────────────────────────────────
info "Generating ingest-offense.py..."

cat > "$INGEST_SCRIPT" << 'PYEOF'
#!/usr/bin/env python3
import logging
import os
from urllib.parse import urlparse
from opensearchpy import OpenSearch

# -------------------------
# Logging
# -------------------------
logging.basicConfig(
    filename="/var/log/wazuh_offense_ingest.log",
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# -------------------------
# Load .env from same folder as this script
# -------------------------
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env not found at {env_path}")
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

load_env()

# -------------------------
# Config from .env
# -------------------------
INDEXER_URL    = os.environ["INDEXER_URL"]
INDEXER_USER   = os.environ["INDEXER_USER"]
INDEXER_PASS   = os.environ["INDEXER_PASS"]
INDEXER_VERIFY = os.environ.get("INDEXER_VERIFY_SSL", "false").lower() == "true"
SOURCE_INDEX   = os.environ.get("RC_RESULT_INDEX", "wazuh-alerts-*")
TARGET_INDEX   = os.environ.get("OFFENSE_INDEX", "wazuh-offense")
RULE_LEVEL_MIN = int(os.environ.get("OFFENSE_RULE_LEVEL", "12"))

_parsed = urlparse(INDEXER_URL)
_host   = _parsed.hostname
_port   = _parsed.port or 9200

# -------------------------
# OpenSearch connection
# -------------------------
client = OpenSearch(
    hosts        = [{"host": _host, "port": _port}],
    http_auth    = (INDEXER_USER, INDEXER_PASS),
    use_ssl      = _parsed.scheme == "https",
    verify_certs = INDEXER_VERIFY,
)

# -------------------------
# Auto-create index if not exist
# -------------------------
def ensure_index():
    if not client.indices.exists(index=TARGET_INDEX):
        client.indices.create(index=TARGET_INDEX)
        logger.info(f"Index '{TARGET_INDEX}' created.")
    else:
        logger.info(f"Index '{TARGET_INDEX}' already exists.")

# -------------------------
# Query
# -------------------------
query = {
    "size": 1000,
    "query": {
        "bool": {
            "filter": [
                {"range": {"@timestamp": {"gte": "now-5m"}}},
                {"range": {"rule.level": {"gte": RULE_LEVEL_MIN}}}
            ]
        }
    }
}

# -------------------------
# Main
# -------------------------
try:
    ensure_index()

    res  = client.search(index=SOURCE_INDEX, body=query)
    hits = res["hits"]["hits"]
    logger.info(f"Found {len(hits)} alerts to ingest")

    ingested = 0
    skipped  = 0

    for alert in hits:
        alert_id = alert["_id"]
        src      = alert["_source"]

        if client.exists(index=TARGET_INDEX, id=alert_id):
            skipped += 1
            continue

        offense = src.copy()
        offense["assigned"] = ""
        offense["status"]   = "open"
        offense["note"]     = ""

        client.index(index=TARGET_INDEX, id=alert_id, body=offense)
        ingested += 1
        logger.info(f"Ingested alert {alert_id}")

    logger.info(f"Done — ingested: {ingested}, skipped (duplicates): {skipped}")

except Exception as e:
    logger.error(f"Ingestion error: {e}")
PYEOF

chmod +x "$INGEST_SCRIPT"
chown root:wazuh "$INGEST_SCRIPT" 2>/dev/null || chown root:root "$INGEST_SCRIPT"
success "ingest-offense.py installed at ${INGEST_SCRIPT}"

# ─────────────────────────────────────────────────────────────
#  Copy .env to /var/ossec/integrations/
# ─────────────────────────────────────────────────────────────
info "Copying .env to ${WAZUH_INTEG_DIR}..."
cp "$SCRIPT_DIR/.env" "$INGEST_ENV"
chmod 640 "$INGEST_ENV"
chown root:wazuh "$INGEST_ENV" 2>/dev/null || chown root:root "$INGEST_ENV"
success ".env installed at ${INGEST_ENV}"

# ─────────────────────────────────────────────────────────────
#  Create log file
# ─────────────────────────────────────────────────────────────
touch "$INGEST_LOG" && chmod 666 "$INGEST_LOG"
success "Log file ready at ${INGEST_LOG}"

# ─────────────────────────────────────────────────────────────
#  Generate wodle snippet
# ─────────────────────────────────────────────────────────────
SNIPPET_PATH="${WAZUH_INTEG_DIR}/wodle-ingest.conf"
cat > "$SNIPPET_PATH" << EOF
<!-- Add inside <ossec_config> in /var/ossec/etc/ossec.conf -->

  <wodle name="command">
    <disabled>no</disabled>
    <tag>srygala-ingest</tag>
    <command>/usr/bin/python3 ${INGEST_SCRIPT}</command>
    <interval>5m</interval>
    <run_on_start>yes</run_on_start>
    <timeout>1200</timeout>
  </wodle>
EOF
success "Wodle snippet saved at ${SNIPPET_PATH}"

# ─────────────────────────────────────────────────────────────
#  Test run
# ─────────────────────────────────────────────────────────────
echo ""
info "Running ingest script once to test connectivity..."
python3 "$INGEST_SCRIPT" && TEST_OK=true || TEST_OK=false

if $TEST_OK; then
  success "Ingest script ran without errors."
  info "Last log output:"; tail -5 "$INGEST_LOG"
else
  warn "Ingest script returned an error:"; tail -10 "$INGEST_LOG"
fi

# ─────────────────────────────────────────────────────────────
#  Done
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Offense Ingest installed!                               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}  ── One more step ───────────────────────────────────────${NC}"
echo ""
echo "  1. Add the wodle block to ossec.conf:"
echo "     vi /var/ossec/etc/ossec.conf"
echo ""
cat "$SNIPPET_PATH"
echo ""
echo "  2. Restart Wazuh Manager:"
echo "     systemctl restart wazuh-manager"
echo ""
echo "  Watch ingest logs:"
echo "    tail -f ${INGEST_LOG}"
echo ""
echo -e "${CYAN}Done.${NC}"