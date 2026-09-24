import os
import uuid
import uvicorn
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import imageio_ffmpeg

# Evrensel dönüştürücü motorun yolu
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

app = FastAPI(title="Instagram İndirici (Kesin Çözüm)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoRequest(BaseModel):
    url: str

def clean_ig_url(url: str):
    if "?" in url:
        return url.split("?")[0]
    return url

@app.post("/get-info")
async def get_info(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_link, download=False)
            return {
                "title": info.get("title") or info.get("description") or "Instagram Videosu",
                "thumbnail": info.get("thumbnail", ""),
            }
    except Exception:
        raise HTTPException(status_code=400, detail="Video bulunamadı.")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    
    # 1. Aşama: Instagram'ın verdiği orijinal dosyayı olduğu gibi (raw) indiriyoruz
    raw_output = f"downloads/{file_id}_raw.%(ext)s"
    
    ydl_opts = {
        'quiet': True,
        'format': 'best',
        'outtmpl': raw_output,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(clean_link, download=True)
            downloaded_ext = info_dict.get('ext', 'mp4')
            
        raw_filepath = f"downloads/{file_id}_raw.{downloaded_ext}"
        final_filepath = f"downloads/{file_id}_final.mp4"
        
        # 2. Aşama: MUTLAK ÇÖZÜM - FFmpeg ile dosyayı zorla Mac/iPhone uyumlu (H.264/AAC) yapıyoruz
        command = [
            ffmpeg_path,
            "-y",               # Üzerine yazma izni
            "-i", raw_filepath, # İnen orijinal dosya
            "-c:v", "libx264",  # Mac'in istediği Video Kodeği (H.264)
            "-c:a", "aac",      # Mac'in istediği Ses Kodeği (AAC)
            "-preset", "fast",  # Dönüştürmeyi hızlandır
            final_filepath      # Çıktı dosyası
        ]
        
        # Dönüştürme işlemini başlat
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # 3. Aşama: Çevrilen ve %100 Apple uyumlu olan dosyayı kullanıcıya gönder
        if os.path.exists(final_filepath):
            return FileResponse(final_filepath, media_type="video/mp4", filename="ig_video.mp4")
        else:
            raise Exception("Çevirme işlemi başarısız.")
            
    except Exception as e:
        print("İndirme/Çevirme Hatası:", e)
        raise HTTPException(status_code=400, detail="Video indirilemedi veya dönüştürülemedi.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)