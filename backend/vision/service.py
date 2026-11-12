import os
import json
import base64
import logging
from typing import Optional, Dict, Any
from groq import Groq
from .schemas import ImageAnalysisResult
from app.models.dataset import Dataset
from app.models.user import User

logger = logging.getLogger(__name__)

class VisionService:
    def __init__(self):
        from app.core.config import settings
        env_key = os.getenv("GROQ_API_KEY")
        self.api_key = env_key if env_key is not None else settings.groq_api_key
        self.model_name = os.getenv("GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")
        
    def analyze_image(
        self, 
        image_bytes: bytes, 
        mime_type: str, 
        question: str, 
        dataset_context: Optional[Dict[str, Any]] = None
    ) -> ImageAnalysisResult:
        
        fallback_result = ImageAnalysisResult(
            status="VISION_ANALYSIS_FAILED",
            chart_type=None,
            summary="Vision service is currently unavailable.",
            observations=[],
            trends=[],
            anomalies=[],
            risks=[],
            recommendations=[],
            confidence=0.0,
            limitations=["The vision service failed to analyze the image."]
        )

        if not self.api_key:
            fallback_result.limitations.append("GROQ_API_KEY is not configured.")
            return fallback_result

        try:
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            image_url = f"data:{mime_type};base64,{base64_image}"
            
            system_prompt = """You are an expert business analyst and data visualization interpreter.
You must inspect the supplied image and answer the user's question.

RULES:
1. Identify the chart type when possible (e.g., Line Chart, Bar Chart, Dashboard).
2. Identify visible labels, trends, unusual patterns, high/low performing categories, and business risks.
3. Provide business interpretation and recommendation ONLY when supported by visible information in the chart.
4. Clearly state uncertainty when text/numbers are unreadable. Say 'unreadable' if you cannot see a number.
5. DO NOT invent values, metrics, or trends that are not visible in the image.
6. If the image is not a business chart or does not provide enough information for a conclusion, clearly state so.
7. If business context is provided, you may use it to improve interpretation, but keep your observations focused on what the image actually shows. DO NOT claim an image-derived observation came from the dataset unless the dataset evidence actually supports it.

Output your response strictly as a valid JSON object matching this schema:
{
    "status": "SUCCESS",
    "chart_type": "<chart type or null>",
    "summary": "<brief summary of the chart and answer>",
    "observations": ["<visible observation 1>"],
    "trends": ["<visible trend 1>"],
    "anomalies": ["<visible anomaly 1>"],
    "risks": ["<visible risk 1>"],
    "recommendations": ["<recommendation based on visible data>"],
    "confidence": <float 0.0 to 1.0>,
    "limitations": ["<limitations, e.g. unreadable labels>"]
}
"""

            context_str = ""
            if dataset_context:
                # compress context to string so as not to overwhelm the vision prompt
                context_str = f"Additional Business Context (use to enhance interpretation, but do not hallucinate visual features):\n{json.dumps(dataset_context, indent=2, default=str)}\n\n"
            
            user_text = f"{context_str}Question: {question}\n\nProvide your structured JSON analysis."

            client = Groq(api_key=self.api_key, timeout=25.0)
            response = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_text},
                            {"type": "image_url", "image_url": {"url": image_url}}
                        ]
                    }
                ],
                model=self.model_name,
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=1024
            )
            
            result_json = json.loads(response.choices[0].message.content)
            
            return ImageAnalysisResult(
                status="SUCCESS",
                chart_type=result_json.get("chart_type"),
                summary=result_json.get("summary", "No summary provided."),
                observations=result_json.get("observations", []),
                trends=result_json.get("trends", []),
                anomalies=result_json.get("anomalies", []),
                risks=result_json.get("risks", []),
                recommendations=result_json.get("recommendations", []),
                confidence=result_json.get("confidence", 0.0),
                limitations=result_json.get("limitations", [])
            )
            
        except Exception as e:
            logger.error(f"Groq Vision failed: {e}")
            fallback_result.limitations.append(f"Vision API error: {str(e)}")
            return fallback_result
