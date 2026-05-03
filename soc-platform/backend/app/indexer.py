"""
Reusable client for the Wazuh Indexer (OpenSearch).

Every API endpoint gets an Indexer instance via FastAPI's Depends()
so credentials are always per-request (no shared session).
"""

import requests
from opensearchpy import OpenSearch
from .config import INDEXER_HOSTS, INDEXER_VERIFY_SSL



"""
Reusable client for the Wazuh Indexer (OpenSearch).
Supports single node or multi-node cluster via INDEXER_URL.
"""

from opensearchpy import OpenSearch
from .config import INDEXER_HOSTS, INDEXER_VERIFY_SSL


class Indexer:
    """Wrapper around opensearch-py — works for 1 or 3 node clusters."""

    def __init__(self, username: str, password: str):
        self.client = OpenSearch(
            hosts=INDEXER_HOSTS,
            http_auth=(username, password),
            use_ssl=True,
            verify_certs=INDEXER_VERIFY_SSL,
            ssl_show_warn=False,
        )

    def search(self, index: str, body: dict) -> dict:
        return self.client.search(index=index, body=body)

    def get_doc(self, index: str, doc_id: str) -> dict:
        return self.client.get(index=index, id=doc_id)

    def update_doc(self, index: str, doc_id: str, doc: dict) -> dict:
        return self.client.update(
           index=index,
           id=doc_id,
           body={"doc": doc},
           refresh=True  # force immediate refresh
        )
     
    def delete_doc(self, index: str, doc_id: str) -> dict:
    	return self.client.delete(
           index=index,
           id=doc_id,
           refresh=True  # force immediate refresh
        )
	    

    def bulk(self, payload: str) -> dict:
    	return self.client.bulk(
           body=payload,
           refresh=True  # force immediate refresh
        )
	

    def auth_info(self) -> dict:
        return self.client.transport.perform_request(
            "GET", "/_plugins/_security/authinfo"
        )


