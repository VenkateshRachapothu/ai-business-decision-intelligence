from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import os

from ..core.database import get_db
from ..models.dataset import Dataset
from ..models.user import User
from .auth import get_current_user
from ..services.analytics_service import generate_analytics

router = APIRouter()

@router.get("/{dataset_id}")
def get_analytics(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.processing_status != "cleaned" or not dataset.processed_file_location:
        raise HTTPException(status_code=400, detail="Dataset has not been cleaned yet. Please clean it first.")
        
    if not os.path.exists(dataset.processed_file_location):
        raise HTTPException(status_code=404, detail="Processed dataset file not found on disk.")
        
    try:
        from ..services.cache_service import get_cached_service_result
        return get_cached_service_result(dataset.processed_file_location, dataset.dataset_type, "analytics")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from ..services.trend_service import analyze_trends
from ..services.outlier_service import detect_outliers

@router.get("/{dataset_id}/trends")
def get_trends(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset or dataset.processing_status != "cleaned":
        raise HTTPException(status_code=404, detail="Cleaned dataset not found")
        
    try:
        from ..services.cache_service import get_cached_service_result
        return get_cached_service_result(dataset.processed_file_location, dataset.dataset_type, "trends")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{dataset_id}/outliers")
def get_outliers(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if not dataset or dataset.processing_status != "cleaned":
        raise HTTPException(status_code=404, detail="Cleaned dataset not found")
        
    try:
        from ..services.cache_service import get_cached_service_result
        return get_cached_service_result(dataset.processed_file_location, dataset.dataset_type, "outliers")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
