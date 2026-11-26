# Scout (내부용)

광고·SNS 레퍼런스를 팀이 함께 모으고 분석하는 내부 도구. 판매용 아님.

## 구성 (서버 1대, Docker Compose)

| 서비스 | 하는 일 |
|---|---|
| `caddy` | 80/443 포트. `IP주소.sslip.io` 주소로 자동 HTTPS |
| `api` | FastAPI. 화면 파일 제공 + `/api/*` |
| `worker` | 수집 작업 처리, 매일 정해진 시각에 전체 수집, 순위 계산, 이미지 저장 |
| `db` | PostgreSQL 16 (pgvector 이미지, 이후 임베딩 검색용) |

작업 큐는 Redis 대신 PostgreSQL `jobs` 테이블로 처리합니다 (메모리 절약).

## 폴더

```
backend/app/      main.py(API) · bootstrap.py(화면 데이터) · worker.py · schema.sql
backend/app/collectors/  instagram.py(Business Discovery) · youtube.py
frontend/         프로토타입 화면 재사용. boot.js가 서버 데이터를 받아 window.SCOUT를 만듦
deploy/           install.sh(설치) · update.sh(자동 업데이트) · scout-cli.sh(서버 명령어)
tools/            프로토타입 샘플 데이터 → backend/app/demo_seed.json 변환
```

## 데이터 수집

- **인스타그램**: Business Discovery 공식 API. 연동 설정에 조회용 계정 ID + 토큰 입력 → 브랜드·인플루언서의 인스타그램 아이디 등록
- **유튜브**: YouTube Data API 키 입력 → 채널(@핸들 또는 UC…) 등록
- **광고 (Meta·TikTok·Google)**: 크롬 확장이 `POST /api/ingest/ad` 로 저장 (헤더 `X-Scout-Key`). 키는 연동 설정 화면에 있음

## 로그인

팀 공용 비밀번호 + 본인 이름. 비밀번호는 설치할 때 자동 생성되고 서버 콘솔에서 `scout password`로 다시 볼 수 있음.

## 서버 명령어

```
scout status     # 실행 상태·최근 업데이트
scout password   # 팀 비밀번호 보기
scout update     # 지금 바로 GitHub 최신 코드로 업데이트
scout logs api   # 로그 보기 (api / worker / db / caddy)
scout backup     # DB 백업 (매일 새벽 4시 자동, 14일 보관)
```

## 아직 안 한 것

- AI 스튜디오(8번): 유료 API가 필요해서 보류. `frontend/v-ai.js`는 남겨뒀지만 불러오지 않음
- 타깃 연령: 공개 API로 받을 수 없어 실제 데이터에는 표시하지 않음
- 레이아웃 자동 분류, 영상 대사 추출: CPU용 오픈소스 모델로 이후 추가
