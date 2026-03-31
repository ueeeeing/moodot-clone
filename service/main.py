# main.py
import os
import asyncio
import logging
from dotenv import load_dotenv
from supabase import acreate_client, AsyncClient
from typing import Dict, Any

# 환경 변수 로드
load_dotenv('.env.local')

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def handle_new_emotion(supabase: AsyncClient, payload: Dict[str, Any]) -> None:
    """
    새로운 감정 이벤트 처리

    Args:
        supabase: Supabase 비동기 클라이언트
        payload: Supabase Realtime 이벤트 페이로드
    """
    try:
        emotion = payload['record']

        # emotion_id로 emotion_categories 테이블에서 감정 이름 조회
        emotion_id = emotion['emotion_id']
        category_result = await supabase.table('emotion_categories')\
            .select('emotion')\
            .eq('emotion_id', emotion_id)\
            .single()\
            .execute()
        emotion_name = category_result.data['emotion'] if category_result.data else 'N/A'

        logger.info("=" * 50)
        logger.info("📥 새 감정 감지!")
        logger.info(f"   ID: {emotion['id']}")
        logger.info(f"   감정: {emotion_name}")
        logger.info(f"   내용: {emotion.get('text', 'N/A')}")
        logger.info(f"   시간: {emotion['created_at']}")
        logger.info("=" * 50)

        # TODO: 나중에 AI 판단 로직 추가 (Task 1.1)
        # decision = await judge_intervention(emotion['user_id'])
        # if decision['should_intervene']:
        #     message = await generate_message(decision)
        #     await save_intervention(message)

        # 처리 완료 표시
        await mark_as_processed(supabase, emotion['id'])

        logger.info(f"✅ 감정 처리 완료: {emotion['id']}\n")

    except Exception as e:
        logger.error(f"❌ 이벤트 처리 중 에러: {e}", exc_info=True)


async def mark_as_processed(supabase: AsyncClient, emotion_id: str) -> None:
    """
    감정을 처리 완료 상태로 변경

    Args:
        supabase: Supabase 비동기 클라이언트
        emotion_id: 감정 레코드 ID
    """
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


async def process_missed_emotions(supabase: AsyncClient) -> None:
    """
    워커가 다운되었을 때 놓친 감정 처리
    (안전장치)
    """
    logger.info("🔍 놓친 감정 확인 중...")

    try:
        from datetime import datetime, timedelta
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
        await asyncio.sleep(5 * 60)
        await process_missed_emotions(supabase)


async def main() -> None:
    """메인 비동기 진입점"""
    logger.info("🚀 AI 에이전트 워커 시작...")
    logger.info(f"📡 Supabase URL: {os.getenv('SUPABASE_URL')}")

    supabase: AsyncClient = await acreate_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )

    def on_postgres_changes(payload: Dict[str, Any]) -> None:
        event_type = payload.get('eventType')
        if event_type == 'INSERT':
            asyncio.create_task(handle_new_emotion(supabase, payload))
        else:
            logger.debug(f"무시된 이벤트 타입: {event_type}")

    channel = supabase.channel('emotion_events')
    channel.on_postgres_changes(
        event='INSERT',
        schema='public',
        table='memories',
        callback=on_postgres_changes
    )
    await channel.subscribe()

    logger.info("✅ Realtime 구독 시작!")
    logger.info("👂 이벤트 대기 중... (Ctrl+C로 종료)")

    # 5초 후 초기 놓친 감정 체크
    await asyncio.sleep(5)
    await process_missed_emotions(supabase)

    # 5분 주기 체크 실행
    await periodic_check(supabase)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 워커 정상 종료됨")
