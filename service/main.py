# main.py
import os
import asyncio
import logging
from dotenv import load_dotenv
from supabase import create_client, acreate_client
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

# 환경 변수 로드
load_dotenv('.env.local')

DEFAULT_USER_ID = "default_user"

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from models import (
    Intervention,
    InterventionStatus,
    InterventionReason,
    InterventionRepository
)

from rules import RuleEngine
from config import LLMFactory
from generators import MessageGenerator

# 전역 변수
intervention_repo: Optional['InterventionRepository'] = None
rule_engine: Optional[RuleEngine] = None
message_generator: Optional[MessageGenerator] = None


async def create_supabase_client() :
    """Supabase 클라이언트 생성"""
    return await acreate_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )


async def mark_as_processed(supabase, emotion_id: str) -> None:
    """감정을 처리 완료 상태로 변경"""
    try:
        result = await supabase.table('memories')\
            .update({'processed': True})\
            .eq('id', emotion_id)\
            .execute()

        if hasattr(result, 'data') and result.data:
            logger.debug(f"Processed 플래그 업데이트 성공: {emotion_id}")
        else:
            logger.warning(f"Processed 플래그 업데이트 실패: {emotion_id}")

    except Exception as e:
        logger.error(f"❌ Processed 업데이트 실패: {e}")


async def should_intervene(
    supabase,
    user_id: str = DEFAULT_USER_ID
) -> Dict[str, Any]:
    """
    개입 여부 판단 (Rule Engine 사용)
    
    Args:
        supabase: Supabase 클라이언트
        user_id: 사용자 ID
    
    Returns:
        {
            "should_intervene": True/False,
            "reason": "no_recent_record",
            "tone": "curious",
            "severity": 1,
            "rule": "no_recent_record",
            "context": {...}
        }
    
    Example:
        >>> decision = await should_intervene(supabase)
        >>> if decision['should_intervene']:
        >>>     print(f"개입 필요: {decision['reason']}")
    """
    global rule_engine
    
    try:
        # ✅ Rule Engine으로 판단 (기존 100줄 로직 → 3줄)
        decision = await rule_engine.evaluate(user_id)
        return decision
        
    except Exception as e:
        logger.error(f"❌ 개입 판단 실패: {e}", exc_info=True)
        return {
            "should_intervene": False,
            "reason": "error",
            "context": {"error": str(e)}
        }


def generate_simple_message(
    reason: str, 
    context: Dict[str, Any] = None,
    tone: str = "neutral"  # ✅ tone 파라미터 추가
) -> str:
    """
    톤별 메시지 생성
    
    Args:
        reason: 개입 이유
        context: 추가 컨텍스트
        tone: 메시지 톤
    
    Returns:
        생성된 메시지
    """
    context = context or {}
    
    # ✅ 톤별 기본 표현
    tone_expressions = {
        # 부정 상황
        "empathetic": {
            "greeting": "괜찮아?",
            "ending": "💙",
            "connector": "얘기 들어줄게"
        },
        "supportive": {
            "greeting": "안녕!",
            "ending": "💪",
            "connector": "내가 옆에 있어"
        },
        "concerned": {
            "greeting": "걱정됐어",
            "ending": "😟",
            "connector": "무슨 일 있어?"
        },
        "comforting": {
            "greeting": "힘들지?",
            "ending": "🤗",
            "connector": "괜찮아, 천천히 해"
        },
        "gentle": {
            "greeting": "괜찮아",
            "ending": "🌸",
            "connector": "조심스럽게 물어볼게"
        },
        
        # 긍정 상황
        "cheerful": {
            "greeting": "좋은 하루야!",
            "ending": "😊",
            "connector": "기분 좋아 보여"
        },
        "encouraging": {
            "greeting": "잘하고 있어!",
            "ending": "🌟",
            "connector": "계속 이렇게만"
        },
        "celebrating": {
            "greeting": "축하해!",
            "ending": "🎉",
            "connector": "정말 대단해"
        },
        "proud": {
            "greeting": "자랑스러워!",
            "ending": "🏆",
            "connector": "정말 잘했어"
        },
        
        # 일상/중립
        "curious": {
            "greeting": "요즘 어때?",
            "ending": "😊",
            "connector": "궁금해"
        },
        "friendly": {
            "greeting": "안녕!",
            "ending": "👋",
            "connector": "잘 지내고 있지?"
        },
        "casual": {
            "greeting": "뭐해?",
            "ending": "☺️",
            "connector": "오늘은"
        },
        "playful": {
            "greeting": "요즘 뭐하고 지내?",
            "ending": "😏",
            "connector": "재미있는 일 있어?"
        },
        "neutral": {
            "greeting": "안녕?",
            "ending": "😊",
            "connector": "오늘 하루"
        }
    }
    
    # 톤 표현 가져오기
    expr = tone_expressions.get(tone, tone_expressions["neutral"])
    greeting = expr["greeting"]
    ending = expr["ending"]
    connector = expr["connector"]
    
    # ✅ 이유별 메시지 생성 (severity 반영)
    if reason == InterventionReason.NO_RECENT_RECORD.value:
        days = context.get('days_since_last_record', 3)
        severity = context.get('severity', 1)
        
        if severity == 3:  # 심각 (7일+)
            return f"{greeting} {days}일이나 연락이 없어서 많이 걱정했어. {connector} {ending}"
        elif severity == 2:  # 중간 (5일)
            return f"{greeting} {days}일 동안 소식이 없었네! {connector} {ending}"
        else:  # 보통 (3일)
            return f"{greeting} {days}일째 연락 없어서 {connector} {ending}"
    
    elif reason == InterventionReason.NEGATIVE_PATTERN.value:
        consecutive = context.get('consecutive_negative', 0)
        severity = context.get('severity', 1)
        
        if consecutive >= 3:  # 연속 부정
            if severity == 3:  # 심각 (5개+)
                return f"{greeting} 요즘 정말 많이 힘들어 보여. {connector} {ending}"
            elif severity == 2:  # 중간 (4개)
                return f"{greeting} 힘든 일이 계속되는 것 같아. {connector} {ending}"
            else:  # 보통 (3개)
                return f"{greeting} 요즘 힘들지? {connector} {ending}"
        
        # 부정 비율
        negative_ratio = context.get('negative_ratio', 0)
        if severity == 3:  # 심각 (90%+)
            return f"{greeting} 최근에 너무 힘든 일이 많았던 것 같아. {connector} {ending}"
        elif severity == 2:  # 중간 (80%)
            return f"{greeting} 요즘 많이 지쳐 보이네. {connector} {ending}"
        else:  # 보통 (70%)
            return f"{greeting} 요즘 좀 힘들어 보여. {connector} {ending}"
    
    elif reason == InterventionReason.POSITIVE_REINFORCEMENT.value:
        return f"{greeting} 좋은 일들이 계속되고 있네! {connector} {ending}"
    
    # 기본 메시지
    return f"{greeting} 오늘 하루 어때? {ending}"


