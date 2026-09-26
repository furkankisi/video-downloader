import httpx
import yt_dlp
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from common import base_ydl_opts, extract_url, set_youtube_clients

router = APIRouter()

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
    
    # TV ve VR istemcileriyle YouTube'un IP blok duvarını aşarak doğrudan akış adresini alıyoruz
    clients_list = [["android_vr"], ["tv_downgraded", "web_embedded"], None]
    
    for clients in clients_list:
        opts = base_ydl_opts("youtube")
        opts["skip_download"] = True  # Sunucu indirme yapmaz, sadece linki çözer!
        opts["format"] = "b[ext=mp4]/best"
        set_youtube_clients(opts, clients)
        
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                direct_url = info.get("url")
                
                if not direct_url:
                    for f in info.get("formats", []):
                        if f.get("ext") == "mp4" and f.get("url") and f.get("vcodec") != "none":
                            direct_url = f["url"]
                            break
                
                if direct_url:
                    # Sunucu dosyayı indirmek yerine doğrudan linki telefona veriyor
                    return {
                        "direct_url": direct_url, 
                        "title": info.get("title", "video")
                    }
        except Exception as e:
            print(f"Link alma denemesi başarısız ({clients}):", e)

    raise HTTPException(status_code=400, detail="YouTube doğrudan link alınamadı.")