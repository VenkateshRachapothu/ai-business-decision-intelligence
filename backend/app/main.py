from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .core.database import Base, engine, SessionLocal
from .routes import auth, datasets, analytics, forecasting, risks
from chatbot.router import router as chat_router
from vision.router import router as vision_router

# Create db tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Business Decision Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(forecasting.router, prefix="/api/forecasting", tags=["forecasting"])
app.include_router(risks.router, prefix="/api/risks", tags=["risks"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(vision_router, prefix="/api/vision", tags=["vision"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Business Decision Intelligence API"}

@app.get("/health")
@app.get("/api/health")
def health_check():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection error: {str(e)}")
    finally:
        db.close()
