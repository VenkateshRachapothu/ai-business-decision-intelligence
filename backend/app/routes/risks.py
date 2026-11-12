from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
from ..core.database import get_db
from ..models.dataset import Dataset
from ..models.user import User
from .auth import get_current_user
from ..services.risk_service import detect_risks

router = APIRouter()

@router.get("/{dataset_id}")
def get_risks(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset or dataset.processing_status != "cleaned":
        raise HTTPException(status_code=404, detail="Cleaned dataset not found")
        
    try:
        # Risk service orchestrates multiple other services, so we use the cache service
        # which will intelligently fetch dependent caches
        from ..services.cache_service import get_cached_service_result
        result = get_cached_service_result(dataset.processed_file_location, dataset.dataset_type, "risks")
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
