import httpx
import yt_dlp
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from common import base_ydl_opts, extract_url, set_youtube_clients

router = APIRouter()

CLIENT_CHAINS = [
    ["android_vr"],
    ["tv_downgraded", "web_embedded"],
    None
]

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def _oembed(url: str) -> dict:
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
    return _oembed(request.url)

@router.post("/download-youtube")
def download_youtube(request: VideoRequest):
    url = extract_url(request.url)
    last = None

    # Sunucu üzerinden indirmek yerine, YouTube'un ham video linkini (Direct Stream URL) yakalıyoruz
    for clients in CLIENT_CHAINS:
        opts = base_ydl_opts("youtube")
        opts["skip_download"] = True  # İndirme yapma, sadece linki ver!
        opts["format"] = "b[ext=mp4]/best"
        set_youtube_clients(opts, clients)
        
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                # YouTube'un engelsiz doğrudan indirme linki
                direct_url = info.get("url")
                if not direct_url:
                    formats = info.get("formats", [])
                    for f in formats:
                        if f.get("ext") == "mp4" and f.get("url") and f.get("vcodec") != "none":
                            direct_url = f["url"]
                            break
                
                if direct_url:
                    return {"direct_url": direct_url, "title": info.get("title", "video")}
        except Exception as e:
            last = e
            print(f"Direkt link alma hatası ({clients}):", e)

    raise HTTPException(status_code=400, detail="YouTube doğrudan link alınamadı.")