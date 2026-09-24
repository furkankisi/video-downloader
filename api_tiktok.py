import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str

@router.post("/info-tiktok")
async def info_tiktok(request: VideoRequest):
    try:
        ydl_opts = {'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "TikTok Videosu"),
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception:
        raise HTTPException(status_code=400, detail="TikTok bilgileri alınamadı.")

@router.post("/download-tiktok")
async def download_tiktok(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': True,
        'format': 'best',
        'outtmpl': final_filepath,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
        return FileResponse(final_filepath, media_type="video/mp4", filename="tiktok_video.mp4")
    except Exception:
        raise HTTPException(status_code=400, detail="TikTok indirme başarısız.")