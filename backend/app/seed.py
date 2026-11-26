"""기본값과 샘플 데이터 넣기/지우기"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .db import J, conn, q1

INDUSTRY_KEYS = ["beauty", "fashion", "food", "living", "health", "tech"]


def ensure_defaults():
    """실제 데이터에 판매처·브랜드 정보가 없어도 화면이 깨지지 않도록 기본 항목을 둔다"""
    with conn() as c:
        c.execute(
            "INSERT INTO stores(id,name,industries,descr) VALUES('etc','판매처 미지정',%s,'수집한 콘텐츠의 판매처를 아직 지정하지 않았어요') ON CONFLICT DO NOTHING",
            (J(INDUSTRY_KEYS),),
        )
        c.execute(
            "INSERT INTO brands(id,name,industry,color,hidden) VALUES('etc','브랜드 미지정','beauty','#8a8fa3',true) ON CONFLICT DO NOTHING"
        )
        c.execute("INSERT INTO products(id,brand_id,name) VALUES('etc-p0','etc','제품 미지정') ON CONFLICT DO NOTHING")


def ensure_product(c, brand_id: str) -> str:
    pid = f"{brand_id}-p0"
    c.execute("INSERT INTO products(id,brand_id,name) VALUES(%s,%s,'제품 미지정') ON CONFLICT DO NOTHING", (pid, brand_id))
    return pid


def has_demo() -> bool:
    return bool(q1("SELECT 1 AS x FROM contents WHERE is_demo LIMIT 1"))


def load_demo():
    data = json.loads((Path(__file__).parent / "demo_seed.json").read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    with conn() as c:
        for b in data["brands"]:
            c.execute(
                "INSERT INTO brands(id,name,industry,color,is_demo,extra) VALUES(%s,%s,%s,%s,true,%s) ON CONFLICT DO NOTHING",
                (b["id"], b["name"], b["industry"], b["color"], J({"followerTrend": b["followerTrend"], "erTrend": b["erTrend"]})),
            )
            for p in b["products"]:
                c.execute(
                    "INSERT INTO products(id,brand_id,name,shape,is_demo) VALUES(%s,%s,%s,%s,true) ON CONFLICT DO NOTHING",
                    (p["id"], b["id"], p["name"], p["shape"]),
                )
        for s in data["stores"]:
            c.execute(
                "INSERT INTO stores(id,name,industries,descr,is_demo) VALUES(%s,%s,%s,%s,true) ON CONFLICT DO NOTHING",
                (s["id"], s["name"], J(s["industries"]), s["desc"]),
            )
        for cr in data["creators"]:
            c.execute(
                "INSERT INTO creators(id,name,handle,industry,platforms,is_demo,extra) VALUES(%s,%s,%s,%s,%s,true,%s) ON CONFLICT DO NOTHING",
                (cr["id"], cr["name"], cr["handle"], cr["industry"], J(cr["platforms"]),
                 J({"trend": cr["trend"], "er": cr["er"], "avgViews": cr["avgViews"]})),
            )
        for x in data["contents"]:
            start = now - timedelta(days=x["ago"])
            if x["isAd"]:
                last = now if x["active"] else start + timedelta(days=x["run"])
            else:
                last = start
            c.execute(
                """INSERT INTO contents(id,source,platform,brand_id,product_id,store_id,creator_id,industry,media,layout,pal,
                     headline,body,cta,transcript,is_ad,started_at,last_seen_at,ended,views,likes,comments,tags,is_demo,extra)
                   VALUES(%s,'demo',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,true,%s)
                   ON CONFLICT DO NOTHING""",
                (x["id"], x["platform"], x["brand"], x["product"], x["store"], x["creator"], x["industry"], x["media"],
                 x["layout"], x["pal"], x["headline"], x["body"], x["cta"], x["transcript"], x["isAd"], start, last,
                 bool(x["isAd"] and not x["active"]), x["views"], x["likes"], x["comments"], J(x["tags"]),
                 J({"rank": x["rank"], "ages": x["ages"]})),
            )
    return len(data["contents"])


def clear_demo():
    with conn() as c:
        c.execute("DELETE FROM contents WHERE is_demo")
        c.execute("DELETE FROM creators WHERE is_demo")
        c.execute("DELETE FROM stores WHERE is_demo")
        c.execute("DELETE FROM brands WHERE is_demo")
    # 보드에 남은 샘플 콘텐츠 연결은 화면을 열 때 자동으로 정리됨 (boot.js)


def demo_members():
    data = json.loads((Path(__file__).parent / "demo_seed.json").read_text(encoding="utf-8"))
    return data["members"]
