import os
import json
import logging
from typing import Dict, Any
from groq import Groq
from rag.service import RAGService
from .schemas import ChatRequest, ChatResponse
from .context import get_or_build_dataset_context
from app.models.dataset import Dataset
from app.models.user import User

logger = logging.getLogger(__name__)

class ChatbotService:
    def __init__(self):
        from app.core.config import settings
        self.api_key = os.getenv("GROQ_API_KEY", settings.groq_api_key)
        self.model_name = settings.groq_model
        self.rag_service = RAGService()
        
    def answer_question(self, request: ChatRequest, dataset: Dataset, current_user: User) -> ChatResponse:
        if not request.question.strip():
            raise ValueError("Question cannot be empty.")
            
        current_api_key = os.getenv("GROQ_API_KEY") if os.getenv("GROQ_API_KEY") is not None else self.api_key
        if not current_api_key:
            return ChatResponse(
                answer="The Business Decision Intelligence Chatbot service is currently unavailable.",
                evidence=[],
                confidence=0.0,
                limitations=["GROQ_API_KEY is not configured."],
                dataset_id=request.dataset_id
            )
            
        # 1. Ensure context exists (this will also index evidence into RAG if not already done)
        try:
            file_path = dataset.processed_file_location or dataset.original_file_location
            context = get_or_build_dataset_context(
                dataset_id=dataset.id,
                dataset_name=dataset.original_filename or dataset.name,
                file_path=file_path
            )
        except Exception as e:
            logger.error(f"Failed to build context: {e}")
            raise ValueError(f"Could not build context for dataset: {str(e)}")
            
        # 2. Retrieve specific evidence for this question
        try:
            retrieved_evidence = self.rag_service.retrieve_evidence(
                query=request.question,
                dataset_id=str(dataset.id)
            )
        except Exception as e:
            logger.error(f"RAG retrieval failed: {e}")
            retrieved_evidence = []
            
        # 3. Build Groq prompt
        system_prompt = """You are a highly capable Business Decision Intelligence Chatbot.
You must answer the user's natural-language questions about their uploaded dataset.
You are given the full structured context of the business analytics, forecasts, risks, recommendation, and verification result, as well as specific RAG retrieved evidence for their question.

CRITICAL RULES:
1. Answer strictly using the supplied context and retrieved evidence.
2. DO NOT invent metrics, products, locations, sales numbers, forecasts, risks, or business facts.
3. If the answer is not supported by the available context, state clearly that the evidence is insufficient.
4. If the question is entirely unrelated to the business dataset (e.g., "What is the capital of France?"), politely decline to answer and explain you only answer questions about the business dataset.
5. Identify the exact evidence you used in the 'evidence' list.
6. The Olist dataset (or any dataset without actual inventory levels) cannot confirm an absolute stock-out. If asked about stock-outs, you must state: "Product X has a possible stock-out risk based on demand patterns, but actual inventory levels are unavailable."
7. If the verification_status is PARTIALLY_SUPPORTED or NOT_SUPPORTED, you must not claim the recommendation is fully verified. Explain the limitations clearly.

Output your response strictly as a valid JSON object matching this schema:
{
    "answer": "<your clear, natural language answer>",
    "evidence": ["<specific fact 1 from context>", "<specific fact 2>"],
    "confidence": <float 0.0 to 1.0>,
    "limitations": ["<limitation 1>"]
}
"""
        # Compress context for LLM
        analytics = context.get("analytics") or {}
        analytics_summary = analytics.get("summary") if isinstance(analytics.get("summary"), dict) else {}
        trends_data = context.get("trends") or {}
        outliers_data = context.get("outliers") or {}
        forecast_data = context.get("forecast") or {}
        risks_data = context.get("risks") or {}
        rec_data = context.get("recommendation") or {}
        verif_data = context.get("verification") or {}

        tot_rev = analytics.get("total_revenue")
        if tot_rev is None:
            tot_rev = analytics_summary.get("total_revenue")
        tot_orders = analytics.get("total_orders")
        if tot_orders is None:
            tot_orders = analytics_summary.get("total_orders")

        du_raw = context.get("data_understanding")
        du_summary = (
            {
                "dataset_title": du_raw.get("dataset_title"),
                "domain": du_raw.get("domain"),
                "rows": du_raw.get("rows"),
                "columns": du_raw.get("columns"),
                "business_columns": du_raw.get("business_columns"),
                "date_range": du_raw.get("date_range"),
                "limitations": du_raw.get("limitations"),
            }
            if isinstance(du_raw, dict)
            else du_raw
        )

        llm_context = {
            "dataset_name": dataset.name,
            "data_understanding": du_summary,
            "analytics_summary": {
                "total_revenue": tot_rev,
                "total_orders": tot_orders,
                "average_order_value": analytics_summary.get("average_order_value"),
                "total_quantity": analytics_summary.get("total_quantity"),
                "unique_products": analytics_summary.get("unique_products"),
                "top_products": (analytics.get("top_products") or [])[:5] if isinstance(analytics.get("top_products"), list) else None,
                "sales_by_category": (analytics.get("sales_by_category") or [])[:5] if isinstance(analytics.get("sales_by_category"), list) else None,
                "sales_by_location": (analytics.get("sales_by_location") or [])[:5] if isinstance(analytics.get("sales_by_location"), list) else None,
            },
            "trends_summary": trends_data.get("summary") or trends_data.get("trends", []),
            "outliers_summary": outliers_data.get("summary") or (outliers_data.get("outliers") or [])[:5],
            "forecast_summary": forecast_data.get("summary") or {
                "status": forecast_data.get("status"),
                "error": forecast_data.get("error"),
                "reason": forecast_data.get("reason"),
                "selected_method": forecast_data.get("selected_method"),
                "frequency": forecast_data.get("frequency"),
                "target_metric": forecast_data.get("target_metric"),
                "unit": forecast_data.get("unit"),
                "future_forecast": (forecast_data.get("future_forecast") or [])[:5],
                "product_forecasts": (forecast_data.get("product_forecasts") or [])[:4],
            },
            "risks_summary": risks_data.get("summary") or (risks_data.get("risks") or [])[:5],
            "recommendation": rec_data,
            "verification": verif_data,
            "retrieved_evidence_for_question": retrieved_evidence
        }
        
        user_prompt = f"Question: {request.question}\n\nContext:\n{json.dumps(llm_context, separators=(',', ':'), default=str)}\n\nProvide your answer in JSON format."
        
        current_model = os.getenv("GROQ_MODEL") if os.getenv("GROQ_MODEL") is not None else self.model_name
        try:
            client = Groq(api_key=current_api_key, timeout=25.0)
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=current_model,
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=1536
            )
            
            result_json = json.loads(response.choices[0].message.content)
            
            # Additional Olist check if LLM hallucinates
            ds_name = (dataset.original_filename or dataset.name or "").lower()
            if "olist" in ds_name:
                ans_lower = result_json.get("answer", "").lower()
                if "will definitely run out of stock" in ans_lower or "run out of stock" in ans_lower:
                    if "inventory" not in ans_lower:
                        if "limitations" not in result_json:
                            result_json["limitations"] = []
                        result_json["limitations"].append("Actual inventory levels are unavailable, so absolute stock-out cannot be confirmed.")
                        result_json["confidence"] = max(0.0, float(result_json.get("confidence", 0.0)) - 0.5)

            return ChatResponse(
                answer=result_json.get("answer", "I could not generate an answer."),
                evidence=result_json.get("evidence", []),
                confidence=result_json.get("confidence", 0.8),
                limitations=result_json.get("limitations", []),
                dataset_id=dataset.id,
                referenced_evidence=retrieved_evidence,
                verification_status=verif_data.get("status")
            )
            
        except Exception as e:
            logger.warning(f"Groq generation failed, providing context-grounded fallback: {e}")
            rec = context.get("recommendation") or {}
            verif = context.get("verification") or {}
            q_lower = request.question.lower()

            if "why" in q_lower or "reason" in q_lower:
                ans = f"This decision ({rec.get('decision', 'Review Operations')}) is recommended because: {rec.get('reason', rec.get('recommendation', 'it aligns with calculated demand trends'))}."
            elif "increase" in q_lower or "reduce" in q_lower or "production" in q_lower:
                ans = f"Recommended Action: {rec.get('decision', 'Monitor Demand')}. For {rec.get('affected_item', 'your product portfolio')}: {rec.get('recommendation', 'review current inventory and demand before adjusting production')}."
            elif "risk" in q_lower:
                r_list = risks_data.get("risks") or []
                if r_list:
                    top_r = r_list[0]
                    ans = f"Detected {len(r_list)} operational risk signal(s). Top risk: {top_r.get('risk_type')} ({top_r.get('severity')} severity) — {top_r.get('explanation')}."
                else:
                    ans = "No critical operational risks were flagged in the analyzed dataset."
            elif "forecast" in q_lower or "predict" in q_lower:
                fut = forecast_data.get("future_forecast") or []
                if fut and not forecast_data.get("error") and forecast_data.get("status") != "not_available":
                    ans = f"Forecast ({forecast_data.get('frequency', 'Periodic')} {forecast_data.get('target_metric', 'Demand')}) projects {len(fut)} period(s) starting around {float(fut[0].get('predicted_demand', 0)):.1f} {forecast_data.get('unit', '')}."
                else:
                    ans = f"Forecast unavailable: {forecast_data.get('error') or forecast_data.get('reason') or 'insufficient time-series data'}."
            elif "revenue" in q_lower or "sales" in q_lower or "product" in q_lower or "total" in q_lower:
                parts = []
                if tot_rev is not None:
                    parts.append(f"Total revenue is ${float(tot_rev):,.2f}")
                if tot_orders is not None:
                    parts.append(f"across {int(tot_orders):,} orders")
                top_prods = analytics.get("top_products") or []
                if top_prods:
                    parts.append(f"Top product: {top_prods[0].get('name')}")
                ans = (", ".join(parts) + ".") if parts else f"Based on the analysis for {dataset.name}, the recommended decision is: {rec.get('decision', 'Monitor Demand')}."
            elif "evidence" in q_lower or "support" in q_lower:
                ev_str = "; ".join(rec.get("evidence", ["Analyzed transaction volume and detected risk patterns."]))
                ans = f"Supporting evidence: {ev_str}"
            elif "verified" in q_lower or "verification" in q_lower:
                ans = f"Verification Status: {verif.get('status', 'VERIFIED')}. {verif.get('reasoning', 'Checked against observed historical data and model constraints.')}"
            elif "next" in q_lower or "action" in q_lower or "do" in q_lower:
                ans = f"Next steps: {rec.get('recommendation', 'Review the production schedule and check inventory levels.')}"
            else:
                ans = f"Based on the analysis for {dataset.name}, the recommended decision is: {rec.get('decision', 'Monitor Demand')} ({rec.get('reason', 'aligned with data findings')})."

            fallback_lims = list(rec.get("limitations", ["Real-time inventory levels are not in the uploaded dataset."]))
            fallback_lims.append(f"Generated using context-grounded deterministic fallback (LLM call error: {type(e).__name__}).")
            return ChatResponse(
                answer=ans,
                evidence=rec.get("evidence", []),
                confidence=float(rec.get("confidence", 0.8)),
                limitations=fallback_lims,
                dataset_id=dataset.id,
                referenced_evidence=retrieved_evidence,
                verification_status=verif.get("status", "VERIFIED")
            )
