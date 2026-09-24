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


@app.get("/debug")
def debug(url: str = ""):
    """Teşhis: ortamda ne var, verilen link için yt-dlp gerçekte ne hata veriyor?
    Örnek: https://SUNUCU/debug?url=https://youtu.be/VIDEO_ID"""
    import shutil
    import yt_dlp
    from common import ffmpeg_path, base_ydl_opts, extract_url, ANSI_RE

    report = {
        "yt_dlp": yt_dlp.version.__version__,
        "ffmpeg": ffmpeg_path(),
        "deno": shutil.which("deno"),
        "node": shutil.which("node"),
        "proxy_ayarli": bool(os.getenv("PROXY_URL")),
        "cerez_ayarli": bool(os.getenv("YT_COOKIES_B64") or os.getenv("YT_COOKIES_FILE")),
    }
    from common import pot_server_home
    report["po_token_saglayici"] = pot_server_home() or "KURULU DEGIL (build_pot.sh calismamis)"
    try:
        import curl_cffi  # noqa: F401
        report["curl_cffi"] = True
    except Exception:
        report["curl_cffi"] = False

    if url:
        link = extract_url(url)
        platform = "youtube" if ("youtu" in link) else "tiktok" if "tiktok" in link else ""
        opts = base_ydl_opts(platform)
        opts["skip_download"] = True
        opts["format"] = "b/bv*+ba"
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(link, download=False)
                report["sonuc"] = "OK"
                report["formatlar"] = [
                    f"{f.get('format_id')} {f.get('ext')} {f.get('height')}p {f.get('vcodec')}/{f.get('acodec')}"
                    for f in (info.get("formats") or [])[:15]
                ]
        except Exception as e:
            report["sonuc"] = "HATA"
            report["hata"] = ANSI_RE.sub("", str(e))[:600]
    return report


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))