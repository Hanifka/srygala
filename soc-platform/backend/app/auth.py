"""
Authentication dependency.

Every protected endpoint declares `client = Depends(get_client)`.
This extracts HTTP Basic creds, validates them against the Wazuh Indexer,
and returns a ready-to-use Indexer instance.
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .indexer import Indexer

security = HTTPBasic()


def get_client(credentials: HTTPBasicCredentials = Depends(security)) -> Indexer:
    """
    Validate credentials against the Wazuh Indexer security plugin.
    Returns an authenticated Indexer client on success, 401 on failure.
    """
    client = Indexer(credentials.username, credentials.password)

    try:
        client.auth_info()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return client

def get_credentials(credentials: HTTPBasicCredentials = Depends(security)) -> tuple:
    """
    Returns (username, password) tuple for endpoints that need to
    forward credentials to the Wazuh Manager API directly.
    """
    return (credentials.username, credentials.password)
