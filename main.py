import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

try:
    import imageio_ffmpeg
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_PATH = 'ffmpeg'

app = FastAPI(title="Video İndirici API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Video Downloader API çalışıyor kanka!"}

@app.post("/get-info")
async def get_info(request: dict):
    video_url = request.get("url")
    if not video_url:
        raise HTTPException(status_code=400, detail="URL bulunamadı.")
        
    # YouTube'un 400 hatası vermesini engelleyen tam teşekküllü tarayıcı maskesi
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'nocheckcertificate': True,
        'extract_flat': False,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'http_headers': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Fetch-Mode': 'navigate',
        }
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            return {
                "title": info.get("title", "İsimsiz Video"),
                "thumbnail": info.get("thumbnail", ""),
                "duration": info.get("duration", 0)
            }
    except Exception as e:
        print(f"YOUTUBE BİLGİ HATASI: {str(e)}") 
        raise HTTPException(status_code=400, detail=f"Video bilgisi alınamadı: {str(e)}")

@app.post("/download-video")
async def download_video(request: dict):
    video_url = request.get("url")
    
    if not video_url:
        raise HTTPException(status_code=400, detail="URL bulunamadı.")

    file_id = str(uuid.uuid4())
    output_template = f"downloads/{file_id}.%(ext)s"
    
    os.makedirs("downloads", exist_ok=True)

    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': output_template,
        'ffmpeg_location': FFMPEG_PATH,
        'merge_output_format': 'mp4',
        'quiet': False,
        'nocheckcertificate': True,
        'geo_bypass': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        downloaded_file = None
        for file in os.listdir("downloads"):
            if file.startswith(file_id) and file.endswith(".mp4"):
                downloaded_file = os.path.join("downloads", file)
                break

        if not downloaded_file:
            for file in os.listdir("downloads"):
                if file.startswith(file_id):
                    downloaded_file = os.path.join("downloads", file)
                    break

        if not downloaded_file or not os.path.exists(downloaded_file):
            raise HTTPException(status_code=400, detail="Video indirilemedi.")

        return FileResponse(
            downloaded_file, 
            media_type="video/mp4", 
            filename="video_indirildi.mp4"
        )

    except Exception as e:
        print(f"HATA DETAYI: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Video işlenemedi: {str(e)}")