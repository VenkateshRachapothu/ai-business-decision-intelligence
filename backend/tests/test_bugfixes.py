import json
from unittest.mock import MagicMock, patch
import pandas as pd

from app.services.analytics_service import map_columns
from app.services.trend_service import analyze_trends
from agents.nodes.decision import (
    summarize_context_for_llm,
    generate_deterministic_decision,
    generate_decision,
)
from agents.nodes.verification import run_deterministic_verification, verify_claims
from chatbot.schemas import ChatRequest
from chatbot.service import ChatbotService


def test_superstore_column_mapping_prioritizes_category_and_order_id():
    df = pd.DataFrame({
        "Order ID": ["CA-2024-101", "CA-2024-102"],
        "Order Date": ["2024-01-05", "2024-01-06"],
        "Segment": ["Consumer", "Corporate"],
        "Category": ["Technology", "Furniture"],
        "Sub-Category": ["Phones", "Chairs"],
        "Product Name": ["Phone X", "Ergo Chair"],
        "Sales": [500.0, 250.0],
        "Quantity": [2, 1],
    })
    mapping = map_columns(df)
    assert mapping["category"] == "Category"
    assert mapping["order"] == "Order ID"
    assert mapping["date"] == "Order Date"
    assert mapping["revenue"] == "Sales"
    assert mapping["quantity"] == "Quantity"
    assert mapping["product"] == "Product Name"


def test_classify_trend_short_series_includes_metric_and_slope():
    df = pd.DataFrame({
        "Order Date": ["2024-01-01", "2024-01-02"],
        "Sales": [100.0, 110.0],
        "Quantity": [1, 2],
    })
    res = analyze_trends(df)
    assert len(res["trends"]) >= 1
    first = res["trends"][0]
    assert first["metric"] == "Revenue"
    assert first["slope"] == 0.0
    assert first["trend"] == "stable"


def test_decision_uses_summary_and_predicted_demand_and_handles_empty_top_products(monkeypatch):
    ctx = {
        "dataset_name": "superstore.csv",
        "data_understanding": {"rows": 100},
        "analytics": {
            "summary": {"total_revenue": 12500.5, "total_orders": 42},
            "top_products": [],
        },
        "forecast": {
            "future_forecast": [
                {"date": "2024-02-04", "predicted_demand": 100.0},
                {"date": "2024-02-11", "predicted_demand": 125.0},
            ]
        },
        "risks": {
            "risks": [{"risk_type": "Demand Volatility", "severity": "High", "explanation": "Large variance"}]
        },
    }
    summary = summarize_context_for_llm(ctx)
    assert summary["total_revenue"] == 12500.5
    assert summary["total_orders"] == 42
    assert summary["forecast_summary"]["is_available"] is True
    assert summary["risks_summary"][0]["description"] == "Large variance"

    det = generate_deterministic_decision(ctx)
    assert det["status"] == "success"
    assert det["decision"] == "REVIEW PRODUCTION CAPACITY TO MEET RISING DEMAND"

    # Simulate LLM response omitting affected_item while top_products is []
    monkeypatch.setenv("GROQ_API_KEY", "test_key")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = json.dumps({
        "decision": "INCREASE REPLENISHMENT",
        "recommendation": "Increase safety stock slightly.",
        "evidence": ["Total revenue is $12,500.50"],
        "confidence": 0.85,
        "limitations": []
    })
    mock_client.chat.completions.create.return_value = mock_resp

    with patch("agents.nodes.decision.Groq", return_value=mock_client):
        res = generate_decision(ctx)
    assert res["status"] == "success"
    assert res["affected_item"] == "Product Portfolio"


def test_verification_handles_summary_metrics_and_none_subcontexts(monkeypatch):
    ctx = {
        "dataset_name": "sales.csv",
        "analytics": {"summary": {"total_revenue": 50000.0, "total_orders": 120}},
        "forecast": {"status": "not_available", "error": "Insufficient history"},
        "risks": None,
        "recommendation_result": {
            "status": "success",
            "decision": "MONITOR DEMAND BEFORE CHANGING PLAN",
            "recommendation": "Monitor order cadence next month.",
            "reason": "Stable sales baseline."
        },
    }
    det_verif = run_deterministic_verification(ctx)
    assert det_verif["status"] == "VERIFIED"
    assert any("50,000.00" in c for c in det_verif["supported_claims"])

    monkeypatch.setenv("GROQ_API_KEY", "test_key")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = json.dumps({
        "status": "VERIFIED",
        "verification_score": 0.9,
        "confidence": 0.9,
        "supported_claims": ["Revenue baseline $50,000 verified"],
        "unsupported_claims": [],
        "contradicted_claims": [],
        "evidence": ["Analytics summary"],
        "reasoning": "Supported by summary",
        "limitations": []
    })
    mock_client.chat.completions.create.return_value = mock_resp

    with patch("agents.nodes.verification.Groq", return_value=mock_client):
        res = verify_claims(ctx)
    assert res["status"] == "VERIFIED"
    sent_payload = mock_client.chat.completions.create.call_args.kwargs["messages"][1]["content"]
    assert "50000.0" in sent_payload
    assert '"forecast_has_error": true' in sent_payload


def test_chatbot_passes_real_context_and_fallback_handles_revenue_risk_queries(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test_key")

    class DummyDataset:
        id = 77
        name = "test_sales.csv"
        original_filename = "test_sales.csv"
        processed_file_location = None
        original_file_location = "dummy.csv"
        user_id = 1

    class DummyUser:
        id = 1
        email = "u@example.com"

    built_context = {
        "analytics": {
            "summary": {"total_revenue": 98765.43, "total_orders": 321},
            "top_products": [{"name": "Widget Pro", "value": 45000.0}],
        },
        "trends": {"trends": [{"metric": "Revenue", "trend": "increasing"}]},
        "outliers": {"outliers": [{"metric": "Revenue", "value": 9999.0}]},
        "forecast": {
            "frequency": "Weekly",
            "target_metric": "Quantity",
            "unit": "units",
            "future_forecast": [{"date": "2024-03-01", "predicted_demand": 55.0}],
        },
        "risks": {
            "risks": [{"risk_type": "Demand Volatility", "severity": "High", "explanation": "Large weekly swings"}]
        },
        "recommendation": {
            "decision": "MONITOR DEMAND",
            "reason": "High weekly volatility",
            "recommendation": "Track next cycle",
            "evidence": ["Total revenue $98,765.43"],
            "confidence": 0.8,
        },
        "verification": {"status": "VERIFIED", "reasoning": "Metrics checked."},
    }

    mock_rag = MagicMock()
    mock_rag.retrieve_evidence.return_value = [{"content": "Total revenue 98765.43"}]

    with patch("chatbot.service.RAGService", return_value=mock_rag), \
         patch("chatbot.service.get_or_build_dataset_context", return_value=built_context), \
         patch("chatbot.service.Groq", side_effect=RuntimeError("offline")):
        svc = ChatbotService()
        rev_res = svc.answer_question(ChatRequest(dataset_id=77, question="What is total revenue?"), DummyDataset(), DummyUser())
        risk_res = svc.answer_question(ChatRequest(dataset_id=77, question="What are the main risks?"), DummyDataset(), DummyUser())

    assert "98,765.43" in rev_res.answer
    assert "Widget Pro" in rev_res.answer
    assert "Demand Volatility" in risk_res.answer

