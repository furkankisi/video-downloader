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

# En stabil mobil istemcilerle engeli aşıyoruz
CLIENT_CHAINS = [
    ["android", "web"], 
    ["ios", "web"],
    None,
]

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

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
    
    # KAN KANAYAN YARAYI ÇÖZEN FORMAT: 
    # Sadece tek parça (pre-merged) MP4 çeker. Sunucuda FFmpeg birleştirmesi yapmaz, RAM şişirmez.
    fmt = 'best[height<=720][ext=mp4]/best[ext=mp4]/best'
    if request.quality == '360p':
        fmt = 'best[height<=360][ext=mp4]/best[ext=mp4]/best'

    last = None

    for clients in CLIENT_CHAINS:
        opts = base_ydl_opts("youtube")
        opts["format"] = fmt
        opts["outtmpl"] = str(out.with_suffix("")) + ".%(ext)s"
        opts["nopostoverwrites"] = True # Post-processor çökmesini engeller
        
        set_youtube_clients(opts, clients)
        
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            
            final = find_output(out)
            if not final or final.stat().st_size < MIN_FILE_SIZE:
                raise RuntimeError("Bozuk veya boş dosya")
            
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

    raise HTTPException(status_code=400, detail="YouTube videosu indirilemedi. Sunucu kapasitesi aşıldı.")