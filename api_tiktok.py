import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str

def get_ydl_opts():
    opts = {
        'quiet': True,
        'no_warnings': True,
        'geo_bypass': True,
        'nocheckcertificate': True,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    }
    if os.path.exists('cookies.txt'):
        opts['cookiefile'] = 'cookies.txt'
    return opts

@router.post("/info-tiktok")
async def info_tiktok(request: VideoRequest):
    try:
        opts = get_ydl_opts()
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "TikTok Videosu"),
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception as e:
        print("TikTok Bilgi Hatası:", e)
        return {"title": "TikTok Videosu", "thumbnail": ""}

@router.post("/download-tiktok")
async def download_tiktok(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    opts = get_ydl_opts()
    opts['format'] = 'best[ext=mp4]/best'
    opts['outtmpl'] = final_filepath

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([request.url])
            
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("Bozuk dosya")
            
        return FileResponse(final_filepath, media_type="video/mp4", filename="tiktok_video.mp4")
    except Exception as e:
        print("TikTok İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="TikTok videosu indirilemedi.")