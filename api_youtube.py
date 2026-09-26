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
    # Hem bilgisayarda tarayıcıda hem telefonda %100 çalışan güvenli ve hızlı public stream servisi
    api_url = "https://co.wuk.sh/api/json"
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://co.wuk.sh",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    payload = {
        "url": request.url,
        "vQuality": "720" if request.quality == "720p" else "1080",
        "filenamePattern": "basic"
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(api_url, json=payload, headers=headers)
            res.raise_for_status()
            data = res.json()
            
            download_link = data.get("url")
            if not download_link:
                raise Exception("İndirme linki alınamadı.")

            # Hem telefona hem bilgisayara doğrudan indirilebilir linki dönüyoruz
            return JSONResponse({
                "direct_url": download_link,
                "title": data.get("filename", "youtube_video.mp4")
            })

    except Exception as e:
        print("YouTube İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="YouTube videosu şu an indirilemiyor.")