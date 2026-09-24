import os
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import imageio_ffmpeg

# Arka plandaki dönüştürücü motorumuz
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

app = FastAPI(title="Instagram İndirici (Kesin Apple Uyumlu)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_link, download=False)
            return {
                "title": info.get("title", "Instagram Videosu"),
                "thumbnail": info.get("thumbnail", ""),
            }
    except Exception:
        raise HTTPException(status_code=400, detail="Video bulunamadı.")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    
    # yt-dlp'nin dosyayı işlerken kullanacağı geçici isim
    out_template = f"downloads/{file_id}.%(ext)s"
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': False, # Hataları görebilmek için açık bıraktık
        'format': 'bestvideo+bestaudio/best', # En iyi görüntü ve sesi al
        'merge_output_format': 'mp4', # MP4 kılıfına sok
        'outtmpl': out_template,
        'ffmpeg_location': ffmpeg_path, # Motoru bağla
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }],
        # İŞTE MAC'TE SES OLARAK AÇILMASINI ENGELLEYEN O SİHİRLİ KOD:
        # "Video kodeğini zorla Apple'ın H.264'ü yap, Sesi de AAC yap"
        'postprocessor_args': [
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-strict', 'experimental'
        ],
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_link])

        if not os.path.exists(final_filepath):
            raise HTTPException(status_code=400, detail="Dönüştürme başarısız oldu.")

        return FileResponse(final_filepath, media_type="video/mp4", filename="ig_video.mp4")
        
    except Exception as e:
        print("İndirme Hatası:", str(e))
        raise HTTPException(status_code=400, detail="Video indirilemedi.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)