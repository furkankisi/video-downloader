import httpx
import yt_dlp
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from common import (
    MIN_FILE_SIZE, base_ydl_opts, cleanup_cookiefile, extract_url, find_output,
    friendly_error, new_output_path, remove_files_with_stem,
)

router = APIRouter()

# ÖNEMLİ: player_client'ı elle 'web_creator','mweb','web' yapmak YouTube'u bozuyordu; bu istemciler
# PO Token olmadan akış URL'i veremiyor. Varsayılanı (yt-dlp'nin kendi seçimi) kullanıyoruz,
# olmazsa sırayla alternatif istemcileri deniyoruz.
CLIENT_CHAINS = [
    None,                                # yt-dlp varsayılanı (şu an: visionos, web)
    ["android_vr"],
    ["tv_downgraded", "web_embedded"],
]


class VideoRequest(BaseModel):
    url: str
    quality: str = "best"


def build_format(quality: str) -> str:
    """Tek dosya (progressive) YouTube'da artık neredeyse yok; video+ses ayrı indirilip ffmpeg ile birleşir."""
    cap = {"720p": 720, "360p": 360}.get(quality, 1080)  # 'best' = 1080p (sunucu RAM/disk koruması)
    h = f"[height<={cap}]"
    return (
        f"bv*{h}[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/"
        f"bv*{h}[vcodec^=avc1]+ba/"
        f"b{h}[ext=mp4]/"
        f"bv*{h}+ba/b{h}/b"
    )


def _oembed(url: str) -> dict:
    """Bot kontrolüne takılmayan hafif önizleme (başlık + kapak)."""
    r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
    r.raise_for_status()
    d = r.json()
    return {"title": d.get("title", "YouTube Videosu"), "thumbnail": d.get("thumbnail_url", "")}


@router.post("/info-youtube")
def info_youtube(request: VideoRequest):
    url = extract_url(request.url)

    # 1) Hızlı ve engellenmeyen yol
    try:
        return _oembed(url)
    except Exception as e:
        print("YouTube oEmbed başarısız:", e)

    # 2) yt-dlp ile dene
    last = None
    for clients in CLIENT_CHAINS:
        opts = base_ydl_opts("youtube")
        opts["ignore_no_formats_error"] = True   # sadece başlık/kapak lazım, format hatası önemsiz
        opts["skip_download"] = True
        if clients:
            opts["extractor_args"] = {"youtube": {"player_client": clients}}
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
        if clients:
            opts["extractor_args"] = {"youtube": {"player_client": clients}}
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