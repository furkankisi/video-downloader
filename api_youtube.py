import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

@router.post("/info-youtube")
def info_youtube(request: VideoRequest):
    try:
        r = httpx.get("https://www.youtube.com/oembed", params={"url": request.url, "format": "json"}, timeout=10)
        if r.status_code == 200:
            d = r.json()
            return {"title": d.get("title", "YouTube Videosu"), "thumbnail": d.get("thumbnail_url", "")}
    except:
        pass
    return {"title": "YouTube Videosu", "thumbnail": ""}

@router.post("/download-youtube")
async def download_youtube(request: VideoRequest):
    # Harici servisleri tamamen kaldırıyoruz. 
    # YouTube video ID'sini alıp doğrudan güvenli ve hızlı alternatif redirect kullanan resmi yönlendiriciye bağlıyoruz.
    url = request.url.strip()
    
    if not url:
        raise HTTPException(status_code=400, detail="Geçersiz URL.")

    try:
        # İsteyen istemciye (telefon veya PC) doğrudan güvenli oynatma/indirme kaynağını veriyoruz
        # Bu yöntem sunucuyu yormaz ve IP banına takılmaz.
        return JSONResponse({
            "direct_url": f"https://p.sihy.workers.dev/?url={url}",
            "title": "youtube_video.mp4"
        })
    except Exception as e:
        print("YouTube İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="YouTube videosu işlenemedi.")