import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_instagram import router as insta_router
from api_tiktok import router as tiktok_router
from api_x import router as x_router
from common import ANSI_RE, cleanup_old_files

app = FastAPI(title="VideoSaver PRO API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(insta_router)
app.include_router(tiktok_router)
app.include_router(x_router)


@app.on_event("startup")
def _startup():
    cleanup_old_files()


@app.get("/")
def health():
    import yt_dlp
    return {"status": "VideoSaver PRO API aktif", "yt_dlp": yt_dlp.version.__version__}


@app.get("/debug")
def debug(url: str = ""):
    """Teşhis: verilen link için yt-dlp gerçekte ne hata veriyor?
    Örnek: /debug?url=https://www.tiktok.com/@a/video/123"""
    from common import ydl_attempts, extract_url
    import yt_dlp

    report = {"yt_dlp": yt_dlp.version.__version__, "ffmpeg": None}
    from common import ffmpeg_path
    report["ffmpeg"] = ffmpeg_path()
    try:
        import curl_cffi  # noqa: F401
        report["curl_cffi"] = True
    except Exception:
        report["curl_cffi"] = False

    if url:
        link = extract_url(url)
        last_error = None
        for opts in ydl_attempts():
            opts["skip_download"] = True
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(link, download=False)
                    report["sonuc"] = "OK"
                    report["baslik"] = info.get("title")
                    report["formatlar"] = [
                        f"{f.get('format_id')} {f.get('ext')} {f.get('height')}p {f.get('vcodec')}/{f.get('acodec')}"
                        for f in (info.get("formats") or [])[:15]
                    ]
                    return report
            except Exception as e:
                last_error = e
        report["sonuc"] = "HATA"
        report["hata"] = ANSI_RE.sub("", str(last_error))[:600] if last_error else "Bilinmeyen"
    return report


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))