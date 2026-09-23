import os
import uuid
import uvicorn
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

# 1. HAMLE: Instagram linklerindeki bozucu uzantıları otomatik kesip atıyoruz
def clean_url(url: str):
    if "instagram.com" in url and "?" in url:
        return url.split("?")[0]
    return url

# 2. HAMLE: Maksimum hız ve Instagram'a yakalanmamak için özel ayarlar
base_ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'nocheckcertificate': True,
    'socket_timeout': 15, # Asla 15 saniyeden fazla askıda kalıp donmaz
    'extractor_args': {'instagram': {'api': ['graphql']}}, # Instagramı hızlı geçmek için
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
}

@app.post("/get-info")
async def get_info(request: VideoRequest):
    clean_link = clean_url(request.url) # Link temizlendi
    
    ydl_opts = base_ydl_opts.copy()
    ydl_opts.update({
        'skip_download': True,
        'extract_flat': True,
    })
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_link, download=False)
            return {
                "title": info.get("title") or info.get("id") or "Instagram Videosu",
                "thumbnail": info.get("thumbnail", ""),
            }
    except Exception as e:
        print("Bilgi Alma Hatası:", e)
        raise HTTPException(status_code=400, detail="Video bulunamadı. Gizli hesap veya yanlış link.")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    clean_link = clean_url(request.url)
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    output_template = f"downloads/{file_id}.%(ext)s"
    
    ydl_opts = base_ydl_opts.copy()
    ydl_opts.update({
        'format': 'best', # Orijinal kalite
        'outtmpl': output_template,
    })
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_link])

        downloaded_file = None
        for file in os.listdir("downloads"):
            if file.startswith(file_id):
                downloaded_file = os.path.join("downloads", file)
                break

        if not downloaded_file or not os.path.exists(downloaded_file):
            raise HTTPException(status_code=400, detail="Dosya oluşturulamadı.")

        return FileResponse(downloaded_file, media_type="video/mp4", filename="video.mp4")
    except Exception as e:
        print("İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="Instagram bu videoyu indirmeyi reddetti.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)