async def handle_new_emotion(supabase, payload: Dict[str, Any]) -> None:
    """
    새로운 감정 이벤트 처리
    
    Args:
        supabase: Supabase 클라이언트
        payload: Realtime 이벤트 페이로드
    """
    global intervention_repo
    
    try:
        emotion = payload['record']
        user_id = emotion.get('user_id', DEFAULT_USER_ID)
        
        # emotion_id로 감정 이름 조회
        emotion_id = emotion.get('emotion_id')
        try:
            category_result = await supabase.table('emotion_categories')\
                .select('emotion')\
                .eq('emotion_id', emotion_id)\
                .single()\
                .execute()
            emotion_name = category_result.data['emotion'] if category_result.data else 'Unknown'
        except Exception as e:
            logger.error(f"감정 카테고리 조회 실패: {e}")
            emotion_name = 'Unknown'
        
        logger.info("=" * 50)
        logger.info("📥 새 감정 감지!")
        logger.info(f"   ID: {emotion['id']}")
        logger.info(f"   사용자: {user_id}")
        logger.info(f"   감정: {emotion_name}")
        logger.info(f"   내용: {emotion.get('text', 'N/A')}")
        logger.info(f"   시간: {emotion['created_at']}")
        logger.info("=" * 50)
        
        # ✅ Rule Engine으로 판단
        decision = await should_intervene(supabase, user_id)
        
        if not decision.get("should_intervene"):
            logger.info(f"⏭️ 개입 불필요: {decision.get('reason')}")
            await mark_as_processed(supabase, emotion['id'])
            return
        
        # ✅ 개입 생성 (톤 정보 추가 로깅)
        logger.info(f"💬 개입 생성 중...")
        logger.info(f"   규칙: {decision.get('rule')}")
        logger.info(f"   이유: {decision['reason']}")
        logger.info(f"   톤: {decision.get('tone')}")
        logger.info(f"   심각도: {decision.get('severity', 1)}/3")
        
        # 메시지 생성 — LLM 미연결 시 개입 생성 생략 (processed 유지 → 재기동 후 재처리)
        if not message_generator:
            logger.info("⏭️ LLM 미연결 — 개입 생성 생략 (미처리 상태 유지)")
            return

        message, gen_meta = message_generator.generate_with_validation(
            decision["reason"],
            decision.get("context", {})
        )
        logger.info(f"   생성 방법: {gen_meta.get('generation_method')}")
        
        intervention = Intervention(
            user_id=user_id,
            reason=decision["reason"],
            message=message
        )
        
        intervention_id = await intervention_repo.create(intervention)
        
        if intervention_id:
            logger.info(f"✅ Intervention 생성: {intervention_id}")
            logger.info(f"   메시지: {message}")
        else:
            logger.error("❌ Intervention 생성 실패")
        
        await mark_as_processed(supabase, emotion['id'])
        logger.info("✅ 처리 완료\n")
        
    except Exception as e:
        logger.error(f"❌ 이벤트 처리 중 에러: {e}", exc_info=True)


