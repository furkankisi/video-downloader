import yt_dlp
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from common import (
    MIN_FILE_SIZE, VIDEO_FORMAT, ensure_h264, extract_url, final_error, find_output,
    friendly_error, new_output_path, remove_files_with_stem, ydl_attempts,
)

router = APIRouter()


class VideoRequest(BaseModel):
    url: str


# ÖNEMLİ: bu iki endpoint önceden 'async def' idi ve içeride yt-dlp'nin senkron (bloklayan)
# fonksiyonlarını çağırıyordu. Bu, bir Instagram isteği işlenirken sunucunun TikTok/X gibi
# diğer tüm isteklere de aynı anda cevap veremediği anlamına geliyordu. 'def' (senkron) yapınca
# FastAPI bunu otomatik olarak ayrı bir thread'de çalıştırıyor, sunucu kilitlenmiyor.

@router.post("/info-instagram")
def info_instagram(request: VideoRequest):
    url = extract_url(request.url)
    errors = []
    for opts in ydl_attempts():
        try:
            with yt_dlp.YoutubeDL({**opts, "skip_download": True}) as ydl:
                info = ydl.extract_info(url, download=False)
                return {"title": info.get("title") or "Instagram Videosu", "thumbnail": info.get("thumbnail") or ""}
        except Exception as e:
            errors.append(e)
            print("Instagram bilgi hatası:", e)
    raise HTTPException(status_code=400, detail=friendly_error(final_error(errors, "Instagram"), "Instagram"))


def _download_core(link: str) -> FileResponse:
    url = extract_url(link)
    out = new_output_path("mp4")
    errors = []
    for opts in ydl_attempts():
        try:
            opts["format"] = VIDEO_FORMAT
            opts["outtmpl"] = str(out.with_suffix("")) + ".%(ext)s"
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            final = find_output(out)
            if final and final.stat().st_size >= MIN_FILE_SIZE:
                final = ensure_h264(final)
                return FileResponse(str(final), media_type="video/mp4", filename="ig_video.mp4",
                                    background=BackgroundTask(remove_files_with_stem, out))
            raise RuntimeError("Bozuk veya boş dosya indirildi")
        except Exception as e:
            errors.append(e)
            print("Instagram indirme hatası:", e)
            remove_files_with_stem(out)
    raise HTTPException(status_code=400, detail=friendly_error(final_error(errors, "Instagram"), "Instagram"))


@router.post("/download-instagram")
def download_instagram(request: VideoRequest):
    return _download_core(request.url)


@router.get("/download-instagram")
def download_instagram_get(url: str = Query(...)):
    # Mobil uygulama FileSystem.downloadAsync ile POST body gönderemiyor, o yüzden bu GET
    # adresini kullanıyor.
    return _download_core(url)