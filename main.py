import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import yt_dlp

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
        
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'nocheckcertificate': True,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
        raise HTTPException(status_code=400, detail=f"Video bilgisi alınamadı: {str(e)}")

@app.post("/download-video")
async def download_video(request: dict):
    video_url = request.get("url")
    
    if not video_url:
        raise HTTPException(status_code=400, detail="URL bulunamadı.")

    file_id = str(uuid.uuid4())
    output_template = f"downloads/{file_id}.%(ext)s"
    
    os.makedirs("downloads", exist_ok=True)

    # Dosya boyutunu devasa şişirmeyen, optimize web kalitesini seçen akıllı format ayarı
    ydl_opts = {
        'format': 'best[height<=720]/best[ext=mp4]/best',
        'outtmpl': output_template,
        'quiet': False,
        'nocheckcertificate': True,
        'geo_bypass': True,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        downloaded_file = None
        for file in os.listdir("downloads"):
            if file.startswith(file_id):
                downloaded_file = os.path.join("downloads", file)
                break

        if not downloaded_file or not os.path.exists(downloaded_file):
            raise HTTPException(status_code=400, detail="Video indirilemedi.")

        return FileResponse(
            downloaded_file, 
            media_type="video/mp4", 
            filename=f"video_indirildi.mp4"
        )

    except Exception as e:
        print(f"HATA DETAYI: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Video işlenemedi: {str(e)}")