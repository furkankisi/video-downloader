import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

@router.post("/info-youtube")
async def info_youtube(request: VideoRequest):
    try:
        # YouTube'u dize getiren orijinal ve kesin çalışan player_client ayarı
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "YouTube Videosu"),
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception as e:
        print("YouTube Bilgi Hatası:", e)
        return {"title": "YouTube Videosu", "thumbnail": ""}

@router.post("/download-youtube")
async def download_youtube(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    format_opt = 'best[ext=mp4]/best'
    if request.quality == '720p':
        format_opt = 'best[height<=720][ext=mp4]/best'
    elif request.quality == '360p':
        format_opt = 'best[height<=360][ext=mp4]/best'

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'format': format_opt,
        'outtmpl': final_filepath,
        'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
            
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("Bozuk dosya")
            
        return FileResponse(final_filepath, media_type="video/mp4", filename="yt_video.mp4")
    except Exception as e:
        print("YouTube İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="YouTube indirme başarısız.")