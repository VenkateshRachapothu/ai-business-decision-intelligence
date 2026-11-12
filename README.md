# AI-Powered Business Decision Intelligence & Demand Risk Verification System

## Phase 1 - Foundation, Authentication & Dataset Processing

This project implements Phase 1 of the Decision Intelligence system.

### Tech Stack
- Frontend: React + Vite
- Backend: Python + FastAPI
- Database: SQLite
- Auth: JWT

### Setup

1. **Clone the repository**
2. **Datasets**: Ensure `Project_Data_Sets` is located locally (e.g. `C:\Project_Data_Sets`)
   - **Do not commit raw datasets to GitHub.**

### Backend Setup
```bash
cd backend
python -m venv venv
# Activate venv: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### API Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/datasets/upload`
- `GET /api/datasets`
- `GET /api/datasets/{dataset_id}`
- `GET /api/datasets/{dataset_id}/preview`
- `GET /api/datasets/{dataset_id}/quality`
- `POST /api/datasets/{dataset_id}/clean`
- `GET /api/datasets/{dataset_id}/cleaning-summary`

### Testing
Run `pytest` in the `backend` folder.
