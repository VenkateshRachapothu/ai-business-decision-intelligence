from typing import Dict, Any
import pandas as pd
import os
import sys

# To ensure we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.cache_service import get_cached_df
from app.services.analytics_service import map_columns
from ..state import AgentState

def data_understanding_node(state: AgentState) -> Dict[str, Any]:
    file_path = state.get("processed_file_path")
    if not file_path or not os.path.exists(file_path):
        return {
            "current_step": "data_understanding",
            "workflow_status": "error",
            "errors": state.get("errors", []) + ["Processed file path is missing or invalid."]
        }
        
    # Determine file type based on extension
    file_type = "csv" if file_path.lower().endswith(".csv") else "xlsx"
    
    # Use cached df to avoid redundant disk I/O
    try:
        df = get_cached_df(file_path, file_type)
    except Exception as e:
        return {
            "current_step": "data_understanding",
            "workflow_status": "error",
            "errors": state.get("errors", []) + [f"Failed to load dataset: {str(e)}"]
        }
        
    mapping = map_columns(df)
    
    # Heuristic for customer column
    cols_lower = {c: c.lower() for c in df.columns}
    customer_col = None
    for orig, lower in cols_lower.items():
        if any(x in lower for x in ['customer', 'user', 'client', 'buyer']):
            customer_col = orig
            break
            
    # Compile column summary
    column_summary = []
    for col in df.columns:
        # Avoid internal columns like _parsed_date
        if col.startswith("_"):
            continue
        column_summary.append({
            "name": col,
            "type": str(df[col].dtype),
            "missing_ratio": float(df[col].isna().mean())
        })
        
    # Check capabilities
    has_date = bool(mapping.get('date'))
    has_quantity = bool(mapping.get('quantity'))
    has_revenue = bool(mapping.get('revenue')) or (bool(mapping.get('quantity')) and bool(mapping.get('price')))
    has_product = bool(mapping.get('product'))
    has_location = bool(mapping.get('location'))
    
    forecasting_possible = has_date and (has_quantity or has_revenue)
    product_analysis_possible = has_product and (has_quantity or has_revenue)
    location_analysis_possible = has_location and (has_quantity or has_revenue)
    
    limitations = []
    if not has_date:
        limitations.append("Time-series analysis and forecasting are not possible because no date column was found.")
    if not has_revenue:
        limitations.append("Revenue analysis is not possible because price/revenue data is missing.")
    if not has_product:
        limitations.append("Product-level analysis is not possible because no product/item identifier was found.")
        
    result = {
        "dataset_name": state.get("dataset_name", "Unknown Dataset"),
        "rows": len(df),
        "columns": len([c for c in df.columns if not c.startswith("_")]),
        "column_summary": column_summary,
        "business_columns": {
            "date": mapping.get('date'),
            "product": mapping.get('product'),
            "customer": customer_col,
            "location": mapping.get('location'),
            "quantity": mapping.get('quantity'),
            "revenue": mapping.get('revenue'),
            "order": mapping.get('order'),
            "price": mapping.get('price')
        },
        "capabilities": {
            "forecasting": forecasting_possible,
            "product_analysis": product_analysis_possible,
            "location_analysis": location_analysis_possible,
            "trend_analysis": has_date
        },
        "limitations": limitations
    }
    
    return {
        "current_step": "data_understanding",
        "workflow_status": "in_progress",
        "data_understanding_result": result
    }
