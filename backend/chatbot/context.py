import logging
from typing import Dict, Any
from agents.graph import graph

logger = logging.getLogger(__name__)

_CHATBOT_CONTEXT_CACHE = {}

def get_or_build_dataset_context(dataset_id: int, dataset_name: str, file_path: str) -> Dict[str, Any]:
    if dataset_id in _CHATBOT_CONTEXT_CACHE:
        return _CHATBOT_CONTEXT_CACHE[dataset_id]
        
    initial_state = {
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "processed_file_path": file_path,
        "dataset_metadata": {},
        "current_step": "init",
        "workflow_status": "pending",
        "retrieved_evidence": []
    }
    
    logger.info(f"Building full context for dataset {dataset_id}")
    try:
        # Running the graph populates data understanding, analytics, forecast, risks, RAG index, recommendation, and verification
        result = graph.invoke(initial_state)
    except Exception as e:
        logger.error(f"Error invoking graph for context build: {e}")
        raise ValueError("Failed to process dataset context for Chatbot.")
    
    context = {
        "dataset_id": dataset_id,
        "dataset_name": dataset_name,
        "data_understanding": result.get("data_understanding_result", {}),
        "analytics": result.get("analytics_result", {}),
        "trends": result.get("trend_result", {}),
        "outliers": result.get("outlier_result", {}),
        "forecast": result.get("forecast_result", {}),
        "risks": result.get("risk_result", {}),
        "recommendation": result.get("recommendation_result", {}),
        "verification": result.get("verification_result", {})
    }
    
    _CHATBOT_CONTEXT_CACHE[dataset_id] = context
    return context
