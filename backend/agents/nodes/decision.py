import os
import json
import logging
from typing import Dict, Any, List
from groq import Groq
from ..state import AgentState

logger = logging.getLogger(__name__)

def summarize_context_for_llm(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Distills large raw agent contexts into a compact, high-signal representation
    to prevent reasoning-token exhaustion and API rate limits.
    """
    analytics = context.get("analytics") or {}
    trends = context.get("trends") or {}
    forecast = context.get("forecast") or {}
    risks = context.get("risks") or {}
    du = context.get("data_understanding") or {}
    retrieved = context.get("retrieved_evidence") or []

    # Identify top products safely
    top_products_raw = analytics.get("top_products") or []
    top_products = []
    if isinstance(top_products_raw, list):
        for p in top_products_raw[:3]:
            if isinstance(p, dict):
                top_products.append({
                    "name": str(p.get("name") or p.get("product") or p.get("StockCode") or p.get("Description") or "Unknown"),
                    "revenue": p.get("revenue") or p.get("total_amount") or 0,
                    "quantity": p.get("quantity") or p.get("total_quantity") or 0
                })

    # Identify detected risks summary
    risks_list = risks.get("risks") or []
    top_risks = []
    if isinstance(risks_list, list):
        for r in risks_list[:3]:
            if isinstance(r, dict):
                top_risks.append({
                    "type": str(r.get("risk_type") or r.get("title") or "Risk"),
                    "severity": str(r.get("severity") or "Medium"),
                    "description": str(r.get("explanation") or r.get("description") or "")[:120]
                })

    # Forecast summary
    forecast_has_error = bool(forecast.get("error")) or forecast.get("status") == "not_available"
    forecast_summary = {
        "is_available": not forecast_has_error and bool(forecast.get("future_forecast") or forecast.get("product_forecasts")),
        "target_metric": forecast.get("target_metric"),
        "error": (forecast.get("error") or forecast.get("reason")) if forecast_has_error else None,
        "sample_points": forecast.get("future_forecast", [])[:4] if isinstance(forecast.get("future_forecast"), list) else []
    }

    analytics_summary = analytics.get("summary") or {}
    return {
        "dataset_name": context.get("dataset_name"),
        "domain": du.get("domain", "General Commerce"),
        "total_rows": du.get("rows"),
        "business_columns": du.get("business_columns", {}),
        "total_revenue": analytics.get("total_revenue") if analytics.get("total_revenue") is not None else analytics_summary.get("total_revenue"),
        "total_orders": analytics.get("total_orders") if analytics.get("total_orders") is not None else analytics_summary.get("total_orders"),
        "top_products": top_products,
        "trends_frequency": trends.get("frequency"),
        "forecast_summary": forecast_summary,
        "risks_summary": top_risks,
        "retrieved_evidence": [str(e.get("content") if isinstance(e, dict) else e)[:150] for e in retrieved[:2]]
    }

def generate_deterministic_decision(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fallback deterministic, rule-based business decision engine that synthesizes
    actual calculated metrics, trends, forecasts, and risks into concrete business actions.
    """
    analytics = context.get("analytics") or {}
    trends = context.get("trends") or {}
    forecast = context.get("forecast") or {}
    risks = context.get("risks") or {}
    du = context.get("data_understanding") or {}

    total_rows = du.get("rows") or 0
    top_products = analytics.get("top_products") or []
    top_item_name = "Overall Product Portfolio"
    if isinstance(top_products, list) and len(top_products) > 0 and isinstance(top_products[0], dict):
        top_item_name = str(top_products[0].get("name") or top_products[0].get("product") or top_products[0].get("Description") or "Primary Product Line")

    # If dataset has virtually no data
    if total_rows < 5:
        return {
            "status": "success",
            "decision": "MORE INFORMATION REQUIRED",
            "affected_item": "Dataset Portfolio",
            "reason": "More suitable data or additional business information is required before recommending a specific action.",
            "recommendation": "Upload a dataset with sufficient transaction history, dates, and order quantities to establish reliable business decisions.",
            "priority": "Low",
            "evidence": ["Dataset contains fewer than 5 records; statistical confidence is below threshold."],
            "risks": ["Decisions made on insufficient data risk operational misallocation."],
            "expected_impact": "Prevents premature capital and operational commitments.",
            "confidence": 0.20,
            "limitations": ["Insufficient historical observations to support predictive or inventory recommendations."]
        }

    # Evaluate forecast trajectory
    has_valid_forecast = (
        not bool(forecast.get("error"))
        and forecast.get("status") != "not_available"
        and bool(forecast.get("future_forecast") or forecast.get("product_forecasts"))
    )
    future_points = forecast.get("future_forecast") or []
    
    def _extract_forecast_val(pt: Dict[str, Any]) -> float:
        for key in ("predicted_demand", "forecast", "yhat"):
            val = pt.get(key)
            if val is not None:
                return float(val)
        return 0.0

    # Assess forecast trend if available
    forecast_trend_direction = "stable"
    if has_valid_forecast and len(future_points) >= 2:
        try:
            first_val = _extract_forecast_val(future_points[0])
            last_val = _extract_forecast_val(future_points[-1])
            if first_val > 0:
                change = (last_val - first_val) / first_val
                if change > 0.05:
                    forecast_trend_direction = "increasing"
                elif change < -0.05:
                    forecast_trend_direction = "declining"
        except Exception:
            pass

    risks_list = risks.get("risks") or []
    high_risks = [r for r in risks_list if isinstance(r, dict) and r.get("severity") in ["High", "Critical"]]

    analytics_summary = analytics.get("summary") or {}
    evidence_items = []
    tot_rev = analytics.get("total_revenue")
    if tot_rev is None:
        tot_rev = analytics_summary.get("total_revenue")
    tot_ord = analytics.get("total_orders")
    if tot_ord is None:
        tot_ord = analytics_summary.get("total_orders")
    if tot_rev is not None:
        evidence_items.append(f"Recorded business revenue of ${tot_rev:,.2f}" + (f" across {tot_ord:,} transactions." if tot_ord else "."))
    if has_valid_forecast:
        evidence_items.append(f"Demand forecasting indicates a {forecast_trend_direction} volume trajectory over future forecast intervals.")
    else:
        evidence_items.append("Time-series forecasting limited by available timestamp regularity; decisions rely on observed historical velocity.")
    
    if len(risks_list) > 0:
        top_risk_desc = str(risks_list[0].get("description") or risks_list[0].get("risk_type") or "Demand variation")
        evidence_items.append(f"Risk Detection identified: {top_risk_desc[:120]}.")

    # Select Decision based on rigorous business logic
    if has_valid_forecast and forecast_trend_direction == "declining":
        decision = "REDUCE PLANNED PRODUCTION"
        affected_item = top_item_name
        reason = "Recent demand has declined, and the available forecast indicates that demand may remain lower in the next period."
        recommendation = "Review the production plan and check current inventory before adjusting output to prevent excess stock accumulation."
        priority = "High" if len(high_risks) > 0 else "Medium"
        confidence = 0.85
    elif has_valid_forecast and forecast_trend_direction == "increasing":
        decision = "REVIEW PRODUCTION CAPACITY TO MEET RISING DEMAND"
        affected_item = top_item_name
        reason = "Projected order volume demonstrates an upward trajectory across future planning cycles."
        recommendation = "Assess component availability and production throughput before committing to increased factory output."
        priority = "High"
        confidence = 0.85
    elif has_valid_forecast and forecast_trend_direction == "stable":
        decision = "MAINTAIN CURRENT PRODUCTION PLAN"
        affected_item = top_item_name
        reason = "Demand patterns demonstrate steady volume with minimal volatility across recent cycles."
        recommendation = "Maintain current operational schedules and replenish standard lot sizes according to baseline demand."
        priority = "Low"
        confidence = 0.80
    elif len(high_risks) > 0:
        decision = "INVESTIGATE RECENT DEMAND RISKS"
        affected_item = top_item_name
        reason = "Multiple high-severity risk signals detected across sales and order distribution."
        recommendation = "Conduct immediate operational audit into identified risk drivers before committing capital to long-lead procurement."
        priority = "High"
        confidence = 0.70
    else:
        decision = "MONITOR DEMAND BEFORE CHANGING PLAN"
        affected_item = top_item_name
        reason = "Available sales history indicates stable velocity; statistical forecasting requires additional historical periods."
        recommendation = "Track order cadence over the next reporting cycle to establish definitive trend momentum prior to modifying capacity."
        priority = "Medium"
        confidence = 0.65

    return {
        "status": "success",
        "decision": decision,
        "affected_item": affected_item,
        "reason": reason,
        "recommendation": recommendation,
        "priority": priority,
        "evidence": evidence_items,
        "risks": [str(r.get("description") if isinstance(r, dict) else r)[:100] for r in risks_list[:3]] or ["Ongoing market fluctuations require regular review."],
        "expected_impact": "Optimizes operational capital allocation and aligns production pacing with actual demand indicators.",
        "confidence": confidence,
        "limitations": [
            "Dataset does not provide direct inventory stock levels or machine capacity; optimal unit quantities cannot be determined from sales data alone.",
            "External supplier constraints and holding costs should be verified before executing large-scale schedule adjustments."
        ]
    }

def generate_decision(context: Dict[str, Any]) -> Dict[str, Any]:
    from app.core.config import settings
    env_key = os.getenv("GROQ_API_KEY")
    api_key = env_key if env_key is not None else settings.groq_api_key
    model_name = os.getenv("GROQ_MODEL") or settings.groq_model
    
    # 1. Distill context into concise high-signal summary
    summarized_context = summarize_context_for_llm(context)

    # 2. Try LLM if configured
    if api_key:
        try:
            client = Groq(api_key=api_key, timeout=25.0)
            system_prompt = """You are a senior business decision-support assistant.
Analyze ONLY the supplied business metrics, demand forecasts, and detected risks.
Do not invent facts, metrics, products, or risks.
CRITICAL BUSINESS DECISION RULES:
1. Provide an explicit, action-oriented final decision (e.g., 'REDUCE PLANNED PRODUCTION', 'MAINTAIN CURRENT PRODUCTION PLAN', 'REVIEW PRODUCTION CAPACITY TO MEET RISING DEMAND', 'INCREASE REPLENISHMENT', 'INVESTIGATE RECENT DEMAND RISKS', or 'MONITOR DEMAND BEFORE CHANGING PLAN').
2. Identify the specific affected item (product, category, or business area).
3. Provide one concise sentence explaining why in 'reason'.
4. Include 2-3 genuine supporting facts in 'evidence'.
5. If inventory data or machine capacity is absent, state in 'limitations' that optimal output quantities cannot be established from sales data alone.
6. Do NOT recommend stopping manufacturing solely because sales declined.

Output strictly valid JSON matching this schema:
{
    "status": "success",
    "decision": "<action-oriented decision title in capitals>",
    "affected_item": "<product, category, or business area>",
    "reason": "<one concise sentence explaining why>",
    "recommendation": "<actionable business recommendation>",
    "priority": "<High | Medium | Low>",
    "evidence": ["<fact 1 from context>", "<fact 2 from context>"],
    "risks": ["<risk or caveat 1>"],
    "expected_impact": "<expected business outcome>",
    "confidence": <float 0.0 to 1.0 based on evidence strength>,
    "limitations": ["<limitation 1>"]
}"""
            user_prompt = f"Context:\n{json.dumps(summarized_context, separators=(',', ':'), default=str)}\n\nGenerate the verified business decision JSON."

            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=model_name,
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=1536
            )
            
            result_text = response.choices[0].message.content
            result_json = json.loads(result_text)
            
            if "decision" in result_json and result_json["decision"]:
                result_json["status"] = "success"
                # Ensure fields exist
                if "affected_item" not in result_json:
                    top_prods = summarized_context.get("top_products") or []
                    result_json["affected_item"] = (
                        top_prods[0].get("name", "Product Portfolio")
                        if isinstance(top_prods, list) and len(top_prods) > 0 and isinstance(top_prods[0], dict)
                        else "Product Portfolio"
                    )
                if "reason" not in result_json:
                    result_json["reason"] = result_json.get("reasoning") or result_json.get("recommendation", "")[:120]
                return result_json
        except Exception as e:
            logger.warning(f"Groq API call failed, falling back to deterministic decision engine: {e}")
            fallback = generate_deterministic_decision(context)
            fallback.setdefault("limitations", []).append(
                f"LLM service unavailable ({type(e).__name__}); recommendation generated via deterministic rule engine."
            )
            return fallback

    # 3. Fallback to robust deterministic analytical decision engine
    fallback = generate_deterministic_decision(context)
    if not api_key:
        fallback.setdefault("limitations", []).append(
            "GROQ_API_KEY is not configured; recommendation generated via deterministic rule engine."
        )
    return fallback

def decision_node(state: AgentState) -> Dict[str, Any]:
    context = {
        "dataset_name": state.get("dataset_name"),
        "data_understanding": state.get("data_understanding_result", {}),
        "analytics": state.get("analytics_result", {}),
        "trends": state.get("trend_result", {}),
        "outliers": state.get("outlier_result", {}),
        "forecast": state.get("forecast_result", {}),
        "risks": state.get("risk_result", {}),
        "retrieved_evidence": state.get("retrieved_evidence", [])
    }
    
    recommendation_result = generate_decision(context)
    
    return {
        "current_step": "decision",
        "workflow_status": "in_progress",
        "recommendation_result": recommendation_result
    }
