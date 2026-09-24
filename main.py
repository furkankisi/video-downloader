import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_instagram import router as ig_router
from api_youtube import router as yt_router
from api_tiktok import router as tt_router
from common import cleanup_old_files

app = FastAPI(title="VideoSaver PRO Yönlendirici")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ig_router)
app.include_router(yt_router)
app.include_router(tt_router)


@app.on_event("startup")
def _startup():
    cleanup_old_files()


@app.get("/")
def health():
    """Render sağlık kontrolü + uygulamanın sunucuyu uyandırması için."""
    import yt_dlp
    return {"status": "ok", "yt_dlp": yt_dlp.version.__version__}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))