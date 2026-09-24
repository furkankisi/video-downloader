import os
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="Instagram İndirici (Net Çözüm)")

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
        # Yeniden Masaüstü kimliğine geçtik (Parçalı mobil yayınlardan kaçmak için)
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
        raise HTTPException(status_code=400, detail="Video bulunamadı. Gizli hesap veya yanlış link.")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    
    output_template = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': True,
        # ANAHTAR NOKTA: protocol=https
        # FFmpeg gerektiren parçalı m3u8 yayınlarını kesinlikle reddediyoruz.
        # Sadece doğrudan indirilebilir, kendinden sesli orijinal MP4 dosyasını alıyoruz.
        'format': 'best[ext=mp4][protocol=https]',
        'outtmpl': output_template,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_link])

        downloaded_file = f"downloads/{file_id}.mp4"

        # GÜVENLİK KONTROLÜ: İnen dosya 50KB'dan küçükse (bozuk/sahte dosyaysa) iptal et
        if not os.path.exists(downloaded_file) or os.path.getsize(downloaded_file) < 50000:
            raise HTTPException(status_code=400, detail="Geçersiz dosya. Instagram bu videoyu engelledi.")

        return FileResponse(downloaded_file, media_type="video/mp4", filename="ig_video.mp4")
    except Exception as e:
        print("İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="Video indirilemedi.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)