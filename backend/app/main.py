"""Scout 내부용 API 서버"""
import base64
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import auth, bootstrap, seed
from .db import J, conn, get_setting, migrate, open_pool, q, q1, run, set_setting

FRONTEND = Path(os.environ.get("FRONTEND_DIR", Path(__file__).resolve().parents[2] / "frontend"))
MEDIA = Path(os.environ.get("MEDIA_DIR", "/data/media"))
MEDIA.mkdir(parents=True, exist_ok=True)

# 화면에서 입력할 수 있는 연동 설정. secret=True는 저장 후 다시 보여주지 않음
SETTING_KEYS = {
    "ig_user_id": False,        # 조회용 인스타그램 프로페셔널 계정의 ID (숫자)
    "ig_access_token": True,    # Meta 개발자 앱에서 받은 장기 토큰
    "yt_api_key": True,         # YouTube Data API 키
    "app_password": True,       # 팀 로그인 비밀번호 변경
    "collect_hour": False,      # 매일 수집 시각 (한국 시간, 0~23)
}

app = FastAPI(title="Scout", docs_url=None, redoc_url=None)


@app.on_event("startup")
def _startup():
    open_pool()
    migrate()
    seed.ensure_defaults()
    auth.ingest_key()
    if os.environ.get("LOAD_DEMO", "1") == "1" and not get_setting("demo_initialized"):
        seed.load_demo()
        set_setting("demo_initialized", "1")


User = Depends(auth.current_user)


def new_id(prefix: str) -> str:
    return prefix + secrets.token_hex(4)


def clean_handle(v: str | None) -> str | None:
    if not v:
        return None
    v = v.strip()
    m = re.search(r"instagram\.com/([A-Za-z0-9_.]+)", v)
    if m:
        v = m.group(1)
    return v.lstrip("@").strip("/") or None


# ---------------- 로그인 ----------------
@app.post("/api/login")
async def login(request: Request):
    d = await request.json()
    name = (d.get("name") or "").strip()[:20]
    if not name:
        raise HTTPException(400, "이름을 입력하세요")
    if not auth.check_password(d.get("password") or ""):
        raise HTTPException(401, "비밀번호가 맞지 않아요")
    r = JSONResponse({"ok": True, "name": name})
    secure = request.url.scheme == "https"
    r.set_cookie(auth.COOKIE, auth.make_cookie(name), max_age=auth.MAX_AGE, httponly=True, samesite="lax", secure=secure)
    return r


@app.post("/api/logout")
def logout():
    r = JSONResponse({"ok": True})
    r.delete_cookie(auth.COOKIE)
    return r


@app.get("/api/me")
def me(user: str = User):
    return {"name": user}


# ---------------- 화면 데이터 ----------------
@app.get("/api/bootstrap")
def get_bootstrap(user: str = User):
    state = {r["key"]: r["value"] for r in q("SELECT key, value FROM app_state")}
    data = bootstrap.build(state)
    data["me"] = user
    data["demoMembers"] = seed.demo_members() if seed.has_demo() else []
    return data


@app.put("/api/state/{key}")
async def put_state(key: str, request: Request, user: str = User):
    if not re.fullmatch(r"[A-Za-z]{1,40}", key):
        raise HTTPException(400, "잘못된 키")
    value = await request.json()
    run(
        "INSERT INTO app_state(key,value,updated_by) VALUES(%s,%s,%s) "
        "ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now(), updated_by=EXCLUDED.updated_by",
        (key, J(value), user),
    )
    return {"ok": True}


# ---------------- 수집 대상 (브랜드·인플루언서) ----------------
@app.get("/api/targets")
def targets(user: str = User):
    brands = q("SELECT id,name,industry,color,ig_username,yt_channel,meta_page,is_demo FROM brands WHERE NOT hidden ORDER BY is_demo, created_at")
    creators = q("SELECT id,name,handle,industry,ig_username,yt_channel,is_demo FROM creators ORDER BY is_demo, created_at")
    stores = q("SELECT id,name,industries,descr,url,is_demo FROM stores WHERE id<>'etc' ORDER BY is_demo, name")
    return {"brands": brands, "creators": creators, "stores": stores}


@app.post("/api/brands")
async def save_brand(request: Request, user: str = User):
    d = await request.json()
    name = (d.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "브랜드 이름을 입력하세요")
    bid = d.get("id") or new_id("b")
    with conn() as c:
        c.execute(
            """INSERT INTO brands(id,name,industry,color,ig_username,yt_channel,meta_page)
               VALUES(%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, industry=EXCLUDED.industry, color=EXCLUDED.color,
                 ig_username=EXCLUDED.ig_username, yt_channel=EXCLUDED.yt_channel, meta_page=EXCLUDED.meta_page""",
            (bid, name, d.get("industry") or "beauty", d.get("color") or "#1240e0", clean_handle(d.get("ig")),
             (d.get("yt") or "").strip() or None, (d.get("metaPage") or "").strip() or None),
        )
        seed.ensure_product(c, bid)
    return {"ok": True, "id": bid}


