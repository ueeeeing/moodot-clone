# main.py
import os
import asyncio
import logging
from dotenv import load_dotenv
from supabase import acreate_client, AsyncClient
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

from tools.emotion_tools import (
    DEFAULT_USER_ID,
    get_recent_emotions,
    get_days_since_last_record,
    get_consecutive_emotions,
    get_emotion_statistics
)

from tools.intervention_tools import (
    check_intervention_history,
    count_today_interventions,
    should_intervene_based_on_frequency
)

# 전역 변수
intervention_repo: Optional['InterventionRepository'] = None


async def create_supabase_client() -> AsyncClient:
    """Supabase 클라이언트 생성"""
    return await acreate_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )


async def mark_as_processed(supabase: AsyncClient, emotion_id: str) -> None:
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
    supabase: AsyncClient,  # ✅ supabase 전달
    user_id: str = DEFAULT_USER_ID  # ✅ 기본값
) -> Dict[str, Any]:
    """
    개입 여부 판단 (Tools 사용)
    
    Args:
        supabase: Supabase 클라이언트
        user_id: 사용자 ID
    
    Returns:
        {
            "should": True/False,
            "reason": "no_recent_record" 등,
            "context": {...}
        }
    
    Example:
        >>> decision = await should_intervene(supabase)
        >>> if decision['should']:
        >>>     print(f"개입 필요: {decision['reason']}")
    """
    try:
        # 1. 빈도 제한 체크 (Tool 사용)
        freq_check = await should_intervene_based_on_frequency(
            supabase,
            user_id,
            max_per_day=2,
            min_hours_between=4  # ✅ 6시간 → 4시간으로 조정
        )
        
        if not freq_check['should_intervene']:
            logger.info(f"⏭️ 빈도 제한: {freq_check['reason']}")
            logger.debug(f"   오늘 {freq_check['today_count']}번 개입")
            if freq_check['hours_since_last']:
                logger.debug(f"   마지막 개입: {freq_check['hours_since_last']:.1f}시간 전")
            
            return {
                "should": False,
                "reason": freq_check['reason'],
                "context": freq_check
            }
        
        # 2. 감정 데이터 조회 (Tools 사용)
        days_since = await get_days_since_last_record(supabase, user_id)
        consecutive_negative = await get_consecutive_emotions(supabase, user_id, "negative")
        recent_emotions = await get_recent_emotions(supabase, user_id, days=7)
        stats = await get_emotion_statistics(supabase, user_id, days=7)
        
        logger.debug(f"📊 판단 데이터:")
        logger.debug(f"   - 마지막 기록: {days_since}일 전")
        logger.debug(f"   - 연속 부정: {consecutive_negative}개")
        logger.debug(f"   - 최근 7일: {len(recent_emotions)}개")
        logger.debug(f"   - 긍정/부정: {stats['positive_count']}/{stats['negative_count']}")
        
        # 3. 규칙 적용
        
        # 규칙 1: 3일 이상 미기록
        if days_since is not None and days_since >= 3:
            logger.info(f"✅ 개입 이유: 장기간 미기록 ({days_since}일)")
            return {
                "should": True,
                "reason": InterventionReason.NO_RECENT_RECORD.value,
                "context": {
                    "days_since_last_record": days_since,
                    "recent_emotions_count": len(recent_emotions)
                }
            }
        
        # 규칙 2: 연속 3개 이상 부정 감정 (bad, sad)
        if consecutive_negative >= 3:
            logger.info(f"✅ 개입 이유: 연속 부정 감정 ({consecutive_negative}개)")
            return {
                "should": True,
                "reason": InterventionReason.NEGATIVE_PATTERN.value,  # ✅ NEGATIVE_STREAK → NEGATIVE_PATTERN
                "context": {
                    "consecutive_negative": consecutive_negative,
                    "recent_emotions": [e['emotion_name'] for e in recent_emotions[:5]]
                }
            }
        
        # 규칙 3: 부정 감정 비율 높음 (70% 이상)
        if stats['total_count'] >= 5:  # 최소 5개 이상일 때만
            negative_ratio = stats['negative_count'] / stats['total_count']
            if negative_ratio >= 0.7:
                logger.info(f"✅ 개입 이유: 부정 감정 비율 높음 ({negative_ratio:.0%})")
                return {
                    "should": True,
                    "reason": InterventionReason.NEGATIVE_PATTERN.value,
                    "context": {
                        "negative_ratio": round(negative_ratio, 2),
                        "total_count": stats['total_count'],
                        "negative_count": stats['negative_count'],
                        "emotion_distribution": stats['emotion_distribution']
                    }
                }
        
        # 개입 불필요
        logger.info("⏭️ 개입 불필요: 정상 범위")
        return {
            "should": False,
            "reason": "no_trigger",
            "context": {
                "days_since": days_since,
                "consecutive_negative": consecutive_negative,
                "stats": stats
            }
        }
        
    except Exception as e:
        logger.error(f"❌ 개입 판단 실패: {e}", exc_info=True)
        return {
            "should": False,
            "reason": "error",
            "context": {"error": str(e)}
        }


