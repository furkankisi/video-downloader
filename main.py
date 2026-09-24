import os
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="Instagram İndirici (Akıllı Sıralama)")

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
    
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': False, 
        'format': 'best[ext=mp4]/best', 
        # İŞTE BÜTÜN SORUNLARI ÇÖZEN YENİ SİHİRLİ KOD:
        # "Yasaklamak" yerine "Tercih Et" diyoruz. 
        # yt-dlp'ye Mac'in sevdiği H.264 (avc1) ve AAC formatlarını en başa almasını söylüyoruz.
        'format_sort': ['vcodec:h264', 'vcodec:avc1', 'acodec:aac'],
        'outtmpl': final_filepath,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_link])

        # Çok kısa (1-2 saniyelik) videoları engellememek için güvenlik barajını 30KB'a düşürdük
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            if os.path.exists(final_filepath):
                os.remove(final_filepath)
            raise HTTPException(status_code=400, detail="Video indirilemedi veya engellendi.")

        return FileResponse(final_filepath, media_type="video/mp4", filename="ig_video.mp4")
        
    except Exception as e:
        print("İndirme Hatası:", str(e))
        raise HTTPException(status_code=400, detail="Video indirilemedi.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)