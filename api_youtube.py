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

# 3 kez deneyip seni bekletmemesi için SADECE en güçlü ve tek zinciri bırakıyoruz.
CLIENT_CHAINS = [
    ["ios", "android", "web"]
]

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def build_format(quality: str) -> str:
    # RAM şişiren FFmpeg birleştirmesine girmeden tek parça MP4 çeker.
    cap = {"720p": 720, "360p": 360}.get(quality, 1080)
    h = f"[height<={cap}]"
    return f"best[ext=mp4]{h}/best{h}/best"

def _oembed(url: str) -> dict:
    r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
    r.raise_for_status()
    d = r.json()
    return {"title": d.get("title", "YouTube Videosu"), "thumbnail": d.get("thumbnail_url", "")}

@router.post("/info-youtube")
def info_youtube(request: VideoRequest):
    url = extract_url(request.url)
    try:
        return _oembed(url)
    except Exception as e:
        print("YouTube oEmbed başarısız:", e)
        return {"title": "YouTube Videosu", "thumbnail": ""}

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
        
        # BULUT SUNUCULARDA (RENDER) YOUTUBE'U AÇAN ALTIN AYAR:
        # İstekleri IPv6 yerine zorla IPv4 üzerinden gönderir, bot duvarını aşar.
        opts["source_address"] = "0.0.0.0" 

        set_youtube_clients(opts, clients)
        
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            
            final = find_output(out)
            if not final or final.stat().st_size < MIN_FILE_SIZE:
                raise RuntimeError("Bozuk veya boş dosya indirildi")
            
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