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
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Geçersiz URL.")

    # Dünyanın en stabil açık kaynaklı video indirme altyapısı (Cobalt API)
    cobalt_api = "https://api.cobalt.tools/api/json"
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    
    payload = {
        "url": url,
        "vQuality": request.quality if request.quality != "best" else "720",
        "filenamePattern": "basic"
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(cobalt_api, json=payload, headers=headers)
            if res.status_code != 200:
                raise Exception(f"Cobalt API Hatası: {res.status_code}")
                
            data = res.json()
            
            # Cobalt API yanıt türleri: redirect, tunnel veya picker olabilir
            download_link = data.get("url")
            if not download_link and "picker" in data:
                download_link = data["picker"][0].get("url")

            if not download_link:
                raise Exception("İndirme linki oluşturulamadı.")

            return JSONResponse({
                "direct_url": download_link,
                "title": "youtube_video.mp4"
            })

    except Exception as e:
        print("YouTube İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="YouTube videosu indirilemedi.")