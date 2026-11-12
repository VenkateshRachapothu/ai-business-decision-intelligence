from typing import Dict, Any
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.cache_service import get_cached_service_result
from ..state import AgentState

def risk_detection_node(state: AgentState) -> Dict[str, Any]:
    file_path = state.get("processed_file_path")
    if not file_path or not os.path.exists(file_path):
        return {
            "current_step": "risk_detection",
            "workflow_status": "error",
            "errors": state.get("errors", []) + ["Processed file path missing or invalid."]
        }
        
    file_type = "csv" if file_path.lower().endswith(".csv") else "xlsx"
    
    try:
        risks = get_cached_service_result(file_path, file_type, "risks")
        
        # Ensure Olist rules are respected (no confirmed stock-out)
        # The existing risk_service outputs "Possible Stock-Out Risk" and notes inventory is unavailable.
        # Let's double check and enforce this explicitly in the agent layer just to be absolutely safe.
        if isinstance(risks, dict) and "risks" in risks:
            for r in risks["risks"]:
                if "stock" in r.get("risk_type", "").lower() or "inventory" in r.get("explanation", "").lower():
                    # Ensure it says "Possible" and has the disclaimer
                    if "Possible" not in r["risk_type"]:
                        r["risk_type"] = "Possible " + r["risk_type"]
                    
                    found_disclaimer = False
                    for ev in r.get("evidence", []):
                        if "unavailable" in str(ev).lower():
                            found_disclaimer = True
                    
                    if not found_disclaimer:
                        r["evidence"].append("Inventory level unavailable; stock-out risk is estimated from demand behavior.")
        
        if isinstance(risks, dict) and "error" in risks:
            risks = None
            
    except Exception as e:
        return {
            "current_step": "risk_detection",
            "workflow_status": "error",
            "errors": state.get("errors", []) + [f"Risk detection service failed: {str(e)}"]
        }
        
    return {
        "current_step": "risk_detection",
        "workflow_status": "in_progress",
        "risk_result": risks
    }
