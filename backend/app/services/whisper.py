import asyncio
from openai import AsyncOpenAI
from app.config import settings


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio using OpenAI Whisper API. Retries once on failure."""
    client = _get_client()

    for attempt in range(2):
        try:
            response = await asyncio.wait_for(
                client.audio.transcriptions.create(
                    model="whisper-1",
                    file=(filename, audio_bytes),
                ),
                timeout=30.0,
            )
            return response.text
        except Exception as e:
            if attempt == 0:
                continue
            raise RuntimeError(f"Whisper transcription failed after retry: {e}")

    raise RuntimeError("Whisper transcription failed")
