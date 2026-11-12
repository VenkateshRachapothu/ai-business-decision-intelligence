import pytest
from agents.state import AgentState
from agents.graph import graph

def test_shared_state_creation():
    state: AgentState = {
        "dataset_id": 1,
        "dataset_name": "test.csv",
        "processed_file_path": "/tmp/test.csv",
        "dataset_metadata": {},
        "cleaned_data_reference": "test_ref",
        "analytics_result": None,
        "trend_result": None,
        "outlier_result": None,
        "forecast_result": None,
        "risk_result": None,
        "recommendation_result": None,
        "verification_result": None,
        "retrieved_evidence": [],
        "evidence": [],
        "messages": [],
        "errors": [],
        "current_step": "init",
        "workflow_status": "pending"
    }
    
    assert state["dataset_id"] == 1
    assert state["workflow_status"] == "pending"

def test_graph_construction():
    assert graph is not None
    assert hasattr(graph, "invoke")

def test_graph_execution():
    initial_state: AgentState = {
        "dataset_id": 1,
        "dataset_name": "test.csv",
        "processed_file_path": "/tmp/test.csv",
        "dataset_metadata": {},
        "cleaned_data_reference": "test_ref",
        "analytics_result": None,
        "trend_result": None,
        "outlier_result": None,
        "forecast_result": None,
        "risk_result": None,
        "recommendation_result": None,
        "verification_result": None,
        "retrieved_evidence": [],
        "evidence": [],
        "messages": [],
        "errors": [],
        "current_step": "init",
        "workflow_status": "pending"
    }
    
    result = graph.invoke(initial_state)
    
    # 4. Every placeholder node is reached (in this sequential graph, if it completes, it reached all of them, but we can check the final state)
    # 5. workflow_status/current_step are updated
    assert result["current_step"] == "verification"
    assert result["workflow_status"] == "completed"
    
    # 6. No fake data is generated
    assert result["analytics_result"] is None
    assert result["trend_result"] is None
    assert result["outlier_result"] is None
    assert result["forecast_result"] is None
    assert result["risk_result"] is None
    # Now implemented, so it will have a fallback status instead of None
    assert isinstance(result["recommendation_result"], dict)
    assert isinstance(result["verification_result"], dict)
