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
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 30,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "YouTube Videosu"),
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception as e:
        print("YouTube Bilgi Hatası:", e)
        # 400 hatası döndürüp sistemi kilitlemek yerine yedek obje döndürüyoruz
        return {
            "title": "YouTube Videosu",
            "thumbnail": ""
        }

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
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
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