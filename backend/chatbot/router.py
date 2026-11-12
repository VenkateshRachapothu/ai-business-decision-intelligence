from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.routes.auth import get_current_user
from app.models.dataset import Dataset
from .schemas import ChatRequest, ChatResponse
from .service import ChatbotService

router = APIRouter()

@router.post("/", response_model=ChatResponse)
def chat_endpoint(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Authenticate and get dataset
    dataset = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to dataset")
        
    chatbot_service = ChatbotService()
    try:
        response = chatbot_service.answer_question(request, dataset, current_user)
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")
