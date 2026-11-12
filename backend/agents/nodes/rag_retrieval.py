from typing import Dict, Any
from ..state import AgentState
from rag.service import RAGService
import logging

logger = logging.getLogger(__name__)

def rag_retrieval_node(state: AgentState) -> Dict[str, Any]:
    dataset_id = str(state.get("dataset_id", "unknown"))
    
    try:
        rag_service = RAGService()
        
        # Index the structured state into ChromaDB
        rag_service.index_evidence(state)
        
        # Perform retrieval
        query = "What are the most critical business insights, trends, risks, and forecasts for decision making?"
        retrieved = rag_service.retrieve_evidence(query=query, dataset_id=dataset_id)
        
        return {
            "current_step": "rag_retrieval",
            "workflow_status": "in_progress",
            "retrieved_evidence": retrieved
        }
        
    except Exception as e:
        logger.error(f"RAG retrieval failed: {e}")
        return {
            "current_step": "rag_retrieval",
            "workflow_status": "in_progress", # Don't crash, just proceed
            "retrieved_evidence": [],
            "errors": state.get("errors", []) + [f"RAG Retrieval failed: {str(e)}"]
        }
