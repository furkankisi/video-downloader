import httpx
import yt_dlp
import imageio_ffmpeg
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from common import (
    MIN_FILE_SIZE, base_ydl_opts, cleanup_cookiefile, extract_url, find_output,
    friendly_error, new_output_path, remove_files_with_stem, set_youtube_clients,
)

router = APIRouter()

# FFmpeg yolunu otomatik alıyoruz (Render / Sunucu uyumlu)
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

CLIENT_CHAINS = [
    None,                                
    ["android_vr"],
    ["tv_downgraded", "web_embedded"],
]

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

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
    url = extract_url(request.url)

    try:
        return _oembed(url)
    except Exception as e:
        print("YouTube oEmbed başarısız:", e)

    last = None
    for clients in CLIENT_CHAINS:
        opts = base_ydl_opts("youtube")
        opts["ignore_no_formats_error"] = True   
        opts["skip_download"] = True
        set_youtube_clients(opts, clients)
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {"title": info.get("title") or "YouTube Videosu", "thumbnail": info.get("thumbnail") or ""}
        except Exception as e:
            last = e
            print(f"YouTube bilgi hatası ({clients}):", e)
        finally:
            cleanup_cookiefile(opts)
    raise HTTPException(status_code=400, detail=friendly_error(last, "YouTube"))

@router.post("/download-youtube")
def download_youtube(request: VideoRequest):
    url = extract_url(request.url)
    out = new_output_path("mp4")
    fmt = build_format(request.quality)
    last = None

    for clients in CLIENT_CHAINS:
        opts = base_ydl_opts("youtube")
        opts["format"] = fmt
        opts["outtmpl"] = str(out.with_suffix("")) + ".%(ext)s"
        opts["ffmpeg_location"] = ffmpeg_path  # FFmpeg motoru buraya bağlandı!
        set_youtube_clients(opts, clients)
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            final = find_output(out)
            if not final or final.stat().st_size < MIN_FILE_SIZE:
                raise RuntimeError("Bozuk veya boş dosya indirildi")
            return FileResponse(
                str(final), media_type="video/mp4", filename="yt_video.mp4",
                background=BackgroundTask(remove_files_with_stem, out),
            )
        except Exception as e:
            last = e
            print(f"YouTube indirme hatası ({clients}):", e)
            remove_files_with_stem(out)
        finally:
            cleanup_cookiefile(opts)

    raise HTTPException(status_code=400, detail=friendly_error(last, "YouTube"))