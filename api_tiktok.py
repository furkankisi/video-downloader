import httpx
import yt_dlp
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from common import (
    DESKTOP_UA, MIN_FILE_SIZE, extract_url, final_error, find_output,
    friendly_error, new_output_path, remove_files_with_stem, resolve_redirect,
    ydl_attempts,
)

router = APIRouter()

# h264 tercih et (iOS/Android her yerde oynatır), yoksa ne varsa
TT_FORMAT = "b[vcodec^=h264][ext=mp4]/b[vcodec^=avc][ext=mp4]/b[ext=mp4]/b"


class VideoRequest(BaseModel):
    url: str


def _resolve(url: str) -> str:
    return resolve_redirect(url, ("vm.tiktok.com", "vt.tiktok.com", "/t/"))


def _oembed(url: str) -> dict:
    r = httpx.get("https://www.tiktok.com/oembed", params={"url": url}, timeout=10,
                  headers={"User-Agent": DESKTOP_UA})
    r.raise_for_status()
    d = r.json()
    return {"title": d.get("title") or "TikTok Videosu", "thumbnail": d.get("thumbnail_url", "")}


def _tikwm(url: str) -> dict:
    """Yedek: yt-dlp TikTok'ta engellenirse üçüncü parti API (resmi değil, ileride değişebilir)."""
    r = httpx.get("https://www.tikwm.com/api/", params={"url": url, "hd": 1}, timeout=20,
                  headers={"User-Agent": DESKTOP_UA})
    r.raise_for_status()
    j = r.json()
    if j.get("code") != 0 or not j.get("data"):
        raise RuntimeError(j.get("msg") or "tikwm yanıt vermedi")
    return j["data"]


@router.post("/info-tiktok")
def info_tiktok(request: VideoRequest):
    url = _resolve(extract_url(request.url))
    errors = []

    for opts in ydl_attempts():
        try:
            with yt_dlp.YoutubeDL({**opts, "skip_download": True}) as ydl:
                info = ydl.extract_info(url, download=False)
                return {"title": info.get("title") or "TikTok Videosu", "thumbnail": info.get("thumbnail") or ""}
        except Exception as e:
            errors.append(e)
            print("TikTok yt-dlp bilgi hatası:", e)

    try:
        return _oembed(url)
    except Exception as e:
        errors.append(e)
        print("TikTok oEmbed hatası:", e)

    try:
        d = _tikwm(url)
        return {"title": d.get("title") or "TikTok Videosu", "thumbnail": d.get("cover", "")}
    except Exception as e:
        errors.append(e)
        print("TikTok tikwm bilgi hatası:", e)

    raise HTTPException(status_code=400, detail=friendly_error(final_error(errors, "TikTok"), "TikTok"))


@router.post("/download-tiktok")
def download_tiktok(request: VideoRequest):
    url = _resolve(extract_url(request.url))
    out = new_output_path("mp4")
    errors = []

    for opts in ydl_attempts():
        try:
            opts["format"] = TT_FORMAT
            opts["outtmpl"] = str(out.with_suffix("")) + ".%(ext)s"
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            final = find_output(out)
            if final and final.stat().st_size >= MIN_FILE_SIZE:
                return FileResponse(str(final), media_type="video/mp4", filename="tiktok_video.mp4",
                                    background=BackgroundTask(remove_files_with_stem, out))
            raise RuntimeError("Bozuk veya boş dosya indirildi")
        except Exception as e:
            errors.append(e)
            print("TikTok yt-dlp indirme hatası:", e)
            remove_files_with_stem(out)

    try:
        d = _tikwm(url)
        video_url = d.get("hdplay") or d.get("play")
        if not video_url:
            raise RuntimeError("Video adresi bulunamadı")
        if video_url.startswith("/"):
            video_url = "https://www.tikwm.com" + video_url
        with httpx.stream("GET", video_url, headers={"User-Agent": DESKTOP_UA}, follow_redirects=True,
                          timeout=60) as r:
            r.raise_for_status()
            with open(out, "wb") as f:
                for chunk in r.iter_bytes(1024 * 256):
                    f.write(chunk)
        if out.stat().st_size < MIN_FILE_SIZE:
            raise RuntimeError("Bozuk veya boş dosya indirildi")
        return FileResponse(str(out), media_type="video/mp4", filename="tiktok_video.mp4",
                            background=BackgroundTask(remove_files_with_stem, out))
    except Exception as e:
        errors.append(e)
        print("TikTok yedek indirme hatası:", e)
        remove_files_with_stem(out)

    raise HTTPException(status_code=400, detail=friendly_error(final_error(errors, "TikTok"), "TikTok"))