@app.delete("/api/brands/{bid}")
def delete_brand(bid: str, user: str = User):
    if bid == "etc":
        raise HTTPException(400, "기본 항목은 지울 수 없어요")
    run("DELETE FROM brands WHERE id=%s", (bid,))
    return {"ok": True}


@app.post("/api/creators")
async def save_creator(request: Request, user: str = User):
    d = await request.json()
    ig = clean_handle(d.get("ig"))
    name = (d.get("name") or ig or "").strip()
    if not name:
        raise HTTPException(400, "이름 또는 인스타그램 계정을 입력하세요")
    cid = d.get("id") or new_id("c")
    platforms = [p for p, v in (("instagram", ig), ("youtube", d.get("yt"))) if v] or ["instagram"]
    run(
        """INSERT INTO creators(id,name,handle,industry,platforms,ig_username,yt_channel) VALUES(%s,%s,%s,%s,%s,%s,%s)
           ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, handle=EXCLUDED.handle, industry=EXCLUDED.industry,
             platforms=EXCLUDED.platforms, ig_username=EXCLUDED.ig_username, yt_channel=EXCLUDED.yt_channel""",
        (cid, name, "@" + ig if ig else name, d.get("industry") or "beauty", J(platforms), ig, (d.get("yt") or "").strip() or None),
    )
    return {"ok": True, "id": cid}


@app.delete("/api/creators/{cid}")
def delete_creator(cid: str, user: str = User):
    run("DELETE FROM creators WHERE id=%s", (cid,))
    return {"ok": True}


@app.post("/api/stores")
async def save_store(request: Request, user: str = User):
    d = await request.json()
    name = (d.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "스토어 이름을 입력하세요")
    sid = d.get("id") or new_id("s")
    run(
        """INSERT INTO stores(id,name,industries,descr,url) VALUES(%s,%s,%s,%s,%s)
           ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, industries=EXCLUDED.industries, descr=EXCLUDED.descr, url=EXCLUDED.url""",
        (sid, name, J(d.get("industries") or ["beauty"]), d.get("desc") or "", d.get("url") or None),
    )
    return {"ok": True, "id": sid}


@app.delete("/api/stores/{sid}")
def delete_store(sid: str, user: str = User):
    if sid == "etc":
        raise HTTPException(400, "기본 항목은 지울 수 없어요")
    run("DELETE FROM stores WHERE id=%s", (sid,))
    return {"ok": True}


# ---------------- 연동 설정 ----------------
@app.get("/api/settings")
def get_settings(user: str = User):
    out = {}
    for k, secret in SETTING_KEYS.items():
        v = get_setting(k)
        out[k] = {"set": bool(v), "value": None if secret else v}
    out["ingest_key"] = {"set": True, "value": auth.ingest_key()}
    return out


@app.post("/api/settings")
async def post_settings(request: Request, user: str = User):
    d = await request.json()
    for k, v in d.items():
        if k not in SETTING_KEYS:
            continue
        v = (v or "").strip()
        if not v:
            continue
        if k == "app_password" and len(v) < 8:
            raise HTTPException(400, "비밀번호는 8자 이상으로 해주세요")
        set_setting(k, v)
    return {"ok": True}


@app.post("/api/settings/ingest-key/rotate")
def rotate_ingest(user: str = User):
    set_setting("ingest_key", "sk_" + secrets.token_urlsafe(24))
    return {"ok": True, "value": auth.ingest_key()}


# ---------------- 수집 작업 ----------------
JOB_KINDS = {"collect_all", "collect_instagram", "collect_youtube", "check_instagram", "check_youtube"}


@app.post("/api/jobs")
async def add_job(request: Request, user: str = User):
    d = await request.json()
    kind = d.get("kind")
    if kind not in JOB_KINDS:
        raise HTTPException(400, "알 수 없는 작업")
    if q1("SELECT 1 AS x FROM jobs WHERE kind=%s AND status IN ('queued','running')", (kind,)):
        return {"ok": True, "already": True}
    run("INSERT INTO jobs(kind) VALUES(%s)", (kind,))
    return {"ok": True}


@app.get("/api/jobs")
def list_jobs(user: str = User):
    return q("SELECT * FROM jobs ORDER BY id DESC LIMIT 20")


# ---------------- 샘플 데이터 ----------------
@app.post("/api/demo/clear")
def demo_clear(user: str = User):
    seed.clear_demo()
    return {"ok": True}


@app.post("/api/demo/load")
def demo_load(user: str = User):
    return {"ok": True, "count": seed.load_demo()}


