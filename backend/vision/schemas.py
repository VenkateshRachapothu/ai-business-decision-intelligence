from pydantic import BaseModel
from typing import List, Optional

class ImageAnalysisResult(BaseModel):
    status: str
    chart_type: Optional[str]
    summary: str
    observations: List[str]
    trends: List[str]
    anomalies: List[str]
    risks: List[str]
    recommendations: List[str]
    confidence: float
    limitations: List[str]
