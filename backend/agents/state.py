from typing import TypedDict, Optional, List, Dict, Any

class AgentState(TypedDict):
    dataset_id: int
    dataset_name: str
    processed_file_path: str
    dataset_metadata: Dict[str, Any]
    
    cleaned_data_reference: str
    
    data_understanding_result: Optional[Dict[str, Any]]
    
    analytics_result: Optional[Dict[str, Any]]
    trend_result: Optional[Dict[str, Any]]
    outlier_result: Optional[Dict[str, Any]]
    forecast_result: Optional[Dict[str, Any]]
    risk_result: Optional[Dict[str, Any]]
    recommendation_result: Optional[Dict[str, Any]]
    verification_result: Optional[Dict[str, Any]]
    
    retrieved_evidence: List[Dict[str, Any]]
    
    evidence: List[str]
    messages: List[Dict[str, str]]
    errors: List[str]
    
    current_step: str
    workflow_status: str
