import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str

def get_cookie_path():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    paths_to_check = [
        os.path.join(current_dir, "cookies.txt"),
        os.path.join(os.path.dirname(current_dir), "cookies.txt"),
        "cookies.txt"
    ]
    for p in paths_to_check:
        if os.path.exists(p):
            return p
    return None

@router.post("/info-tiktok")
async def info_tiktok(request: VideoRequest):
    try:
        ydl_opts = {'quiet': True, 'no_warnings': True}
        cookie_file = get_cookie_path()
        if cookie_file:
            ydl_opts['cookiefile'] = cookie_file

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
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
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'format': 'best[ext=mp4]/best',
        'outtmpl': final_filepath,
    }
    
    cookie_file = get_cookie_path()
    if cookie_file:
        ydl_opts['cookiefile'] = cookie_file

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
            
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("Bozuk dosya")
            
        return FileResponse(final_filepath, media_type="video/mp4", filename="tiktok_video.mp4")
    except Exception as e:
        print("TikTok İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="TikTok indirilemedi.")