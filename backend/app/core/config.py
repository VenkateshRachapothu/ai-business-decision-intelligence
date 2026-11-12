import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Decision Intelligence API"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    DATABASE_URL: str = f"sqlite:///{(BACKEND_DIR / 'ai_business.db').as_posix()}"
    
    # Dataset locations
    RAW_DATA_DIR: str = r"C:\Project_Data_Sets"
    PROCESSED_DATA_DIR: str = r"C:\Project_Data_Sets_Processed"
    UPLOADS_DIR: str = str(BACKEND_DIR / "uploads")

    # AI / LLM Configuration
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

settings = Settings()

# Normalize relative SQLite and upload paths against BACKEND_DIR
if settings.DATABASE_URL.startswith("sqlite:///./"):
    rel_db = settings.DATABASE_URL[len("sqlite:///./"):]
    settings.DATABASE_URL = f"sqlite:///{(BACKEND_DIR / rel_db).as_posix()}"

if settings.UPLOADS_DIR.startswith("./") or settings.UPLOADS_DIR.startswith(".\\"):
    settings.UPLOADS_DIR = str((BACKEND_DIR / settings.UPLOADS_DIR[2:]).resolve())

# Ensure directories exist
os.makedirs(settings.RAW_DATA_DIR, exist_ok=True)
os.makedirs(settings.PROCESSED_DATA_DIR, exist_ok=True)
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
