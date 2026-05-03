"""
Configuration — all env-driven with safe defaults.
"""
import os

"""
Configuration — all env-driven with safe defaults.
"""
import os

INDEXER_HOSTS      = [url.strip() for url in os.getenv("INDEXER_URL", "https://127.0.0.1:9200").split(",")]
INDEXER_VERIFY_SSL = os.getenv("INDEXER_VERIFY_SSL", "false").lower() == "true"
OFFENSE_INDEX      = os.getenv("OFFENSE_INDEX", "wazuh-offense")
DEFAULT_PAGE_SIZE  = int(os.getenv("DEFAULT_PAGE_SIZE", "50"))
MAX_PAGE_SIZE      = int(os.getenv("MAX_PAGE_SIZE", "1000"))

# ── Wazuh Manager API ─────────────────────────────────────
WAZUH_API_URL      = os.getenv("WAZUH_API_URL",  "https://127.0.0.1:55000")
WAZUH_API_USER     = os.getenv("WAZUH_API_USER", "wazuh")
WAZUH_API_PASS     = os.getenv("WAZUH_API_PASS", "wazuh")
WAZUH_API_SSL      = os.getenv("WAZUH_API_VERIFY_SSL", "false").lower() == "true"

# ── Remote Command ────────────────────────────────────────
RC_DISPATCH_LOG    = os.getenv("RC_DISPATCH_LOG", "/var/log/ibm.log")
RC_RESULT_INDEX    = os.getenv("RC_RESULT_INDEX", "wazuh-alerts-*")
RC_GROUPS          = os.getenv("RC_GROUPS",        "cmd-exec-runner-linux")
