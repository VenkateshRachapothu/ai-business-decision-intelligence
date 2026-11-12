import pytest
import os
import json
from unittest.mock import patch, MagicMock
from agents.graph import graph
from agents.state import AgentState

@pytest.fixture
def mock_state() -> AgentState:
    return {
        "dataset_id": 1,
        "dataset_name": "test_dataset",
        "processed_file_path": "fake_path.csv",
        "dataset_metadata": {},
        "cleaned_data_reference": "ref",
        "data_understanding_result": {"status": "ok"},
        "analytics_result": {"revenue": 1000},
        "trend_result": {"trends": []},
        "outlier_result": {"outliers": []},
        "forecast_result": {"status": "ok"},
        "risk_result": {"risks": []},
        "recommendation_result": None,
        "verification_result": None,
        "evidence": [],
        "messages": [],
        "errors": [],
        "current_step": "init",
        "workflow_status": "pending"
    }

def test_decision_agent_no_api_key(mock_state, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setattr("app.core.config.settings.groq_api_key", None)
    
    # We will only invoke the decision node
    from agents.nodes.decision import decision_node
    
    result = decision_node(mock_state)
    
    assert result["current_step"] == "decision"
    
    rec = result["recommendation_result"]
    assert rec["status"] == "success"
    assert isinstance(rec.get("decision"), str) and len(rec["decision"]) > 0
    assert "limitations" in rec
    assert any("not configured" in l for l in rec["limitations"])

@patch('agents.nodes.decision.Groq')
def test_decision_agent_success(mock_groq_class, mock_state, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "fake_key")
    
    mock_client = MagicMock()
    mock_groq_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content=json.dumps({
            "status": "success",
            "decision": "Test Decision",
            "recommendation": "Test Recommendation",
            "reasoning": "Because of testing",
            "evidence": ["Evidence 1"],
            "risks": ["Risk 1"],
            "expected_impact": "High impact",
            "confidence": 0.9,
            "limitations": ["Limitation 1"]
        })))
    ]
    
    mock_client.chat.completions.create.return_value = mock_response
    
    from agents.nodes.decision import decision_node
    result = decision_node(mock_state)
    
    rec = result["recommendation_result"]
    assert rec["status"] == "success"
    assert rec["decision"] == "Test Decision"
    assert rec["confidence"] == 0.9
    
    # Verify the client was called properly
    mock_client.chat.completions.create.assert_called_once()
    args, kwargs = mock_client.chat.completions.create.call_args
    
    messages = kwargs["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "business decision-support assistant" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "Context" in messages[1]["content"]
