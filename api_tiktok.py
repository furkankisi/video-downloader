import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str

@router.post("/download-tiktok")
async def download_tiktok(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': True,
        'format': 'best', # TikTok için varsayılan yeterli
        'outtmpl': final_filepath,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
        return FileResponse(final_filepath, media_type="video/mp4", filename="tiktok_video.mp4")
    except Exception:
        raise HTTPException(status_code=400, detail="TikTok videosu indirilemedi.")