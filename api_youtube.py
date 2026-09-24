import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp
import imageio_ffmpeg

ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
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
            'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
            'extractor_args': {'youtube': {'player_client': ['ios']}}
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "YouTube Videosu"),
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception as e:
        print("YouTube Bilgi Hatası:", e)
        raise HTTPException(status_code=400, detail="YouTube bilgileri alınamadı.")

@router.post("/download-youtube")
async def download_youtube(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    format_opt = 'bestvideo[ext=mp4]+bestaudio[m4a]/best[ext=mp4]/best'
    if request.quality == '720p':
        format_opt = 'bestvideo[height<=720][ext=mp4]+bestaudio/best[height<=720][ext=mp4]/best'
    elif request.quality == '360p':
        format_opt = 'bestvideo[height<=360][ext=mp4]+bestaudio/best[height<=360][ext=mp4]/best'

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'format': format_opt,
        'merge_output_format': 'mp4',
        'ffmpeg_location': ffmpeg_path,
        'outtmpl': final_filepath,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'extractor_args': {'youtube': {'player_client': ['ios']}}
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