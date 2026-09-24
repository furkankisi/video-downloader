import os
import uuid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import imageio_ffmpeg

# FFmpeg birleştirici motorunu garantiliyoruz
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

app = FastAPI(title="Instagram İndirici (Hata Avcısı ve Sesli)")

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
        'quiet': False, # HATALARI GİZLEME, TERMİNALDE GÖSTER
        'skip_download': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(clean_link, download=False)
            return {
                "title": info.get("title", "Instagram Videosu"),
                "thumbnail": info.get("thumbnail", ""),
            }
    except Exception as e:
        print("BİLGİ ALMA HATASI:", str(e))
        raise HTTPException(status_code=400, detail="Video bilgisi alınamadı.")

@app.post("/download-video")
async def download_video(request: VideoRequest):
    clean_link = clean_ig_url(request.url)
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    ydl_opts = {
        'quiet': False, # HATALARI GİZLEME, TERMİNALDE GÖSTER
        # Sesli ve en kaliteli versiyonu zorla bulup FFmpeg ile birleştir
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'merge_output_format': 'mp4',
        'ffmpeg_location': ffmpeg_path,
        'outtmpl': final_filepath,
        # Instagram'ın giriş yap duvarını aşmak için graphql API'sini kullan
        'extractor_args': {'instagram': {'api': ['graphql']}},
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_link])

        if not os.path.exists(final_filepath):
            raise Exception("yt-dlp dosyayı indiremedi.")
            
        # İnen dosya 50KB'dan küçükse bu video değildir, HTML hata sayfasıdır
        if os.path.getsize(final_filepath) < 50000:
            os.remove(final_filepath)
            raise Exception("Instagram videoyu engelledi, login sayfası gönderdi.")

        return FileResponse(final_filepath, media_type="video/mp4", filename="ig_video.mp4")
        
    except Exception as e:
        print("İNDİRME HATASI:", str(e))
        raise HTTPException(status_code=400, detail="Video indirilemedi, terminali kontrol et.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)