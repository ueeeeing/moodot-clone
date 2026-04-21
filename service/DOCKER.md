# AI Worker — Docker 로컬 실행 가이드

## 사전 준비

`service/.env.example`을 복사해 `service/.env.local`을 만들고 값을 채웁니다.

```bash
cp service/.env.example service/.env.local
# 편집기로 열어 각 값 입력
```

필수 환경변수:

| 변수 | 설명 |
|---|---|
| `LLM_PROVIDER` | `openai` 또는 `ollama` |
| `OPENAI_API_KEY` | LLM_PROVIDER=openai 일 때 필수 |
| `OPENAI_MODEL` | 예: `gpt-4o-mini` |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | service_role 키 (RLS 우회용) |
| `MEMORY_TEXT_ENCRYPTION_KEY` | Next.js 앱과 동일한 암호화 키 |
| `PORT` | 포트 번호 (기본값: 8000) |

---

## Docker 빌드

`service/` 디렉토리에서 실행합니다.

```bash
cd service
docker build -t ai-worker .
```

---

## Docker 실행

```bash
docker run --rm \
  --env-file .env.local \
  -p 8000:8000 \
  ai-worker
```

---

## 동작 확인

### 헬스체크

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### AI 처리 요청 (`/ai/process`)

```bash
curl -X POST http://localhost:8000/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "user_id": "test-user-uuid",
    "emotion_id": 2,
    "created_at": "2024-01-01T00:00:00Z"
  }'
# {"status":"accepted"}
```

처리 결과는 Supabase `interventions` 테이블에 INSERT됩니다.

---

## Next.js 연동 (로컬)

`.env.local` (Next.js 앱 루트)에 아래를 추가합니다.

```
AI_WORKER_URL=http://localhost:8000
```

미설정 시 AI Worker 호출을 건너뛰고 메모리 저장만 진행합니다.
