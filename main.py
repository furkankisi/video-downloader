@app.get("/")
def read_root():
    return {"status": "Video Downloader API çalışıyor kanka!"}
import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="Video İndirici API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

@app.post("/get-info")
async def get_info(request: VideoRequest):
    ydl_opts = {
    'format': 'best',  # En iyi tekli formatı seçer, ayrı ayrı indirip birleştirmeye çalışmaz (bozuk dosya riskini sıfırlar)
    'noplaylist': True,
    'quiet': True,
    'nocheckcertificate': True
}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "İsimsiz Video"),
                "thumbnail": info.get("thumbnail", ""),
                "duration": info.get("duration", 0)
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Video bilgisi alınamadı: {str(e)}")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    quality = request.quality
    
    if quality == "1080":
        format_str = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/bv*[height<=1080]+ba/b[height<=1080]"
    elif quality == "720":
        format_str = "bestvideo[height<=720]+bestaudio/best[height<=720]/bv*[height<=720]+ba/b[height<=720]"
    elif quality == "480":
        format_str = "bestvideo[height<=480]+bestaudio/best[height<=480]/bv*[height<=480]+ba/b[height<=480]"
    else:
        format_str = "bestvideo+bestaudio/best/bv*+ba/b"

    file_id = str(uuid.uuid4())
    output_template = f"downloads/{file_id}.%(ext)s"
    
    os.makedirs("downloads", exist_ok=True)

    ydl_opts = {
        'format': format_str,
        'outtmpl': output_template,
        'merge_output_format': 'mp4',
        'ffmpeg_location': '/opt/homebrew/bin/ffmpeg',
        'quiet': False,
        'no_warnings': False,
        'nocheckcertificate': True,
        'geo_bypass': True,
        # Hiçbir ekstra player_client zorlaması yapmıyoruz, yt-dlp kendi en güncel akıllı seçimiyle yakalasın:
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])

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
            raise HTTPException(status_code=400, detail="Video birleştirilemedi.")

        return FileResponse(
            downloaded_file, 
            media_type="video/mp4", 
            filename=f"video_{quality}p.mp4"
        )

    except Exception as e:
        print(f"HATA DETAYI: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Video işlenemedi: {str(e)}")