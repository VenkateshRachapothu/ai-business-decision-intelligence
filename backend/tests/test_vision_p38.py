import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.routes.auth import get_current_user
from vision.service import VisionService

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

def test_missing_api_key():
    service = VisionService()
    service.api_key = None
    res = service.analyze_image(b"fake", "image/png", "What?")
    assert res.status == "VISION_ANALYSIS_FAILED"
    assert any("GROQ_API_KEY" in lim for lim in res.limitations)

@patch('vision.service.Groq')
def test_vision_success(mock_groq, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test_key")
    
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = json.dumps({
        "status": "SUCCESS",
        "chart_type": "Line Chart",
        "summary": "Revenue is up.",
        "observations": ["Upward trend in Q3"],
        "trends": ["Increasing revenue"],
        "anomalies": [],
        "risks": [],
        "recommendations": ["Stock more items"],
        "confidence": 0.85,
        "limitations": []
    })
    mock_client.chat.completions.create.return_value = mock_resp
    mock_groq.return_value = mock_client
    
    service = VisionService()
    res = service.analyze_image(b"fakebytes", "image/png", "Analyze this", dataset_context={"analytics": "test"})
    
    assert res.status == "SUCCESS"
    assert res.chart_type == "Line Chart"
    assert res.confidence == 0.85

@patch('vision.router.get_current_user')
def test_upload_invalid_mime(mock_get_user):
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=1)
    response = client.post(
        "/api/vision/analyze",
        files={"image": ("test.pdf", b"fake", "application/pdf")},
        data={"question": "What is this?"}
    )
    assert response.status_code == 400
    assert "Unsupported image format" in response.text
    app.dependency_overrides.clear()

@patch('vision.router.get_db')
@patch('vision.router.get_current_user')
def test_dataset_unauthorized(mock_get_user, mock_get_db):
    mock_get_user.return_value = MagicMock(id=1)
    
    mock_db = MagicMock()
    mock_db.query().filter().first.return_value = MagicMock(user_id=999) # different user
    
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=1)
    
    response = client.post(
        "/api/vision/analyze",
        files={"image": ("test.png", b"fake", "image/png")},
        data={"dataset_id": 1, "question": "test"}
    )
    assert response.status_code == 403
    assert "Unauthorized access" in response.text
    
    app.dependency_overrides.clear()
