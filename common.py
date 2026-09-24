"""Ortak yardımcılar: yt-dlp ayarları, çerez/proxy, geçici dosya temizliği, hata metinleri."""
import base64
import os
import re
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "downloads"))
MIN_FILE_SIZE = 30_000          # bundan küçük dosya = bozuk
MAX_FILE_AGE_SECONDS = 60 * 60  # 1 saatten eski geçici dosyalar silinir

URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


# --------------------------------------------------------------------------- #
# URL
# --------------------------------------------------------------------------- #
def extract_url(text: str) -> str:
    """'Şu videoya bak https://vm.tiktok.com/xyz/ #fyp' gibi paylaşım metninden linki çeker."""
    text = (text or "").strip()
    m = URL_RE.search(text)
    return m.group(0).rstrip(").,;") if m else text


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


def _cookie_source(env_b64: str, env_path: str) -> Optional[str]:
    """Çerezi ORTAMDAN al (repoya asla commit etme). Base64 env veya dosya yolu."""
    b64 = os.getenv(env_b64) or os.getenv("COOKIES_B64")
    if b64:
        try:
            fd, tmp = tempfile.mkstemp(suffix=".txt")
            with os.fdopen(fd, "wb") as f:
                f.write(base64.b64decode(b64))
            return tmp
        except Exception as e:
            print("Çerez çözülemedi:", e)
            return None
    src = os.getenv(env_path) or os.getenv("COOKIES_FILE")
    if src and os.path.exists(src):
        # yt-dlp cookie dosyasına geri yazar; Render'daki salt-okunur secret file'da hata olmasın diye kopyala
        fd, tmp = tempfile.mkstemp(suffix=".txt")
        os.close(fd)
        shutil.copyfile(src, tmp)
        return tmp
    return None


def base_ydl_opts(platform: str = "") -> dict:
    """
    Tüm platformlar için ortak yt-dlp ayarları.
    Ortam değişkenleri:
      PROXY_URL           -> http://user:pass@host:port  (datacenter IP engelini aşmak için)
      YT_COOKIES_B64      -> base64(cookies.txt)   (sadece YouTube)
      YT_COOKIES_FILE     -> cookies.txt yolu      (sadece YouTube)
    """
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 25,
        "retries": 3,
        "fragment_retries": 3,
        "nocheckcertificate": False,
        # YouTube imza/n-challenge çözümü için JS runtime gerekir (deno pip paketiyle gelir, node da olur)
        "js_runtimes": {"deno": {}, "node": {}},
        "merge_output_format": "mp4",
    }
    ff = ffmpeg_path()
    if ff:
        opts["ffmpeg_location"] = ff
    proxy = os.getenv("PROXY_URL")
    if proxy:
        opts["proxy"] = proxy
    if platform == "youtube":
        ck = _cookie_source("YT_COOKIES_B64", "YT_COOKIES_FILE")
        if ck:
            opts["cookiefile"] = ck
        home = pot_server_home()
        if home:
            # PO Token üretici (bgutil, script modu). Client listesi ayrı 'youtube' anahtarında verilir.
            opts["extractor_args"] = {"youtubepot-bgutilscript": {"server_home": [home]}}
    return opts


def pot_server_home() -> Optional[str]:
    """build_pot.sh ile kurulan bgutil sağlayıcısının yolu (yoksa None)."""
    candidates = [
        os.getenv("BGUTIL_HOME"),
        str(Path(__file__).resolve().parent / "bgutil-ytdlp-pot-provider" / "server"),
    ]
    for c in candidates:
        if c and (Path(c) / "build" / "generate_once.js").exists():
            return c
    return None


def set_youtube_clients(opts: dict, clients) -> None:
    """player_client'ı, PO Token ayarlarını ezmeden ekle."""
    if clients:
        opts.setdefault("extractor_args", {})["youtube"] = {"player_client": clients}


def try_impersonate(opts: dict) -> dict:
    """curl_cffi kuruluysa TikTok'un TLS parmak izi kontrolünü geçmek için tarayıcı taklidi yap."""
    try:
        import curl_cffi  # noqa: F401
        from yt_dlp.networking.impersonate import ImpersonateTarget
        opts["impersonate"] = ImpersonateTarget("chrome")
    except Exception:
        pass
    return opts


def cleanup_cookiefile(opts: dict) -> None:
    ck = opts.get("cookiefile")
    if ck and ck.startswith(tempfile.gettempdir()):
        try:
            os.unlink(ck)
        except OSError:
            pass


# --------------------------------------------------------------------------- #
# Hata mesajları
# --------------------------------------------------------------------------- #
def friendly_error(e: Exception, platform: str) -> str:
    raw = ANSI_RE.sub("", str(e))
    low = raw.lower()
    if "sign in to confirm" in low or "not a bot" in low:
        return ("YouTube bu sunucunun IP'sini bot olarak işaretledi. Sunucuya PROXY_URL "
                "veya YT_COOKIES_B64 ortam değişkeni eklemek gerekiyor.")
    if "po token" in low or "po_token" in low:
        return "YouTube bu istemci için PO Token istiyor; yt-dlp'yi güncelleyip yeniden deploy edin."
    if "requested format is not available" in low:
        return "İstenen kalite bulunamadı (ffmpeg/JS runtime eksik olabilir)."
    if "private" in low or "login required" in low or "log in" in low:
        return "Video özel veya giriş gerektiriyor."
    if "unavailable" in low or "removed" in low or "not exist" in low:
        return "Video bulunamadı veya kaldırılmış."
    if "403" in low or "forbidden" in low or "blocked" in low:
        return f"{platform} sunucuyu engelledi (403). Proxy veya farklı IP gerekebilir."
    if "timed out" in low or "timeout" in low:
        return "Bağlantı zaman aşımına uğradı, tekrar deneyin."
    short = raw.replace("ERROR: ", "").strip().splitlines()[0] if raw.strip() else "Bilinmeyen hata"
    return f"{platform} hatası: {short[:200]}"