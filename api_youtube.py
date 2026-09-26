import httpx
import yt_dlp
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from common import (
    MIN_FILE_SIZE, base_ydl_opts, cleanup_cookiefile, extract_url, find_output,
    friendly_error, new_output_path, remove_files_with_stem, set_youtube_clients,
)

router = APIRouter()

# 2026 PO Token kalkanını aşabilen TEK cihaz listesi (TV ve VR kimlikleri Oauth ve Token doğrulamasından muaftır).
CLIENT_CHAINS = [
    ["android_vr"],
    ["tv_downgraded", "web_embedded"]
]

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def build_format(quality: str) -> str:
    # RAM'i şişirmemek ve saniyeler içinde indirmek için BİRLEŞTİRİLMİŞ hazır video+ses dosyası
    cap = {"720p": 720, "360p": 360}.get(quality, 1080)
    h = f"[height<={cap}]"
    return f"b{h}[ext=mp4]/b[ext=mp4]/best"

def _oembed(url: str) -> dict:
    """Oembed, video başlığını ve kapağını limitsiz ve engelsiz şekilde anında verir."""
    try:
        r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
        if r.status_code == 200:
            d = r.json()
            return {"title": d.get("title", "YouTube Videosu"), "thumbnail": d.get("thumbnail_url", "")}
    except:
        pass
    return {"title": "YouTube Videosu", "thumbnail": ""}

@router.post("/info-youtube")
def info_youtube(request: VideoRequest):
    url = extract_url(request.url)
    return _oembed(url)

@router.post("/download-youtube")
def download_youtube(request: VideoRequest):
    url = extract_url(request.url)
    out = new_output_path("mp4")
    fmt = build_format(request.quality)
    last = None

    for clients in CLIENT_CHAINS:
        opts = base_ydl_opts("youtube")
        opts["format"] = fmt
        opts["outtmpl"] = str(out.with_suffix("")) + ".%(ext)s"
        opts["source_address"] = "0.0.0.0" # IPv6 IP Banına karşı zorunlu kalkan
        
        # Ekstra IP gizleme ve yönlendirme
        opts["http_headers"] = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }

        set_youtube_clients(opts, clients)
        
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            
            final = find_output(out)
            if not final or final.stat().st_size < MIN_FILE_SIZE:
                raise RuntimeError("Bozuk veya boş dosya indirildi, muhtemelen bot koruması.")
            
            return FileResponse(
                str(final), media_type="video/mp4", filename="yt_video.mp4",
                background=BackgroundTask(remove_files_with_stem, out),
            )
        except Exception as e:
            last = e
            print(f"YouTube indirme hatası ({clients}):", e)
            remove_files_with_stem(out)
        finally:
            cleanup_cookiefile(opts)

    raise HTTPException(status_code=400, detail=friendly_error(last, "YouTube"))