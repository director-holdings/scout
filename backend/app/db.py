"""데이터베이스 연결과 공통 함수"""
import json
import os
import time
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://scout:scout@db:5432/scout")
pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=6, kwargs={"row_factory": dict_row}, open=False)


def open_pool(retries: int = 30):
    """DB가 먼저 켜질 때까지 기다렸다가 연결"""
    for i in range(retries):
        try:
            pool.open(wait=True, timeout=5)
            return
        except Exception:  # noqa: BLE001
            time.sleep(2)
    pool.open(wait=True, timeout=10)


@contextmanager
def conn():
    with pool.connection() as c:
        yield c


def q(sql: str, params=None):
    with conn() as c:
        return c.execute(sql, params or ()).fetchall()


def q1(sql: str, params=None):
    with conn() as c:
        return c.execute(sql, params or ()).fetchone()


def run(sql: str, params=None):
    with conn() as c:
        c.execute(sql, params or ())


def migrate():
    sql = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    with conn() as c:
        c.execute("SELECT pg_advisory_lock(7342001)")
        try:
            c.execute(sql)
        finally:
            c.execute("SELECT pg_advisory_unlock(7342001)")


def get_setting(key: str, default: str = "") -> str:
    r = q1("SELECT value FROM settings WHERE key=%s", (key,))
    return r["value"] if r else default


def set_setting(key: str, value: str):
    run(
        "INSERT INTO settings(key,value) VALUES(%s,%s) "
        "ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()",
        (key, value),
    )


def J(v):
    return Jsonb(v)


__all__ = ["conn", "q", "q1", "run", "migrate", "get_setting", "set_setting", "J", "open_pool", "json"]
