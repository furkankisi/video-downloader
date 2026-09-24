import os
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="Instagram İndirici (Sesli ve Kesin Çözüm)")

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
    # Linkin sonundaki çöp takip kodlarını temizler
    if "?" in url:
        return url.split("?")[0]
    return url

@app.post("/get-info")
async def get_info(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        # Sessiz inmesine sebep olan o lanet graphql ayarını sildik.
        # Sadece standart, güvenilir bir tarayıcı kimliği kullanıyoruz:
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_link, download=False)
            return {
                "title": info.get("title") or info.get("description") or "Instagram Videosu",
                "thumbnail": info.get("thumbnail", ""),
            }
    except Exception:
        raise HTTPException(status_code=400, detail="Video bulunamadı. Gizli hesap veya yanlış link olabilir.")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    
    # Uzantıyı zorla mp4 yapmıyoruz, dosyanın kendi orijinal uzantısını alıyoruz
    output_template = f"downloads/{file_id}.%(ext)s"
    
    ydl_opts = {
        'quiet': True,
        # KESİN EMİR: "Bana sadece orijinal MP4 uzantılı dosyayı getir!"
        'format': 'best[ext=mp4]/best', 
        'outtmpl': output_template,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    }
    
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

        return FileResponse(downloaded_file, media_type="video/mp4", filename="ig_video.mp4")
    except Exception as e:
        print("İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="Video indirilemedi.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)