async def process_missed_emotions(supabase) -> None:
    """워커가 다운되었을 때 놓친 감정 처리 (안전장치)"""
    logger.info("🔍 놓친 감정 확인 중...")

    try:
        one_minute_ago = (datetime.now() - timedelta(minutes=1)).isoformat()

        result = await supabase.table('memories')\
            .select('*')\
            .eq('processed', False)\
            .lt('created_at', one_minute_ago)\
            .order('created_at')\
            .limit(10)\
            .execute()

        missed_emotions = result.data if hasattr(result, 'data') else []

        if not missed_emotions:
            logger.info("✅ 놓친 감정 없음")
            return

        logger.warning(f"⚠️ 놓친 감정 {len(missed_emotions)}개 발견! 처리 시작...")

        for emotion in missed_emotions:
            await handle_new_emotion(supabase, {'record': emotion})

        logger.info("✅ 놓친 감정 처리 완료")

    except Exception as e:
        logger.error(f"❌ 놓친 감정 처리 실패: {e}", exc_info=True)


async def periodic_check(supabase) -> None:
    """5분마다 놓친 감정 체크"""
    while True:
        await asyncio.sleep(5 * 60)  # 5분 대기
        await process_missed_emotions(supabase)


def on_postgres_changes(supabase, payload: Dict[str, Any]) -> None:
    """Postgres 변경 이벤트 핸들러 (동기 콜백)"""
    event_type = payload.get('eventType')
    if event_type == 'INSERT':
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(handle_new_emotion(supabase, payload))
        except RuntimeError:
            logger.error("이벤트 루프가 실행 중이지 않음!")
    else:
        logger.debug(f"무시된 이벤트 타입: {event_type}")


async def initial_check(supabase) -> None:
    """초기 놓친 감정 체크 (5초 후)"""
    await asyncio.sleep(5)
    await process_missed_emotions(supabase)


async def health_server() -> None:
    """Render Web Service용 최소 HTTP 서버 — 포트만 열고 200 OK 응답"""
    port = int(os.getenv("PORT", 8000))

    async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            await asyncio.wait_for(reader.read(1024), timeout=5)
            body = b'{"status":"ok"}'
            writer.write(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: application/json\r\n"
                b"Content-Length: " + str(len(body)).encode() + b"\r\n"
                b"\r\n" + body
            )
            await writer.drain()
        except Exception:
            pass
        finally:
            writer.close()

    server = await asyncio.start_server(handle, "0.0.0.0", port)
    logger.info(f"🌐 Health server 시작: port={port}")
    async with server:
        await server.serve_forever()


async def main() -> None:
    """메인 비동기 진입점"""
    global intervention_repo, rule_engine, message_generator

    logger.info("🚀 AI 에이전트 워커 시작...")
    logger.info(f"📡 Supabase URL: {os.getenv('SUPABASE_URL')}")

    supabase = await create_supabase_client()
    intervention_repo = InterventionRepository(supabase)
    rule_engine = RuleEngine(supabase)

    # MessageGenerator 초기화 — LLM 미연결 시 템플릿 fallback으로 동작
    try:
        llm = LLMFactory.create()
        message_generator = MessageGenerator(llm)
        logger.info(f"✅ MessageGenerator 초기화 완료 ({llm.model_name})")
    except Exception as e:
        message_generator = None
        logger.warning(f"⚠️ LLM 연결 실패 — 템플릿 메시지로 동작합니다: {e}")

    # Realtime 채널 생성 및 구독
    max_retries = 3
    for attempt in range(max_retries):
        try:
            channel = supabase.channel('emotion_events')
            channel.on_postgres_changes(
                event='INSERT',
                schema='public',
                table='memories',
                callback=lambda payload: on_postgres_changes(supabase, payload)
            )
            await channel.subscribe()
            logger.info("✅ Realtime 구독 시작!")
            logger.info("👂 이벤트 대기 중... (Ctrl+C로 종료)")
            break
        except Exception as e:
            logger.error(f"구독 실패 (시도 {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(5)

    # 병렬 실행: health server + 초기 체크 + 주기적 체크
    await asyncio.gather(
        health_server(),            # Render health check용
        initial_check(supabase),    # 5초 후 초기 체크
        periodic_check(supabase),   # 5분마다 체크 (무한 루프)
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 워커 정상 종료됨")