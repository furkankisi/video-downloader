import os
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="Instagram İndirici (Kesin Uyumlu)")

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
        # Taktik burada: Instagram'a "Ben bir iPhone'um" diyoruz
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
        raise HTTPException(status_code=400, detail="Video bulunamadı. Gizli hesap veya yanlış link.")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    
    # Her cihazda açılması için uzantıyı SADECE ve kesinlikle mp4 yapıyoruz
    output_template = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': True,
        # SADECE gerçek MP4 formatını kabul ediyoruz, webm vb. gelirse reddediyoruz.
        'format': 'best[ext=mp4]', 
        'outtmpl': output_template,
        'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_link])

        downloaded_file = f"downloads/{file_id}.mp4"

        if not os.path.exists(downloaded_file):
            raise HTTPException(status_code=400, detail="Dosya oluşturulamadı.")

        # Tamamen Apple cihazlarına uyumlu (Mac/iPhone) olarak gönderiyoruz
        return FileResponse(downloaded_file, media_type="video/mp4", filename="ig_video.mp4")
    except Exception as e:
        print("İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="Video indirilemedi.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)