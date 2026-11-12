import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import json

from app.main import app
from app.core.database import get_db
from app.routes.auth import get_current_user
from chatbot.schemas import ChatRequest, ChatResponse
from chatbot.service import ChatbotService

client = TestClient(app)

@pytest.fixture
def mock_dataset():
    class MockDataset:
        id = 1
        name = "test_dataset.csv"
        original_filename = "test_dataset.csv"
        processed_file_location = "/path/to/processed.csv"
        original_file_location = "/path/to/original.csv"
        user_id = 1
    return MockDataset()

@pytest.fixture
def mock_user():
    class MockUser:
        id = 1
        email = "test@example.com"
    return MockUser()

def test_missing_question(mock_dataset, mock_user):
    service = ChatbotService()
    with pytest.raises(ValueError, match="Question cannot be empty"):
        service.answer_question(ChatRequest(dataset_id=1, question="   "), mock_dataset, mock_user)

@patch('chatbot.service.os.getenv')
def test_missing_api_key(mock_getenv, mock_dataset, mock_user):
    mock_getenv.return_value = None
    service = ChatbotService()
    res = service.answer_question(ChatRequest(dataset_id=1, question="Hello?"), mock_dataset, mock_user)
    assert res.confidence == 0.0
    assert "unavailable" in res.answer.lower()
    assert any("GROQ_API_KEY" in lim for lim in res.limitations)

@patch('chatbot.service.get_or_build_dataset_context')
@patch('chatbot.service.RAGService')
@patch('chatbot.service.Groq')
def test_valid_question(mock_groq, mock_rag_cls, mock_get_context, mock_dataset, mock_user, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test_key")
    
    mock_get_context.return_value = {
        "dataset_name": "test",
        "verification": {"status": "VERIFIED"}
    }
    
    mock_rag_service = MagicMock()
    mock_rag_service.retrieve_evidence.return_value = [{"content": "sales are up"}]
    mock_rag_cls.return_value = mock_rag_service
    
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = json.dumps({
        "answer": "Sales have increased.",
        "evidence": ["sales are up"],
        "confidence": 0.9,
        "limitations": []
    })
    mock_client.chat.completions.create.return_value = mock_resp
    mock_groq.return_value = mock_client
    
    service = ChatbotService()
    res = service.answer_question(ChatRequest(dataset_id=1, question="How are sales?"), mock_dataset, mock_user)
    
    assert res.answer == "Sales have increased."
    assert "sales are up" in res.evidence
    assert res.verification_status == "VERIFIED"

@patch('chatbot.service.get_or_build_dataset_context')
@patch('chatbot.service.RAGService')
@patch('chatbot.service.Groq')
def test_olist_stock_limitation(mock_groq, mock_rag_cls, mock_get_context, mock_dataset, mock_user, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test_key")
    mock_dataset.name = "olist_orders.csv"
    mock_dataset.original_filename = "olist_orders.csv"
    mock_get_context.return_value = {}
    
    mock_rag_service = MagicMock()
    mock_rag_service.retrieve_evidence.return_value = []
    mock_rag_cls.return_value = mock_rag_service
    
    mock_client = MagicMock()
    mock_resp = MagicMock()
    # Hallucinating LLM answer
    mock_resp.choices[0].message.content = json.dumps({
        "answer": "Product X will definitely run out of stock.",
        "evidence": [],
        "confidence": 0.9,
        "limitations": []
    })
    mock_client.chat.completions.create.return_value = mock_resp
    mock_groq.return_value = mock_client
    
    service = ChatbotService()
    res = service.answer_question(ChatRequest(dataset_id=1, question="Will it stock out?"), mock_dataset, mock_user)
    
    assert res.confidence < 0.9 # should be reduced
    assert any("actual inventory levels are unavailable" in lim.lower() for lim in res.limitations)

@patch('chatbot.router.get_db')
@patch('chatbot.router.get_current_user')
def test_router_dataset_not_found(mock_get_user, mock_get_db):
    mock_get_user.return_value = MagicMock(id=1)
    
    mock_db = MagicMock()
    # Query returns none
    mock_db.query().filter().first.return_value = None
    
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=1)
    
    response = client.post("/api/chat/", json={"dataset_id": 999, "question": "Hi"})
    assert response.status_code == 404
    assert "Dataset not found" in response.text
    
    app.dependency_overrides.clear()
