import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str

@router.post("/download-instagram")
async def download_instagram(request: VideoRequest):
    clean_link = request.url.split("?")[0] if "?" in request.url else request.url
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': True,
        'format': 'best[vcodec^=avc1][ext=mp4]/best[ext=mp4]/best', 
        'outtmpl': final_filepath,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_link])
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 100000:
            raise Exception("Hata")
        return FileResponse(final_filepath, media_type="video/mp4", filename="ig_video.mp4")
    except Exception:
        raise HTTPException(status_code=400, detail="Instagram videoyu engelledi.")