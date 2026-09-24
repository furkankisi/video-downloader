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
        ydl_opts = {
            'quiet': True,
            'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "TikTok Videosu"),
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception as e:
        print("TikTok Bilgi Hatası:", e)
        raise HTTPException(status_code=400, detail="TikTok bilgileri alınamadı.")

@router.post("/download-tiktok")
async def download_tiktok(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': True,
        'format': 'best[ext=mp4]/best',
        'format_sort': ['vcodec:h264', 'vcodec:avc1', 'acodec:aac'],
        'outtmpl': final_filepath,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
            
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("Bozuk dosya")
            
        return FileResponse(final_filepath, media_type="video/mp4", filename="tiktok_video.mp4")
    except Exception as e:
        print("TikTok İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="TikTok indirme başarısız.")