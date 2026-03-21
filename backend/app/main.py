from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import session, voice, spec, tools

app = FastAPI(title="GestureCAD", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session.router)
app.include_router(voice.router)
app.include_router(spec.router)
app.include_router(tools.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