def generate_simple_message(reason: str, context: Dict[str, Any] = None) -> str:
    """
    간단한 메시지 생성 (템플릿)
    
    Args:
        reason: 개입 이유
        context: 추가 컨텍스트
    
    Returns:
        생성된 메시지
    """
    context = context or {}
    
    # ✅ 개입 이유별 메시지 템플릿
    if reason == InterventionReason.NO_RECENT_RECORD.value:
        days = context.get('days_since_last_record', 3)
        return f"요즘 어때? {days}일 동안 소식이 없었네! 궁금해 😊"
    
    elif reason == InterventionReason.NEGATIVE_PATTERN.value:
        consecutive = context.get('consecutive_negative', 0)
        if consecutive >= 3:
            return f"요즘 힘든 일이 계속되는 것 같아. 괜찮아? 💙"
        
        negative_ratio = context.get('negative_ratio')
        if negative_ratio:
            return f"최근에 많이 힘들어 보여. 무슨 일 있어? 🤗"
    
    elif reason == InterventionReason.POSITIVE_REINFORCEMENT.value:
        return "좋은 일들이 계속되고 있네! 축하해 🎉"
    
    # 기본 메시지
    return "안녕? 오늘 하루 어때? 😊"


async def handle_new_emotion(supabase: AsyncClient, payload: Dict[str, Any]) -> None:
    """
    새로운 감정 이벤트 처리 (Tools 사용)
    
    Args:
        supabase: Supabase 클라이언트
        payload: Realtime 이벤트 페이로드
    """
    global intervention_repo
    
    try:
        emotion = payload['record']
        
        # ✅ user_id 가져오기 (없으면 DEFAULT_USER_ID)
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
        
        # ✅ Tools를 사용한 판단
        decision = await should_intervene(supabase, user_id)
        
        if not decision["should"]:
            logger.info(f"⏭️ 개입 불필요: {decision['reason']}")
            await mark_as_processed(supabase, emotion['id'])
            return
        
        # 개입 생성
        logger.info(f"💬 개입 생성 중...")
        logger.info(f"   이유: {decision['reason']}")
        
        # ✅ 메시지 생성
        message = generate_simple_message(decision["reason"], decision.get("context"))
        
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





# async def simple_judgment(user_id: str) -> bool:
#     """
#     간단한 판단 로직 (테스트용)
#     Task 1.1에서 고도화 예정
#     """
#     # 오늘 2번 이상 개입했으면 안 함
#     today_count = await intervention_repo.count_today(user_id)
    
#     if today_count >= 2:
#         logger.info(f"⏭️ 빈도 제한: 오늘 {today_count}번 개입")
#         return False
    
#     # 테스트: 50% 확률
#     import random
#     return random.random() > 0.5






async def process_missed_emotions(supabase: AsyncClient) -> None:
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


async def periodic_check(supabase: AsyncClient) -> None:
    """5분마다 놓친 감정 체크"""
    while True:
        await asyncio.sleep(5 * 60)  # 5분 대기
        await process_missed_emotions(supabase)


def on_postgres_changes(supabase: AsyncClient, payload: Dict[str, Any]) -> None:
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


async def initial_check(supabase: AsyncClient) -> None:
    """초기 놓친 감정 체크 (5초 후)"""
    await asyncio.sleep(5)
    await process_missed_emotions(supabase)


async def main() -> None:
    """메인 비동기 진입점"""
    global intervention_repo

    logger.info("🚀 AI 에이전트 워커 시작...")
    logger.info(f"📡 Supabase URL: {os.getenv('SUPABASE_URL')}")

    supabase = await create_supabase_client()
    intervention_repo = InterventionRepository(supabase)

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

    # 병렬 실행: 초기 체크 + 주기적 체크
    await asyncio.gather(
        initial_check(supabase),    # 5초 후 초기 체크
        periodic_check(supabase),   # 5분마다 체크 (무한 루프)
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 워커 정상 종료됨")