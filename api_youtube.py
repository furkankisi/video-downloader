import os, uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

router = APIRouter()

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def get_cookie_path():
    # Dosyanın olduğu klasör ve bir üst klasörde cookies.txt arar (Yol hatasını 0'a indirir)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    paths_to_check = [
        os.path.join(current_dir, "cookies.txt"),
        os.path.join(os.path.dirname(current_dir), "cookies.txt"),
        "cookies.txt"
    ]
    for p in paths_to_check:
        if os.path.exists(p):
            print(f"✔ Cookies bulundu: {p}")
            return p
    print("❌ DİKKAT: cookies.txt bulunamadı!")
    return None

@router.post("/info-youtube")
async def info_youtube(request: VideoRequest):
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {'youtube': {'player_client': ['ios', 'android']}}
        }
        cookie_file = get_cookie_path()
        if cookie_file:
            ydl_opts['cookiefile'] = cookie_file

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
    
    cookie_file = get_cookie_path()
    if cookie_file:
        ydl_opts['cookiefile'] = cookie_file

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
            
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("Bozuk dosya")
            
        return FileResponse(final_filepath, media_type="video/mp4", filename="yt_video.mp4")
    except Exception as e:
        print("YouTube İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="YouTube indirilemedi. Cookies veya linki kontrol edin.")