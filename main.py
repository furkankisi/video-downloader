import os
import uuid
import uvicorn
import urllib.request
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="Instagram İndirici (Son Çözüm)")

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
        'quiet': True,
        'skip_download': True, # YT-DLP İNDİRMESİN
        'format': 'best[ext=mp4]', # Sadece hazır MP4 linkini bul
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
    
    try:
        # 1. Aşama: Orijinal MP4 linkini bul
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_link, download=False)
            direct_url = info.get('url')
            
            if not direct_url:
                raise Exception("Direkt link bulunamadı.")
        
        # 2. Aşama: Linkten videoyu güvenle indir
        req = urllib.request.Request(direct_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req) as response, open(final_filepath, 'wb') as out_file:
            out_file.write(response.read())

        # 3. Aşama: MUTLAK KORUMA! (Dosya gerçekten video mu?)
        if os.path.getsize(final_filepath) < 100000:
            os.remove(final_filepath)
            raise Exception("İnen dosya video değil.")
            
        with open(final_filepath, 'rb') as f:
            header = f.read(12)
            # MP4 dosyalarının kalbinde 'ftyp' yazısı bulunmak zorundadır
            if b'ftyp' not in header:
                os.remove(final_filepath)
                raise Exception("Sahte MP4 dosyası engellendi.")

        return FileResponse(final_filepath, media_type="video/mp4", filename="ig_video.mp4")
        
    except Exception as e:
        print("İndirme Hatası:", str(e))
        raise HTTPException(status_code=400, detail="Instagram bu videoyu vermedi.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)