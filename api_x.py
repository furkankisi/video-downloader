import re

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

STATUS_ID_RE = re.compile(r"/status(?:es)?/(\d+)")


class VideoRequest(BaseModel):
    url: str


def _resolve(url: str) -> str:
    # X paylaşım metinlerinde bazen t.co kısa linki gelir
    return resolve_redirect(url, ("t.co/",))


def _status_id(url: str) -> str:
    m = STATUS_ID_RE.search(url)
    if not m:
        raise HTTPException(status_code=400, detail="Bu bir X (Twitter) gönderi linki değil.")
    return m.group(1)


def _fx(status_id: str) -> dict:
    """
    FixTweet'in genel API'si (api.fxtwitter.com). Kullanıcı adı doğrulanmıyor, sadece ID önemli.
    Kaynak: https://github.com/FixTweet/FixTweet/wiki/Status-Fetch-API
    """
    r = httpx.get(f"https://api.fxtwitter.com/i/status/{status_id}", timeout=12,
                  headers={"User-Agent": DESKTOP_UA})
    r.raise_for_status()
    j = r.json()
    tweet = j.get("tweet")
    if not tweet:
        raise RuntimeError(j.get("message") or "fxtwitter yanıt vermedi")
    return tweet


def _vx(status_id: str) -> dict:
    """Yedek: vxtwitter (BetterTwitFix). Aynı şekilde kullanıcı adı önemsiz."""
    r = httpx.get(f"https://api.vxtwitter.com/i/status/{status_id}", timeout=12,
                  headers={"User-Agent": DESKTOP_UA})
    r.raise_for_status()
    j = r.json()
    if not j.get("mediaURLs"):
        raise RuntimeError(j.get("error") or "vxtwitter yanıt vermedi")
    return j


def _fx_best_video(tweet: dict):
    videos = ((tweet.get("media") or {}).get("videos")) or []
    if not videos:
        return None
    return max(videos, key=lambda v: v.get("bitrate") or 0)


def _title_from_fx(tweet: dict) -> str:
    author = (tweet.get("author") or {}).get("name") or "X"
    text = (tweet.get("text") or "").strip().splitlines()[0] if tweet.get("text") else ""
    title = f"{author} - {text}" if text else f"{author} - X Videosu"
    return title[:120]


def _thumbnail_from_fx(tweet: dict) -> str:
    video = _fx_best_video(tweet)
    if video and video.get("thumbnail_url"):
        return video["thumbnail_url"]
    photos = ((tweet.get("media") or {}).get("photos")) or []
    return photos[0]["url"] if photos else ""


@router.post("/info-x")
def info_x(request: VideoRequest):
    url = _resolve(extract_url(request.url))
    status_id = _status_id(url)
    errors = []

    # 1) yt-dlp (native Twitter/X extractor)
    for opts in ydl_attempts():
        try:
            with yt_dlp.YoutubeDL({**opts, "skip_download": True}) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info.get("formats") and info.get("_type") != "video":
                    raise RuntimeError("Bu gönderide video yok")
                return {"title": info.get("title") or "X Videosu", "thumbnail": info.get("thumbnail") or ""}
        except Exception as e:
            errors.append(e)
            print("X yt-dlp bilgi hatası:", e)

    # 2) fxtwitter
    try:
        tweet = _fx(status_id)
        if not _fx_best_video(tweet):
            raise HTTPException(status_code=400, detail="Bu gönderide indirilebilir bir video bulunamadı.")
        return {"title": _title_from_fx(tweet), "thumbnail": _thumbnail_from_fx(tweet)}
    except HTTPException:
        raise
    except Exception as e:
        errors.append(e)
        print("X fxtwitter bilgi hatası:", e)

    # 3) vxtwitter
    try:
        d = _vx(status_id)
        return {"title": "X Videosu", "thumbnail": d.get("media_extended", [{}])[0].get("thumbnail_url", "")}
    except Exception as e:
        errors.append(e)
        print("X vxtwitter bilgi hatası:", e)

    raise HTTPException(status_code=400, detail=friendly_error(final_error(errors, "X"), "X"))


@router.post("/download-x")
def download_x(request: VideoRequest):
    url = _resolve(extract_url(request.url))
    status_id = _status_id(url)
    out = new_output_path("mp4")
    errors = []

    # 1) yt-dlp
    for opts in ydl_attempts():
        try:
            opts["format"] = "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b"
            opts["outtmpl"] = str(out.with_suffix("")) + ".%(ext)s"
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            final = find_output(out)
            if final and final.stat().st_size >= MIN_FILE_SIZE:
                return FileResponse(str(final), media_type="video/mp4", filename="x_video.mp4",
                                    background=BackgroundTask(remove_files_with_stem, out))
            raise RuntimeError("Bozuk veya boş dosya indirildi")
        except Exception as e:
            errors.append(e)
            print("X yt-dlp indirme hatası:", e)
            remove_files_with_stem(out)

    # 2) fxtwitter / vxtwitter -> doğrudan mp4 adresini indir
    video_url = None
    try:
        tweet = _fx(status_id)
        video = _fx_best_video(tweet)
        if not video:
            raise HTTPException(status_code=400, detail="Bu gönderide indirilebilir bir video bulunamadı.")
        video_url = video["url"]
    except HTTPException:
        raise
    except Exception as e:
        errors.append(e)
        print("X fxtwitter hatası:", e)
        try:
            d = _vx(status_id)
            video_url = d["mediaURLs"][0]
        except Exception as e2:
            errors.append(e2)
            print("X vxtwitter hatası:", e2)

    if video_url:
        try:
            with httpx.stream("GET", video_url, headers={"User-Agent": DESKTOP_UA}, follow_redirects=True,
                              timeout=60) as r:
                r.raise_for_status()
                with open(out, "wb") as f:
                    for chunk in r.iter_bytes(1024 * 256):
                        f.write(chunk)
            if out.stat().st_size < MIN_FILE_SIZE:
                raise RuntimeError("Bozuk veya boş dosya indirildi")
            return FileResponse(str(out), media_type="video/mp4", filename="x_video.mp4",
                                background=BackgroundTask(remove_files_with_stem, out))
        except Exception as e:
            errors.append(e)
            print("X doğrudan indirme hatası:", e)
            remove_files_with_stem(out)

    raise HTTPException(status_code=400, detail=friendly_error(final_error(errors, "X"), "X"))