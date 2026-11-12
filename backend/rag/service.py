from typing import Dict, Any, List
import logging
from .documents import build_evidence_documents
from .vector_store import VectorStore
from .config import RAG_TOP_K

logger = logging.getLogger(__name__)

# Global singleton to prevent reloading models constantly
_VECTOR_STORE = None

def get_vector_store(persist_dir=None):
    global _VECTOR_STORE
    if _VECTOR_STORE is None:
        if persist_dir:
            _VECTOR_STORE = VectorStore(persist_dir=persist_dir)
        else:
            _VECTOR_STORE = VectorStore()
    return _VECTOR_STORE

class RAGService:
    def __init__(self, persist_dir=None):
        self.vector_store = get_vector_store(persist_dir)

    def index_evidence(self, state: Dict[str, Any]) -> bool:
        try:
            docs = build_evidence_documents(state)
            if docs:
                self.vector_store.add_documents(docs)
            return True
        except Exception as e:
            logger.error(f"Failed to index evidence: {e}")
            return False

    def retrieve_evidence(self, query: str, dataset_id: str, k: int = RAG_TOP_K) -> List[Dict[str, Any]]:
        try:
            docs = self.vector_store.similarity_search(query, dataset_id=dataset_id, k=k)
            results = []
            for d in docs:
                results.append({
                    "content": d.page_content,
                    "metadata": d.metadata
                })
            return results
        except Exception as e:
            logger.error(f"Failed to retrieve evidence: {e}")
            return []
