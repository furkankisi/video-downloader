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
    allow_origins=["https://video-downloader-ten-theta.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Video Downloader API Instagram ve TikTok için aktif kanka!"}

@app.post("/get-info")
async def get_info(request: dict):
    video_url = request.get("url")
    if not video_url:
        raise HTTPException(status_code=400, detail="URL bulunamadı.")
        
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'nocheckcertificate': True,
        'geo_bypass': True,
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
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
        print(f"BİLGİ HATASI: {str(e)}") 
        raise HTTPException(status_code=400, detail="Video bilgisi alınamadı, linki kontrol et.")

@app.post("/download-video")
async def download_video(request: dict):
    video_url = request.get("url")
    if not video_url:
        raise HTTPException(status_code=400, detail="URL bulunamadı.")

    file_id = str(uuid.uuid4())
    output_template = f"downloads/{file_id}.%(ext)s"
    os.makedirs("downloads", exist_ok=True)
    
    # Instagram ve TikTok için uyumlu, küçük boyutlu, QuickTime dostu format
    ydl_opts = {
        'format': 'best[ext=mp4][vcodec^=avc1]/best',
        'outtmpl': output_template,
        'quiet': False,
        'nocheckcertificate': True,
        'geo_bypass': True,
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
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

        return FileResponse(downloaded_file, media_type="video/mp4", filename="video.mp4")

    except Exception as e:
        print(f"İNDİRME HATASI: {str(e)}")
        raise HTTPException(status_code=400, detail="Video işlenemedi.")