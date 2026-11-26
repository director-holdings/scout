"""수집기 공통: 이미지 내려받기, 색 히스토그램, 일별 기록"""
import hashlib
import io
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

MEDIA = Path(os.environ.get("MEDIA_DIR", "/data/media"))
MEDIA.mkdir(parents=True, exist_ok=True)
KST = timezone(timedelta(hours=9))
UA = {"User-Agent": "ScoutInternal/1.0"}


def today_kst():
    return datetime.now(KST).date()


def _bin(r, g, b):
    """프론트엔드 creative.js의 binOf와 같은 계산 (12 색상 + 3 명도)"""
    mx, mn = max(r, g, b), min(r, g, b)
    light, d = (mx + mn) / 510, mx - mn
    if d < 28:
        return 12 + (0 if light < 0.33 else 1 if light < 0.7 else 2)
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
    return int(h // 30)


def histogram(raw: bytes):
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB").resize((48, 48))
    except Exception:  # noqa: BLE001
        return None
    h = [0.0] * 15
    px = list(im.getdata())
    for r, g, b in px:
        h[_bin(r, g, b)] += 1
    return [round(v / len(px), 4) for v in h]


def save_image(url: str, key: str):
    """이미지를 서버에 저장하고 (경로, 히스토그램) 반환. 실패하면 (None, None)"""
    if not url:
        return None, None
    name = hashlib.sha1(key.encode()).hexdigest()[:16] + ".jpg"
    path = MEDIA / name
    try:
        if path.exists():
            raw = path.read_bytes()
        else:
            r = httpx.get(url, timeout=20, headers=UA, follow_redirects=True)
            r.raise_for_status()
            raw = r.content
            if len(raw) > 8_000_000:
                return None, None
            try:
                from PIL import Image
                im = Image.open(io.BytesIO(raw)).convert("RGB")
                im.thumbnail((800, 1000))
                buf = io.BytesIO()
                im.save(buf, "JPEG", quality=82)
                raw = buf.getvalue()
            except Exception:  # noqa: BLE001
                pass
            path.write_bytes(raw)
        return "/media/" + name, histogram(raw)
    except Exception:  # noqa: BLE001
        return None, None
