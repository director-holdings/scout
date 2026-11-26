"""팀 공용 비밀번호 로그인 (내부용). 쿠키에 서명된 이름을 저장한다."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import HTTPException, Request

from .db import get_setting, set_setting

COOKIE = "scout_session"
MAX_AGE = 60 * 60 * 24 * 30  # 30일


def secret_key() -> bytes:
    k = os.environ.get("SECRET_KEY") or get_setting("secret_key")
    if not k:
        k = secrets.token_hex(32)
        set_setting("secret_key", k)
    return k.encode()


def app_password() -> str:
    # 화면의 '연동 설정'에서 바꾼 비밀번호가 있으면 그것을, 없으면 설치할 때 만든 비밀번호를 쓴다
    return get_setting("app_password") or os.environ.get("APP_PASSWORD", "")


def check_password(pw: str) -> bool:
    real = app_password()
    return bool(real) and hmac.compare_digest(pw.encode(), real.encode())


def make_cookie(name: str) -> str:
    body = base64.urlsafe_b64encode(json.dumps({"n": name, "t": int(time.time())}).encode()).decode()
    sig = hmac.new(secret_key(), body.encode(), hashlib.sha256).hexdigest()
    return body + "." + sig


def read_cookie(v: str | None):
    if not v or "." not in v:
        return None
    body, sig = v.rsplit(".", 1)
    good = hmac.new(secret_key(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, good):
        return None
    try:
        d = json.loads(base64.urlsafe_b64decode(body.encode()))
    except Exception:  # noqa: BLE001
        return None
    if time.time() - d.get("t", 0) > MAX_AGE:
        return None
    return d.get("n")


def current_user(request: Request) -> str:
    name = read_cookie(request.cookies.get(COOKIE))
    if not name:
        raise HTTPException(401, "로그인이 필요해요")
    return name


def ingest_key() -> str:
    k = get_setting("ingest_key")
    if not k:
        k = "sk_" + secrets.token_urlsafe(24)
        set_setting("ingest_key", k)
    return k


def check_ingest(request: Request):
    k = request.headers.get("x-scout-key", "")
    if not k or not hmac.compare_digest(k.encode(), ingest_key().encode()):
        raise HTTPException(401, "확장 프로그램 연결 키가 맞지 않아요")
