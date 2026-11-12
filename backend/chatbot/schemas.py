from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ChatRequest(BaseModel):
    dataset_id: int
    question: str

class ChatResponse(BaseModel):
    answer: str
    evidence: List[str]
    confidence: float
    limitations: List[str]
    dataset_id: int
    referenced_evidence: Optional[List[Dict[str, Any]]] = None
    verification_status: Optional[str] = None
