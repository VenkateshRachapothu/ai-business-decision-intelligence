from typing import Dict, Any
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.cache_service import get_cached_service_result
from ..state import AgentState

def forecasting_node(state: AgentState) -> Dict[str, Any]:
    file_path = state.get("processed_file_path")
    if not file_path or not os.path.exists(file_path):
        return {
            "current_step": "forecasting",
            "workflow_status": "error",
            "errors": state.get("errors", []) + ["Processed file path missing or invalid."]
        }
        
    file_type = "csv" if file_path.lower().endswith(".csv") else "xlsx"
    
    # Check if forecasting is capable based on data_understanding_result
    du_result = state.get("data_understanding_result", {})
    capabilities = du_result.get("capabilities", {})
    if not capabilities.get("forecasting", True):
        return {
            "current_step": "forecasting",
            "workflow_status": "in_progress",
            "forecast_result": {
                "status": "not_available",
                "reason": "Dataset lacks suitable date or demand (quantity/revenue) information for forecasting.",
                "limitations": du_result.get("limitations", [])
            }
        }
    
    try:
        forecast = get_cached_service_result(file_path, file_type, "forecast")
        
        # If forecasting returned an error dict natively
        if isinstance(forecast, dict) and "error" in forecast:
            return {
                "current_step": "forecasting",
                "workflow_status": "in_progress",
                "forecast_result": {
                    "status": "not_available",
                    "reason": forecast["error"],
                    "limitations": []
                }
            }
            
    except Exception as e:
        return {
            "current_step": "forecasting",
            "workflow_status": "error",
            "errors": state.get("errors", []) + [f"Forecasting service failed: {str(e)}"]
        }
        
    return {
        "current_step": "forecasting",
        "workflow_status": "in_progress",
        "forecast_result": forecast
    }
