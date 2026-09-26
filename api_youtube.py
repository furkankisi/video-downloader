import os
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

# Senin ortak fonksiyonların
from common import extract_url, new_output_path, remove_files_with_stem

router = APIRouter()

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def _oembed(url: str) -> dict:
    """Sadece başlık ve kapağı çekmek için YouTube'un resmi hafif API'si (Banlanmaz)"""
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
async def download_youtube(request: VideoRequest):
    url = extract_url(request.url)
    
    # Senin common.py içindeki dosya yolu üreticin
    out = new_output_path("mp4")
    final_filepath = str(out.with_suffix(".mp4"))
    
    # Cobalt API Ayarları (Ücretsiz, limitsiz ve ban korumalı)
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    # Kalite çevirisi
    q_map = {"720p": "720", "360p": "360", "best": "1080"}
    v_quality = q_map.get(request.quality, "720")

    payload = {
        "url": url,
        "vQuality": v_quality,
        "filenamePattern": "basic"
    }
    
    try:
        # httpx.AsyncClient ile asenkron API isteği (Sunucuyu kitlemez)
        async with httpx.AsyncClient(timeout=60.0) as client:
            
            # 1. Aşama: Videoyu API'ye ver, hazır MP4 linkini kap
            res = await client.post("https://api.cobalt.tools/api/json", json=payload, headers=headers)
            res.raise_for_status()
            data = res.json()
            
            if data.get("status") == "error":
                raise Exception(data.get("text", "API Hatası"))
                
            download_url = data.get("url")
            if not download_url:
                raise Exception("API indirme linki vermedi.")
            
            # 2. Aşama: Gelen linkten videoyu RAM'i şişirmeden (1MB parçalarla) sunucuya kaydet
            async with client.stream("GET", download_url, follow_redirects=True) as video_res:
                video_res.raise_for_status()
                with open(final_filepath, "wb") as f:
                    async for chunk in video_res.aiter_bytes(chunk_size=1024 * 1024):
                        f.write(chunk)

        # 3. Aşama: İndirilen dosyayı kontrol et
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 50000:
            raise Exception("İndirilen video bozuk veya ulaşılamadı.")

        # Kullanıcıya gönder ve arka planda sunucudan temizle
        return FileResponse(
            final_filepath, 
            media_type="video/mp4", 
            filename="yt_video.mp4",
            background=BackgroundTask(remove_files_with_stem, out)
        )

    except Exception as e:
        print("API İndirme Hatası:", e)
        remove_files_with_stem(out)
        raise HTTPException(status_code=400, detail="YouTube videosu çekilemedi. Ücretsiz API reddetti.")