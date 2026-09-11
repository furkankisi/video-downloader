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

def get_platform_opts(url: str, is_info_only: bool = False):
    """Platforma göre yt-dlp ayarlarını akıllıca ayırır"""
    base_opts = {
        'quiet': True,
        'nocheckcertificate': True,
        'geo_bypass': True
    }
    
    if is_info_only:
        base_opts['skip_download'] = True

    if "instagram.com" in url:
        # Instagram için iPhone maskesi (Video boyutu ve QuickTime sorunu için)
        base_opts['user-agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        if not is_info_only:
            base_opts['format'] = 'best[ext=mp4][vcodec^=avc1]/best'
    else:
        # YOUTUBE BOT KORUMASI KESİN BYPASS (Render IP engelini aşmak için Android İstemci Taklidi)
        base_opts['extractor_args'] = {'youtube': ['player_client=android']}
        
        if not is_info_only:
            base_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            base_opts['ffmpeg_location'] = FFMPEG_PATH
            base_opts['merge_output_format'] = 'mp4'
            
    return base_opts

@app.post("/get-info")
async def get_info(request: dict):
    video_url = request.get("url")
    if not video_url:
        raise HTTPException(status_code=400, detail="URL bulunamadı.")
        
    ydl_opts = get_platform_opts(video_url, is_info_only=True)
    
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
        raise HTTPException(status_code=400, detail=f"Video bilgisi alınamadı: {str(e)}")

@app.post("/download-video")
async def download_video(request: dict):
    video_url = request.get("url")
    if not video_url:
        raise HTTPException(status_code=400, detail="URL bulunamadı.")

    file_id = str(uuid.uuid4())
    ydl_opts = get_platform_opts(video_url, is_info_only=False)
    ydl_opts['outtmpl'] = f"downloads/{file_id}.%(ext)s"
    
    os.makedirs("downloads", exist_ok=True)
    
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