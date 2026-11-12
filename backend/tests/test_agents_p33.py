import pytest
import os
from agents.graph import graph
from agents.state import AgentState

ONLINE_RETAIL_PATH = "C:\\Project_Data_Sets_Processed\\27_cleaned_online_retail_II.xlsx"
OLIST_PATH = "C:\\Project_Data_Sets_Processed\\8_cleaned_olist_orders_dataset.csv"

@pytest.fixture
def online_retail_state() -> AgentState:
    return {
        "dataset_id": 27,
        "dataset_name": "online_retail_II",
        "processed_file_path": ONLINE_RETAIL_PATH,
        "dataset_metadata": {},
        "cleaned_data_reference": "ref",
        "data_understanding_result": None,
        "analytics_result": None,
        "trend_result": None,
        "outlier_result": None,
        "forecast_result": None,
        "risk_result": None,
        "recommendation_result": None,
        "verification_result": None,
        "evidence": [],
        "messages": [],
        "errors": [],
        "current_step": "init",
        "workflow_status": "pending"
    }

@pytest.fixture
def olist_state() -> AgentState:
    return {
        "dataset_id": 8,
        "dataset_name": "olist_orders",
        "processed_file_path": OLIST_PATH,
        "dataset_metadata": {},
        "cleaned_data_reference": "ref",
        "data_understanding_result": None,
        "analytics_result": None,
        "trend_result": None,
        "outlier_result": None,
        "forecast_result": None,
        "risk_result": None,
        "recommendation_result": None,
        "verification_result": None,
        "evidence": [],
        "messages": [],
        "errors": [],
        "current_step": "init",
        "workflow_status": "pending"
    }

@pytest.mark.skipif(not os.path.exists(ONLINE_RETAIL_PATH), reason="Online Retail processed dataset not found")
def test_full_graph_online_retail(online_retail_state):
    result = graph.invoke(online_retail_state)
    
    assert result["current_step"] == "verification"
    assert result["workflow_status"] == "completed"
    
    # 1. Analysis Agent
    analytics = result.get("analytics_result")
    assert analytics is not None
    assert "summary" in analytics
    
    trends = result.get("trend_result")
    assert trends is not None
    
    outliers = result.get("outlier_result")
    assert outliers is not None
    
    # 2. Forecasting Agent
    forecast = result.get("forecast_result")
    assert forecast is not None
    if "status" not in forecast or forecast["status"] != "not_available":
        assert "evaluation" in forecast
        # Preserves metrics
        eval_metrics = forecast["evaluation"].get("xgboost", forecast["evaluation"].get("baseline", {}))
        assert "mae" in eval_metrics
        assert "rmse" in eval_metrics
        assert "r2" in eval_metrics
        
    # 3. Risk Detection Agent
    risks = result.get("risk_result")
    assert risks is not None
    assert "risks" in risks

@pytest.mark.skipif(not os.path.exists(OLIST_PATH), reason="Olist processed dataset not found")
def test_full_graph_olist(olist_state):
    result = graph.invoke(olist_state)
    
    assert result["current_step"] == "verification"
    assert result["workflow_status"] == "completed"
    
    # 1. Analysis Agent
    analytics = result.get("analytics_result")
    assert analytics is not None
    
    # 2. Forecasting Agent (Olist has no quantity/price in this file usually, should fail gracefully)
    forecast = result.get("forecast_result")
    assert forecast is not None
    assert forecast.get("status") == "not_available"
    assert "reason" in forecast
    
    # 3. Risk Detection Agent
    risks = result.get("risk_result")
    assert risks is not None
    
    # 4. Check stock-out claims (Olist rule)
    if "risks" in risks:
        for r in risks["risks"]:
            if "stock" in r.get("risk_type", "").lower() or "inventory" in r.get("explanation", "").lower():
                assert "Possible" in r["risk_type"]
                evidence_text = " ".join(r.get("evidence", [])).lower()
                assert "unavailable" in evidence_text
