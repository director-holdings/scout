-- Scout 내부용 데이터베이스 구조 (서버가 켜질 때마다 실행돼도 안전하게 IF NOT EXISTS 사용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 브랜드 (경쟁사·자사). 인스타그램/유튜브 계정을 등록하면 워커가 매일 수집
CREATE TABLE IF NOT EXISTS brands (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  industry     text NOT NULL DEFAULT 'beauty',
  color        text NOT NULL DEFAULT '#1240e0',
  ig_username  text,
  yt_channel   text,             -- 채널 ID(UC...) 또는 @핸들
  meta_page    text,             -- 광고 라이브러리에 표시되는 페이지 이름 (크롬 확장이 매칭에 사용)
  hidden       boolean NOT NULL DEFAULT false,
  is_demo      boolean NOT NULL DEFAULT false,
  extra        jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id        text PRIMARY KEY,
  brand_id  text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name      text NOT NULL,
  shape     text NOT NULL DEFAULT 'box',
  is_demo   boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS stores (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  industries  jsonb NOT NULL DEFAULT '[]',
  descr       text NOT NULL DEFAULT '',
  url         text,
  is_demo     boolean NOT NULL DEFAULT false
);

-- 인플루언서(크리에이터)
CREATE TABLE IF NOT EXISTS creators (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  handle       text NOT NULL,
  industry     text NOT NULL DEFAULT 'beauty',
  platforms    jsonb NOT NULL DEFAULT '["instagram"]',
  ig_username  text,
  yt_channel   text,
  is_demo      boolean NOT NULL DEFAULT false,
  extra        jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 콘텐츠: 인스타그램 게시물, 유튜브 영상, 광고 라이브러리에서 저장한 광고
CREATE TABLE IF NOT EXISTS contents (
  id           text PRIMARY KEY,
  source       text NOT NULL DEFAULT 'demo',   -- demo / ig / yt / extension
  source_key   text UNIQUE,                    -- 원본 쪽 ID (중복 저장 방지)
  source_url   text,
  platform     text NOT NULL,                  -- instagram / meta / tiktok / youtube / google
  brand_id     text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  product_id   text REFERENCES products(id) ON DELETE SET NULL,
  store_id     text REFERENCES stores(id) ON DELETE SET NULL,
  creator_id   text REFERENCES creators(id) ON DELETE SET NULL,
  industry     text NOT NULL,
  media        text NOT NULL DEFAULT 'image',  -- image / video / carousel
  layout       text,
  pal          int  NOT NULL DEFAULT 0,
  headline     text NOT NULL DEFAULT '',
  body         text NOT NULL DEFAULT '',
  cta          text NOT NULL DEFAULT '',
  transcript   text NOT NULL DEFAULT '',
  thumb        text,                           -- 서버에 저장한 이미지 경로 (/media/...)
  remote_thumb text,                           -- 원본 이미지 주소 (워커가 내려받음)
  hist         jsonb,                          -- 색 히스토그램 15칸 (유사 이미지 검색)
  is_ad        boolean NOT NULL DEFAULT false,
  started_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended        boolean NOT NULL DEFAULT false,
  views        bigint NOT NULL DEFAULT 0,
  likes        bigint NOT NULL DEFAULT 0,
  comments     bigint NOT NULL DEFAULT 0,
  tags         jsonb NOT NULL DEFAULT '[]',
  is_demo      boolean NOT NULL DEFAULT false,
  saved_by     text,
  extra        jsonb NOT NULL DEFAULT '{}',
  raw          jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contents_brand_idx ON contents(brand_id);
CREATE INDEX IF NOT EXISTS contents_started_idx ON contents(started_at DESC);
CREATE INDEX IF NOT EXISTS contents_text_trgm ON contents USING gin ((headline || ' ' || body || ' ' || transcript) gin_trgm_ops);

-- 매일 찍어두는 숫자 (순위 변화·팔로워 추이 그래프용)
CREATE TABLE IF NOT EXISTS content_daily (
  content_id text NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  day        date NOT NULL,
  views      bigint NOT NULL DEFAULT 0,
  likes      bigint NOT NULL DEFAULT 0,
  comments   bigint NOT NULL DEFAULT 0,
  rank       int,
  PRIMARY KEY (content_id, day)
);

CREATE TABLE IF NOT EXISTS account_daily (
  kind       text NOT NULL,      -- brand / creator
  ref_id     text NOT NULL,
  platform   text NOT NULL,      -- instagram / youtube
  day        date NOT NULL,
  followers  bigint NOT NULL DEFAULT 0,
  media_count bigint NOT NULL DEFAULT 0,
  er         real NOT NULL DEFAULT 0,      -- 참여율(%)
  avg_views  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, ref_id, platform, day)
);

-- 팀이 함께 쓰는 화면 상태 (보드·폴더·메모·추적 브랜드·멤버 등). 예전 브라우저 저장소를 대신함
CREATE TABLE IF NOT EXISTS app_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- 연동 설정 (토큰 등). 화면의 '연동 설정'에서만 입력하고 화면에는 다시 보여주지 않음
CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 수집 작업 큐와 기록 (Redis 대신 PostgreSQL 하나로 처리해 메모리 절약)
CREATE TABLE IF NOT EXISTS jobs (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,
  status      text NOT NULL DEFAULT 'queued',   -- queued / running / done / error
  message     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);
