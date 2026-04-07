
# Interventions 테이블 (최소 버전)

## 테이블 구조

### interventions

| 컬럼 | 타입 | 설명 | 필수 | 기본값 |
|------|------|------|------|--------|
| id | UUID | 고유 ID | ✅ | uuid_generate_v4() |
| created_at | TIMESTAMPTZ | 생성 시간 | ✅ | NOW() |
| reason | TEXT | 개입 이유 | ✅ | - |
| message | TEXT | 메시지 내용 | ✅ | - |
| status | TEXT | 상태 | ✅ | 'pending' |

### 제약 조건

```sql
-- status 값 제한
CHECK (status IN ('pending', 'shown', 'interacted', 'dismissed'))
```

### 인덱스

```sql
-- pending 메시지 조회
CREATE INDEX idx_interventions_pending 
ON interventions(created_at DESC) 
WHERE status = 'pending';
```

## 라이프사이클

```
pending → shown → interacted ✅
   ↓        ↓         ↓
 생성됨   사용자봄   반응함

또는

pending → shown → dismissed ❌
   ↓        ↓         ↓
 생성됨   사용자봄   무시함
```

---

## 예시 데이터

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-20T10:30:00Z",
  "reason": "no_recent_record",
  "message": "요즘 어때? 오랜만이네!",
  "status": "pending"
}
```

---

## 나중에 추가할 수 있는 것들

필요할 때 ALTER TABLE로 추가:

```sql
-- 사용자 ID
ALTER TABLE interventions ADD COLUMN user_id TEXT REFERENCES auth.users(id) ON DELETE CASCADE;

-- 우선순위
ALTER TABLE interventions ADD COLUMN priority INTEGER DEFAULT 5;

-- 메시지 톤
ALTER TABLE interventions ADD COLUMN tone TEXT;

-- 액션 버튼
ALTER TABLE interventions ADD COLUMN buttons JSONB;

-- 사용자 액션
ALTER TABLE interventions ADD COLUMN user_action TEXT;

-- LLM 메타데이터
ALTER TABLE interventions ADD COLUMN llm_tokens_used INTEGER;

-- 컨텍스트
ALTER TABLE interventions ADD COLUMN context JSONB;
```

---

# emotion_categories 테이블

## 테이블 구조

### emotion_categories

| 컬럼 | 타입 | 필수 | 기본값 |
|------|------|------|--------|
| emotion_id | integer | ✅ | nextval('emotion_categories_emotion_id_seq') |
| emotion | character varying | ✅ | - |

### 제약 조건

```sql
CONSTRAINT emotion_categories_pkey PRIMARY KEY (emotion_id)
UNIQUE (emotion)
```

---

# memories 테이블

## 테이블 구조

### memories

| 컬럼 | 타입 | 필수 | 기본값 |
|------|------|------|--------|
| id | bigint | ✅ | nextval('memories_id_seq') |
| title | text | - | - |
| text | text | - | - |
| image_url | text | - | - |
| emotion_id | integer | ✅ | - |
| with_whom | text | - | - |
| location_lat | double precision | - | - |
| location_lng | double precision | - | - |
| location_label | text | - | - |
| place_name | text | - | - |
| location_type | text | - | - |
| memory_at | timestamp with time zone | - | - |
| created_at | timestamp with time zone | - | NOW() |
| updated_at | timestamp with time zone | - | NOW() |
| processed | boolean | - | false |

### 제약 조건

```sql
CONSTRAINT memories_pkey PRIMARY KEY (id)
CONSTRAINT memories_emotion_id_fkey FOREIGN KEY (emotion_id) REFERENCES public.emotion_categories(emotion_id)
```
