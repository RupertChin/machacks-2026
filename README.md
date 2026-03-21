# GestureCAD

Web-based CAD editor with hand gesture navigation and AI voice-controlled design via Claude.

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- Java 11+ (for OpenDataLoader)

### Environment Variables

Copy `.env.example` to `.env` in the project root and fill in your API keys:

```bash
cp .env.example .env
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Runs at http://localhost:8000

## Project Structure

- `frontend/` — React + Vite + TypeScript + Tailwind CSS
- `backend/` — FastAPI + Python
- `implementation-spec.md` — Full implementation specification
