import os
import re
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask
from common import extract_url, new_output_path, remove_files_with_stem

router = APIRouter()

# RapidAPI Bilgilerin (Anahtarın doğrudan entegre edildi)
RAPIDAPI_KEY = "e91cd2bbfdmsh3f37169e7c04ba3p1835adjsnf98c2815aa3e" 
RAPIDAPI_HOST = "youtube-video-fast-downloader-24-7.p.rapidapi.com"

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def get_youtube_video_id(url: str) -> str:
    """YouTube veya Shorts linkinden video ID'sini tertemiz ayıklar"""
    url = extract_url(url)
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed\/)([0-9A-Za-z_-]{11})',
        r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})',
        r'(?:shorts\/)([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""

def _oembed(url: str) -> dict:
    """YouTube oEmbed ile hızlı ve engelsiz başlık/kapak çekme"""
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
async def download_youtube(request: VideoRequest):
    video_id = get_youtube_video_id(request.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Geçersiz YouTube linki.")
        
    out = new_output_path("mp4")
    final_filepath = str(out.with_suffix(".mp4"))

    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
    }
    
    rapid_url = f"https://{RAPIDAPI_HOST}/Get-Video-Download-URL"
    
    params = {
        "videoId": video_id,
        "quality": "247" if request.quality == "720p" else "22"
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(rapid_url, headers=headers, params=params)
            
            if response.status_code != 200:
                raise Exception(f"RapidAPI HTTP Hatası: {response.status_code}")
                
            data = response.json()
            
            download_link = data.get("url") or data.get("link") or data.get("downloadLink")
            
            if not download_link and isinstance(data, dict):
                for k, v in data.items():
                    if isinstance(v, str) and v.startswith("http"):
                        download_link = v
                        break

            if not download_link:
                raise Exception("RapidAPI indirme linki döndürmedi.")

            async with client.stream("GET", download_link, follow_redirects=True) as video_res:
                video_res.raise_for_status()
                with open(final_filepath, "wb") as f:
                    async for chunk in video_res.aiter_bytes(chunk_size=1024 * 1024):
                        f.write(chunk)

        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("İndirilen dosya boyutu çok küçük veya bozuk.")

        return FileResponse(
            final_filepath, 
            media_type="video/mp4", 
            filename="yt_video.mp4",
            background=BackgroundTask(remove_files_with_stem, out)
        )

    except Exception as e:
        print("RapidAPI YouTube İndirme Hatası:", e)
        remove_files_with_stem(out)
        raise HTTPException(status_code=400, detail="YouTube videosu RapidAPI üzerinden çekilemedi.")