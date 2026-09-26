"""Ortak yardımcılar: yt-dlp ayarları, geçici dosya temizliği, hata metinleri."""
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Optional

DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "downloads"))
MIN_FILE_SIZE = 30_000          # bundan küçük dosya = bozuk
MAX_FILE_AGE_SECONDS = 60 * 60  # 1 saatten eski geçici dosyalar silinir

URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")

DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"


# --------------------------------------------------------------------------- #
# URL
# --------------------------------------------------------------------------- #
def extract_url(text: str) -> str:
    """'Şu videoya bak https://vm.tiktok.com/xyz/ #fyp' gibi paylaşım metninden linki çeker."""
    text = (text or "").strip()
    m = URL_RE.search(text)
    return m.group(0).rstrip(").,;") if m else text


def resolve_redirect(url: str, hosts: tuple) -> str:
    """Kısa/yönlendirme linklerini (vm.tiktok.com, t.co, ...) gerçek adrese çevirir."""
    if any(h in url for h in hosts):
        try:
            import httpx
            r = httpx.get(url, headers={"User-Agent": DESKTOP_UA}, follow_redirects=True, timeout=12)
            return str(r.url).split("?")[0]
        except Exception as e:
            print("Yönlendirme çözülemedi:", e)
    return url


# --------------------------------------------------------------------------- #
# Dosya işlemleri
# --------------------------------------------------------------------------- #
def new_output_path(ext: str = "mp4") -> Path:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return DOWNLOAD_DIR / f"{uuid.uuid4()}.{ext}"


def remove_files_with_stem(path: Path) -> None:
    """video.mp4 + yt-dlp'nin bıraktığı .part/.f137.mp4/.webm gibi artıkları siler."""
    try:
        for p in path.parent.glob(f"{path.stem}*"):
            try:
                p.unlink()
            except OSError:
                pass
    except Exception:
        pass


def cleanup_old_files() -> None:
    if not DOWNLOAD_DIR.exists():
        return
    limit = time.time() - MAX_FILE_AGE_SECONDS
    for p in DOWNLOAD_DIR.iterdir():
        try:
            if p.is_file() and p.stat().st_mtime < limit:
                p.unlink()
        except OSError:
            pass


def find_output(path: Path) -> Optional[Path]:
    """yt-dlp bazen uzantıyı değiştirir (mkv/webm). Gerçek çıktı dosyasını bul."""
    if path.exists():
        return path
    for p in sorted(path.parent.glob(f"{path.stem}.*")):
        if p.suffix not in (".part", ".ytdl", ".json"):
            return p
    return None


# --------------------------------------------------------------------------- #
# yt-dlp ortak ayarlar
# --------------------------------------------------------------------------- #
def ffmpeg_path() -> Optional[str]:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def base_ydl_opts() -> dict:
    """
    Tüm platformlar için ortak yt-dlp ayarları.
    Ortam değişkeni:
      PROXY_URL -> http://user:pass@host:port  (bir platform IP'yi engellerse)
    """
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 25,
        "retries": 3,
        "fragment_retries": 3,
        "http_headers": {"User-Agent": DESKTOP_UA},
        "merge_output_format": "mp4",
    }
    ff = ffmpeg_path()
    if ff:
        opts["ffmpeg_location"] = ff
    proxy = os.getenv("PROXY_URL")
    if proxy:
        opts["proxy"] = proxy
    return opts


def try_impersonate(opts: dict) -> dict:
    """curl_cffi kuruluysa TLS parmak izi kontrollerini geçmek için tarayıcı taklidi yap."""
    try:
        import curl_cffi  # noqa: F401
        from yt_dlp.networking.impersonate import ImpersonateTarget
        opts = dict(opts)
        opts["impersonate"] = ImpersonateTarget("chrome")
    except Exception:
        pass
    return opts


def ydl_attempts() -> list:
    """Sırayla denenecek yt-dlp ayarları: önce sade, olmazsa Chrome taklidiyle."""
    return [base_ydl_opts(), try_impersonate(base_ydl_opts())]


# --------------------------------------------------------------------------- #
# Hata mesajları
# --------------------------------------------------------------------------- #
def short_error(e: Exception) -> str:
    raw = ANSI_RE.sub("", str(e)).replace("ERROR: ", "").strip()
    return raw.splitlines()[0][:160] if raw else "Bilinmeyen hata"


def friendly_error(e: Exception, platform: str) -> str:
    raw = ANSI_RE.sub("", str(e))
    low = raw.lower()
    if "private" in low or "login required" in low or "log in" in low or "giriş" in low:
        return "İçerik özel veya giriş gerektiriyor, bu yüzden indirilemiyor."
    if "unavailable" in low or "removed" in low or "not exist" in low or "not available" in low:
        return "İçerik bulunamadı, silinmiş veya kaldırılmış olabilir."
    if "no video" in low or "no media" in low or "sadece" in low:
        return "Bu gönderide indirilebilir bir video bulunamadı."
    if "403" in low or "forbidden" in low or "blocked" in low:
        return f"{platform} bu isteği engelledi (403). Biraz sonra tekrar deneyin."
    if "timed out" in low or "timeout" in low:
        return "Bağlantı zaman aşımına uğradı, tekrar deneyin."
    if "429" in low or "rate" in low and "limit" in low:
        return f"{platform} çok fazla istek nedeniyle geçici olarak sınırladı, biraz sonra tekrar deneyin."
    return f"{platform} hatası: {short_error(e)}"


def final_error(errors: list, platform: str) -> Exception:
    """Birden çok denemenin en açıklayıcı hatasını seçer."""
    return errors[0] if errors else RuntimeError("Bilinmeyen hata")