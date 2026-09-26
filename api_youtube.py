import os
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

# Kendi yazdığın common.py dosyasındaki fonksiyonlar
from common import extract_url, new_output_path, remove_files_with_stem

router = APIRouter()

class VideoRequest(BaseModel):
    url: str
    quality: str = "best"

def _oembed(url: str) -> dict:
    """YouTube resmi API'sinden hızlıca başlık ve kapağı çeker (Asla banlanmaz)"""
    try:
        r = httpx.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"}, timeout=10)
        if r.status_code == 200:
            d = r.json()
            return {"title": d.get("title", "YouTube Videosu"), "thumbnail": d.get("thumbnail_url", "")}
    except:
        pass
    return {"title": "YouTube Videosu", "thumbnail": ""}

@router.post("/info-youtube")
def info_youtube(request: VideoRequest):
    url = extract_url(request.url)
    return _oembed(url)

@router.post("/download-youtube")
async def download_youtube(request: VideoRequest):
    url = extract_url(request.url)
    out = new_output_path("mp4")
    final_filepath = str(out.with_suffix(".mp4"))
    
    # API'nin bizi gerçek bir kullanıcı sanması için ZORUNLU kalkanlar
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://cobalt.tools",
        "Referer": "https://cobalt.tools/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    }
    
    # Hem Cobalt v6 hem de v7 ile uyumlu ortak paket
    payload = {
        "url": url,
        "videoQuality": "720", 
        "vQuality": "720",
        "filenamePattern": "basic"
    }
    
    # Biri çökerse saniyesinde diğerine geçecek 4 farklı bağımsız API sunucusu
    instances = [
        "https://co.wuk.sh/api/json",
        "https://api.cobalt.tools/",
        "https://api.cobalt.buss.lol/api/json",
        "https://cobalt.q0.is/api/json"
    ]
    
    download_url = None
    
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            # Yedekli API taraması
            for endpoint in instances:
                try:
                    res = await client.post(endpoint, json=payload, headers=headers)
                    if res.status_code in [200, 202]:
                        data = res.json()
                        # Video linki başarıyla alındıysa döngüyü kır ve indirmeye geç
                        if data.get("status") in ["success", "stream", "redirect"] or "url" in data:
                            download_url = data.get("url")
                            if download_url:
                                print(f"✔ API Bağlantısı Başarılı: {endpoint}")
                                break
                except Exception as e:
                    print(f"❌ {endpoint} yanıt vermedi: {e}")
                    continue
            
            if not download_url:
                raise Exception("Tüm API sunucuları reddetti veya meşgul.")
            
            # API'nin verdiği temiz linkten videoyu RAM'i yormadan sunucuya çekiyoruz
            async with client.stream("GET", download_url, follow_redirects=True) as video_res:
                video_res.raise_for_status()
                with open(final_filepath, "wb") as f:
                    async for chunk in video_res.aiter_bytes(chunk_size=1024 * 1024):
                        f.write(chunk)

        # Dosya sağlam mı diye son kontrol
        if not os.path.exists(final_filepath) or os.path.getsize(final_filepath) < 50000:
            raise Exception("İndirilen video bozuk veya boyutu çok küçük.")

        return FileResponse(
            final_filepath, 
            media_type="video/mp4", 
            filename="yt_video.mp4",
            background=BackgroundTask(remove_files_with_stem, out)
        )

    except Exception as e:
        print("Nihai YouTube Hatası:", e)
        remove_files_with_stem(out)
        raise HTTPException(status_code=400, detail="Sistem yoğunluğu nedeniyle YouTube videosu çekilemedi.")