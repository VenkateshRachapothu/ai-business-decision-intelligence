from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine

# Basic tests for Phase 1
client = TestClient(app)

# Note: We should override get_db for true testing, but this is a basic test using the main sqlite db

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to AI Business Decision Intelligence API"}

def test_register():
    response = client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpassword"
    })
    # If already exists, we might get 400
    assert response.status_code in [200, 400]

def test_login():
    response = client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "testpassword"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_invalid_password():
    response = client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"

def test_login_missing_user():
    response = client.post("/api/auth/login", data={
        "username": "nonexistent_user_99999",
        "password": "somepassword"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"

def test_cors_options_and_headers():
    # Test preflight OPTIONS from port 5174
    response = client.options("/api/auth/me", headers={
        "Origin": "http://localhost:5174",
        "Access-Control-Request-Method": "GET"
    })
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5174"

    # Test login request with Origin header
    login_resp = client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "testpassword"
    }, headers={"Origin": "http://localhost:5174"})
    assert login_resp.status_code == 200
    assert login_resp.headers.get("access-control-allow-origin") == "http://localhost:5174"

def test_get_me_with_token():
    login_resp = client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "testpassword"
    })
    token = login_resp.json()["access_token"]
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "testuser"

