from typing import List, Dict, Any
from langchain_core.documents import Document

def build_evidence_documents(state: Dict[str, Any]) -> List[Document]:
    dataset_id = str(state.get("dataset_id", "unknown"))
    dataset_name = state.get("dataset_name", "Unknown")
    documents = []

    # 1. Trend Evidence
    trends = state.get("trend_result", {})
    if isinstance(trends, dict) and "trends" in trends:
        for i, t in enumerate(trends["trends"]):
            content = f"Trend Analysis for {dataset_name}: The metric {t.get('metric')} showed a {t.get('trend')} trend over the analyzed period. Evidence: {t.get('evidence')}."
            metadata = {
                "dataset_id": dataset_id,
                "dataset_name": dataset_name,
                "source": "trend_analysis",
                "evidence_type": "trend",
                "id": f"{dataset_id}_trend_{i}"
            }
            documents.append(Document(page_content=content, metadata=metadata))

    # 2. Outlier Evidence
    outliers = state.get("outlier_result", {})
    if isinstance(outliers, dict) and "outliers" in outliers:
        for i, o in enumerate(outliers["outliers"]):
            context_str = ", ".join([f"{k}: {v}" for k, v in o.get("context", {}).items() if v])
            content = f"Outlier detected for {dataset_name} in {o.get('metric')}. {context_str}. Detail: {o.get('evidence')} (Value: {o.get('value')} vs Expected: {o.get('expected_range')}). Status: {o.get('status')}."
            metadata = {
                "dataset_id": dataset_id,
                "dataset_name": dataset_name,
                "source": "outlier_analysis",
                "evidence_type": "outlier",
                "id": f"{dataset_id}_outlier_{i}"
            }
            documents.append(Document(page_content=content, metadata=metadata))

    # 3. Forecast Evidence
    forecast = state.get("forecast_result", {})
    if isinstance(forecast, dict) and forecast.get("status") != "not_available":
        future = forecast.get("future_forecast", [])
        if future:
            first_fut = float(future[0].get("predicted_demand") or 0)
            last_fut = float(future[-1].get("predicted_demand") or 0)
            content = f"Demand Forecasting for {dataset_name}: Forecasted demand starts at {first_fut:.1f} and ends at {last_fut:.1f} over the forecast period."
            metadata = {
                "dataset_id": dataset_id,
                "dataset_name": dataset_name,
                "source": "forecasting",
                "evidence_type": "forecast",
                "id": f"{dataset_id}_forecast_0"
            }
            documents.append(Document(page_content=content, metadata=metadata))

    # 4. Risk Evidence
    risks = state.get("risk_result", {})
    if isinstance(risks, dict) and "risks" in risks:
        for i, r in enumerate(risks["risks"]):
            ev_str = " ".join(r.get("evidence", []))
            content = f"Risk Detected for {dataset_name}: {r.get('risk_type')} (Severity: {r.get('severity')}). Product: {r.get('affected_product')}. Explanation: {r.get('explanation')} Evidence: {ev_str}."
            metadata = {
                "dataset_id": dataset_id,
                "dataset_name": dataset_name,
                "source": "risk_detection",
                "evidence_type": "risk",
                "risk_type": r.get("risk_type"),
                "id": f"{dataset_id}_risk_{i}"
            }
            documents.append(Document(page_content=content, metadata=metadata))

    # 5. Analytics Evidence
    analytics = state.get("analytics_result", {})
    if isinstance(analytics, dict) and "summary" in analytics:
        s = analytics["summary"]
        content = f"Business Analytics for {dataset_name}: Total Revenue: {s.get('total_revenue')}, Total Quantity: {s.get('total_quantity')}, Total Orders: {s.get('total_orders')}."
        metadata = {
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "source": "business_analytics",
            "evidence_type": "business_analytics",
            "id": f"{dataset_id}_analytics_0"
        }
        documents.append(Document(page_content=content, metadata=metadata))

    return documents
