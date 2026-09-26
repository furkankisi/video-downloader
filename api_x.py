import os
import yt_dlp
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask
from common import base_ydl_opts, extract_url, new_output_path, remove_files_with_stem

router = APIRouter()

class XRequest(BaseModel):
    url: str

def clean_x_url(raw_url: str) -> str:
    url = extract_url(raw_url)
    # X/Twitter linklerindeki ?s=20 gibi gereksiz parametreleri temizle
    if "?" in url:
        url = url.split("?")[0]
    return url

@router.post("/info-x")
def info_x(request: XRequest):
    url = clean_x_url(request.url)
    opts = base_ydl_opts("twitter")
    opts["skip_download"] = True
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get("title") or info.get("description") or "X Videosu",
                "thumbnail": info.get("thumbnail", "")
            }
    except Exception as e:
        print("X Info Hatası:", e)
        return {"title": "X Videosu", "thumbnail": ""}

@router.post("/download-x")
async def download_x(request: XRequest):
    url = clean_x_url(request.url)
    out = new_output_path("mp4")
    final_filepath = str(out.with_suffix(".mp4"))

    opts = base_ydl_opts("twitter")
    opts["outtmpl"] = str(out.with_suffix(""))
    opts["format"] = "best[ext=mp4]/best"

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])

        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 10000:
            raise Exception("İndirilen dosya boyutu çok küçük veya bulunamadı.")

        return FileResponse(
            final_filepath, 
            media_type="video/mp4", 
            filename="x_video.mp4",
            background=BackgroundTask(remove_files_with_stem, out)
        )
    except Exception as e:
        print("X İndirme Hatası:", e)
        remove_files_with_stem(out)
        raise HTTPException(status_code=400, detail="X videosu indirilemedi.")