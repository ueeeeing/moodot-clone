# AI 트리거 이벤트 스키마

"AI 에이전트가 작동을 시작하는 신호"

---

## 현재 구현할 이벤트

### emotion_created (감정 생성)

**소스:** 감정 관련 테이블(memories)  insert
**트리거 :** 사용자가 새 감정 기록
**AI 동작 :** 판단 시작

**이벤트 데이터 :**
'''python
{
	"event_type": "INSERT",
	"schema": "public",
	"table": "memories",
	"record": {
		"id": "biginit",
		"user_id": "string",
		"emotion_id": "integer",
		"title": "string",
		"text": "string",
		"with_whom": "string",
		"created_at": "timestamp",
		"processed": False
	}
}
'''
