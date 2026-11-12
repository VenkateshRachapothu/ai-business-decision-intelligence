from typing import Dict, Any
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.cache_service import get_cached_service_result
from ..state import AgentState

def analysis_node(state: AgentState) -> Dict[str, Any]:
    file_path = state.get("processed_file_path")
    if not file_path or not os.path.exists(file_path):
        return {
            "current_step": "analysis",
            "workflow_status": "error",
            "errors": state.get("errors", []) + ["Processed file path missing or invalid."]
        }
        
    file_type = "csv" if file_path.lower().endswith(".csv") else "xlsx"
    
    try:
        analytics = get_cached_service_result(file_path, file_type, "analytics")
        trends = get_cached_service_result(file_path, file_type, "trends")
        outliers = get_cached_service_result(file_path, file_type, "outliers")
    except Exception as e:
        return {
            "current_step": "analysis",
            "workflow_status": "error",
            "errors": state.get("errors", []) + [f"Analysis service failed: {str(e)}"]
        }
        
    return {
        "current_step": "analysis",
        "workflow_status": "in_progress",
        "analytics_result": analytics if not isinstance(analytics, dict) or "error" not in analytics else None,
        "trend_result": trends if not isinstance(trends, dict) or "error" not in trends else None,
        "outlier_result": outliers if not isinstance(outliers, dict) or "error" not in outliers else None,
    }
