import httpx
import yt_dlp
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from common import (
    MIN_FILE_SIZE, base_ydl_opts, extract_url, find_output, friendly_error,
    new_output_path, remove_files_with_stem, try_impersonate,
)

router = APIRouter()

MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)
# h264 tercih et (iOS/Android her yerde oynatır), yoksa ne varsa
TT_FORMAT = "b[vcodec^=h264][ext=mp4]/b[vcodec^=avc][ext=mp4]/b[ext=mp4]/b"


class VideoRequest(BaseModel):
    url: str


def _resolve(url: str) -> str:
    """vm.tiktok.com / vt.tiktok.com kısa linklerini gerçek linke çevirir."""
    if any(h in url for h in ("vm.tiktok.com", "vt.tiktok.com", "/t/")):
        try:
            r = httpx.get(url, headers={"User-Agent": MOBILE_UA}, follow_redirects=True, timeout=12)
            return str(r.url).split("?")[0]
        except Exception as e:
            print("TikTok kısa link çözülemedi:", e)
    return url


def _ydl_attempts():
    """
    Sırayla denenecek yt-dlp ayarları.
    ÖNEMLİ: Özel mobil User-Agent + Referer göndermek TikTok'un video verisi boş bir sayfa
    döndürmesine ("Video not available, status code 0") yol açıyordu. /debug'da hiçbir özel
    başlık olmadan video çalıştı, bu yüzden ilk deneme SADE ayarlarla yapılıyor.
    """
    yield base_ydl_opts("tiktok")                 # 1) sade (debug'da çalışan hal)
    yield try_impersonate(base_ydl_opts("tiktok"))  # 2) Chrome taklidiyle (UA'ya dokunmadan)


def _short(e: Exception) -> str:
    return str(e).replace("ERROR: ", "").splitlines()[0][:160]


def _final_error(errors) -> HTTPException:
    msg = friendly_error(errors[0], "TikTok")
    if len(errors) > 1:
        msg += " | yedek: " + _short(errors[-1])
    return HTTPException(status_code=400, detail=msg)


def _oembed(url: str) -> dict:
    r = httpx.get("https://www.tiktok.com/oembed", params={"url": url}, timeout=10,
                  headers={"User-Agent": MOBILE_UA})
    r.raise_for_status()
    d = r.json()
    return {"title": d.get("title") or "TikTok Videosu", "thumbnail": d.get("thumbnail_url", "")}


def _tikwm(url: str) -> dict:
    """Yedek: yt-dlp TikTok'ta engellenirse üçüncü parti API (resmi değil, ileride değişebilir)."""
    r = httpx.get("https://www.tikwm.com/api/", params={"url": url, "hd": 1}, timeout=20,
                  headers={"User-Agent": MOBILE_UA})
    r.raise_for_status()
    j = r.json()
    if j.get("code") != 0 or not j.get("data"):
        raise RuntimeError(j.get("msg") or "tikwm yanıt vermedi")
    return j["data"]


@router.post("/info-tiktok")
def info_tiktok(request: VideoRequest):
    url = _resolve(extract_url(request.url))
    errors = []

    for opts in _ydl_attempts():
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

    raise _final_error(errors)


@router.post("/download-tiktok")
def download_tiktok(request: VideoRequest):
    url = _resolve(extract_url(request.url))
    out = new_output_path("mp4")
    errors = []

    # 1) yt-dlp (sade -> Chrome taklidi)
    for opts in _ydl_attempts():
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

    # 2) Yedek API
    try:
        d = _tikwm(url)
        video_url = d.get("hdplay") or d.get("play")
        if not video_url:
            raise RuntimeError("Video adresi bulunamadı")
        if video_url.startswith("/"):
            video_url = "https://www.tikwm.com" + video_url
        with httpx.stream("GET", video_url, headers={"User-Agent": MOBILE_UA}, follow_redirects=True,
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

    raise _final_error(errors)