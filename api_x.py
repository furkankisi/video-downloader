import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from common import extract_url

router = APIRouter()

class XRequest(BaseModel):
    url: str

@router.post("/info-x")
def info_x(request: XRequest):
    url = extract_url(request.url)
    # X için hızlı oEmbed veya fallback başlık/kapak
    try:
        r = httpx.get("https://publish.twitter.com/oembed", params={"url": url}, timeout=10)
        if r.status_code == 200:
            d = r.json()
            return {
                "title": d.get("author_name", "X Gönderisi") + " - Video",
                "thumbnail": ""
            }
    except:
        pass
    return {"title": "X Videosu", "thumbnail": ""}

@router.post("/download-x")
async def download_x(request: XRequest):
    url = extract_url(request.url)
    if not url:
        raise HTTPException(status_code=400, detail="Geçersiz URL.")

    # X videolarını saniyeler içinde yakalayan güvenli açık kaynak public altyapı
    cobalt_api = "https://api.cobalt.tools/api/json"
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    
    payload = {
        "url": url,
        "vQuality": "720",
        "filenamePattern": "basic"
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(cobalt_api, json=payload, headers=headers)
            if res.status_code != 200:
                raise Exception(f"API Hatası: {res.status_code}")
                
            data = res.json()
            download_link = data.get("url")
            if not download_link and "picker" in data:
                download_link = data["picker"][0].get("url")

            if not download_link:
                raise Exception("İndirme linki alınamadı.")

            return JSONResponse({
                "direct_url": download_link,
                "title": "x_video.mp4"
            })

    except Exception as e:
        print("X İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="X videosu indirilemedi.")