# ---------------- 크롬 확장에서 광고 저장 ----------------
@app.get("/api/ingest/ping")
def ingest_ping(request: Request):
    auth.check_ingest(request)
    brands = q("SELECT id,name,meta_page FROM brands WHERE NOT hidden AND NOT is_demo ORDER BY name")
    return {"ok": True, "brands": brands}


AD_PLATFORMS = {"meta", "tiktok", "google", "instagram", "youtube"}


def _parse_date(v):
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y. %m. %d", "%Y/%m/%d"):
        try:
            return datetime.strptime(v.strip().rstrip("."), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None


@app.post("/api/ingest/ad")
async def ingest_ad(request: Request):
    auth.check_ingest(request)
    d = await request.json()
    platform = d.get("platform") if d.get("platform") in AD_PLATFORMS else "meta"
    ad_id = str(d.get("adId") or "").strip()
    page = (d.get("pageName") or "").strip()[:120]
    text = (d.get("text") or "").strip()
    headline = (d.get("headline") or "").strip() or (text.split("\n")[0][:80] if text else page)
    key = f"{platform}:{ad_id}" if ad_id else None
    saved_by = (d.get("savedBy") or "").strip()[:20] or "확장 프로그램"
    with conn() as c:
        brand_id = d.get("brandId")
        if not brand_id or not c.execute("SELECT 1 FROM brands WHERE id=%s", (brand_id,)).fetchone():
            row = c.execute(
                "SELECT id FROM brands WHERE NOT is_demo AND (lower(meta_page)=lower(%s) OR lower(name)=lower(%s)) LIMIT 1",
                (page, page),
            ).fetchone() if page else None
            if row:
                brand_id = row["id"]
            elif page:
                brand_id = new_id("b")
                c.execute("INSERT INTO brands(id,name,meta_page) VALUES(%s,%s,%s)", (brand_id, page, page))
            else:
                brand_id = "etc"
        pid = seed.ensure_product(c, brand_id)
        industry = c.execute("SELECT industry FROM brands WHERE id=%s", (brand_id,)).fetchone()["industry"]
        started = _parse_date(d.get("startDate")) or datetime.now(timezone.utc)
        active = d.get("active", True) is not False
        cid = None
        if key:
            row = c.execute("SELECT id FROM contents WHERE source_key=%s", (key,)).fetchone()
            cid = row["id"] if row else None
        thumb = None
        img = d.get("imageData") or ""
        m = re.match(r"data:image/(png|jpe?g|webp);base64,(.+)", img, re.S)
        if m:
            fname = (cid or new_id("x")) + "." + ("jpg" if m.group(1).startswith("j") else m.group(1))
            raw = base64.b64decode(m.group(2))
            if len(raw) <= 6_000_000:
                (MEDIA / fname).write_bytes(raw)
                thumb = "/media/" + fname
        media = d.get("media") if d.get("media") in ("image", "video", "carousel") else "image"
        tags = [t for t in [d.get("platformLabel"), "영상" if media == "video" else "캐러셀" if media == "carousel" else "이미지", "광고"] if t]
        if cid:
            c.execute(
                """UPDATE contents SET last_seen_at=now(), ended=%s, thumb=COALESCE(%s,thumb),
                     remote_thumb=COALESCE(%s,remote_thumb), raw=%s WHERE id=%s""",
                (not active, thumb, d.get("imageUrl"), J(d), cid),
            )
            return {"ok": True, "id": cid, "updated": True}
        cid = new_id("ad")
        c.execute(
            """INSERT INTO contents(id,source,source_key,source_url,platform,brand_id,product_id,store_id,industry,media,
                 headline,body,cta,transcript,thumb,remote_thumb,is_ad,started_at,last_seen_at,ended,tags,saved_by,raw)
               VALUES(%s,'extension',%s,%s,%s,%s,%s,'etc',%s,%s,%s,%s,%s,'',%s,%s,true,%s,now(),%s,%s,%s,%s)""",
            (cid, key, d.get("url"), platform, brand_id, pid, industry, media, headline[:200], text[:4000],
             (d.get("cta") or "")[:80], thumb, d.get("imageUrl"), started, not active, J(tags), saved_by, J(d)),
        )
    return {"ok": True, "id": cid, "created": True}


# ---------------- 정적 파일 ----------------
@app.get("/healthz")
def healthz():
    q1("SELECT 1 AS x")
    return {"ok": True}


@app.exception_handler(401)
async def _unauth(request: Request, exc):
    if request.url.path.startswith("/api/"):
        return JSONResponse({"detail": getattr(exc, "detail", "로그인이 필요해요")}, status_code=401)
    return RedirectResponse("/login.html")


app.mount("/media", StaticFiles(directory=MEDIA), name="media")


@app.get("/")
def index(request: Request):
    if not auth.read_cookie(request.cookies.get(auth.COOKIE)):
        return RedirectResponse("/login.html")
    return FileResponse(FRONTEND / "index.html", headers={"Cache-Control": "no-cache"})


app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")
