import os, uuid
import httpx
import yt_dlp
import imageio_ffmpeg
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

router = APIRouter()
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def get_cookie_path():
    """Render'ın cookies.txt'yi kaçırmaması için her yeri tarayan fonksiyon"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    paths = [
        os.path.join(current_dir, "cookies.txt"),
        os.path.join(os.path.dirname(current_dir), "cookies.txt"),
        "cookies.txt"
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def build_format(quality: str) -> str:
    cap = {"720p": 720, "360p": 360}.get(quality, 1080)
    h = f"[height<={cap}]"
    return (
        f"bv*{h}[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/"
        f"bv*{h}[vcodec^=avc1]+ba/"
        f"b{h}[ext=mp4]/"
        f"bv*{h}+ba/b{h}/b"
    )

def _oembed(url: str) -> dict:
    r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
    r.raise_for_status()
    d = r.json()
    return {"title": d.get("title", "YouTube Videosu"), "thumbnail": d.get("thumbnail_url", "")}

@router.post("/info-youtube")
def info_youtube(request: VideoRequest):
    try:
        return _oembed(request.url)
    except Exception:
        return {"title": "YouTube Videosu", "thumbnail": ""}

@router.post("/download-youtube")
def download_youtube(request: VideoRequest):
    file_id = str(uuid.uuid4())
    os.makedirs("downloads", exist_ok=True)
    final_filepath = f"downloads/{file_id}.mp4"
    
    opts = {
        'quiet': True,
        'no_warnings': True,
        'format': build_format(request.quality),
        'outtmpl': final_filepath,
        'ffmpeg_location': ffmpeg_path,
        # YouTube Bot Koruma Kalkanları:
        'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
    }

    # Çerezi bulup sisteme entegre ediyoruz (Bot engeli burada kırılıyor!)
    cookie_file = get_cookie_path()
    if cookie_file:
        opts['cookiefile'] = cookie_file
        print("✔ Çerez başarıyla bulundu, bot engeli aşılıyor!")
    else:
        print("❌ Uyarı: cookies.txt bulunamadı, engellenebilirsiniz.")

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([request.url])
            
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 30000:
            raise Exception("Dosya bozuk veya bot engeli.")

        # Dosya indirildikten sonra sunucuyu şişirmemesi için silici fonksiyon
        def remove_file():
            try:
                os.remove(final_filepath)
            except:
                pass

        return FileResponse(
            final_filepath, media_type="video/mp4", filename="yt_video.mp4",
            background=BackgroundTask(remove_file)
        )
    except Exception as e:
        print("YouTube İndirme Hatası:", e)
        raise HTTPException(status_code=400, detail="Video indirilemedi, lütfen bağlantıyı kontrol edin.")