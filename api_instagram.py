import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str

@router.post("/info-instagram")
async def info_instagram(request: VideoRequest):
    try:
        ydl_opts = {'quiet': True, 'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "Instagram Videosu"),
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception:
        raise HTTPException(status_code=400, detail="Instagram bilgileri alınamadı.")

@router.post("/download-instagram")
async def download_instagram(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': True,
        'format': 'best[ext=mp4]/best', 
        'format_sort': ['vcodec:h264', 'vcodec:avc1', 'acodec:aac'],
        'outtmpl': final_filepath,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
            
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("Bozuk dosya")
            
        return FileResponse(final_filepath, media_type="video/mp4", filename="ig_video.mp4")
    except Exception:
        raise HTTPException(status_code=400, detail="Instagram indirme başarısız.")