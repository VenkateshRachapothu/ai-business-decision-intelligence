from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import os

from app.core.database import get_db
from app.models.user import User
from app.routes.auth import get_current_user
from app.models.dataset import Dataset
from .schemas import ImageAnalysisResult
from .service import VisionService
from chatbot.context import get_or_build_dataset_context

router = APIRouter()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("/analyze", response_model=ImageAnalysisResult)
async def analyze_chart(
    image: UploadFile = File(...),
    question: str = Form("What does this chart show?"),
    dataset_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if image.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image format. Only JPEG, PNG, and WEBP are supported.")
        
    image_bytes = await image.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Image is too large. Maximum size is 5MB.")
        
    dataset_context = None
    if dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found.")
        if dataset.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Unauthorized access to dataset.")
            
        try:
            file_path = dataset.processed_file_location or dataset.original_file_location
            full_context = get_or_build_dataset_context(
                dataset_id=dataset.id,
                dataset_name=dataset.original_filename or dataset.name,
                file_path=file_path
            )
            analytics_data = full_context.get("analytics") or {}
            trends_data = full_context.get("trends") or {}
            risks_data = full_context.get("risks") or {}
            dataset_context = {
                "dataset_name": dataset.name,
                "analytics_summary": analytics_data.get("summary") or {
                    "total_revenue": analytics_data.get("total_revenue"),
                    "total_orders": analytics_data.get("total_orders"),
                },
                "top_products": (analytics_data.get("top_products") or [])[:5],
                "trends": trends_data.get("summary") or trends_data.get("trends", []),
                "risks": risks_data.get("summary") or (risks_data.get("risks") or [])[:5],
            }
        except Exception:
            dataset_context = None
            
    vision_service = VisionService()
    try:
        result = vision_service.analyze_image(
            image_bytes=image_bytes,
            mime_type=image.content_type,
            question=question,
            dataset_context=dataset_context
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")
