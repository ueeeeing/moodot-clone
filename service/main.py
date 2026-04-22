# main.py
import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from dotenv import load_dotenv
from supabase import acreate_client
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import JSONResponse
import uvicorn

load_dotenv('.env.local')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from models import InterventionRepository
from rules import RuleEngine
from config import LLMFactory
from generators import MessageGenerator
from agents import Pipeline

# ─── 전역 파이프라인 (lifespan에서 초기화) ────────────────────────────────────
_pipeline: Pipeline | None = None


async def create_supabase_client():
    client = await acreate_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )
    return client


# ─── FastAPI lifespan (startup / shutdown) ────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pipeline

    logger.info("🚀 AI Worker 시작...")
    logger.info(f"📡 Supabase URL: {os.getenv('SUPABASE_URL')}")

    supabase = await create_supabase_client()
    intervention_repo = InterventionRepository(supabase)
    rule_engine = RuleEngine(supabase)

    try:
        llm = LLMFactory.create()
        message_generator = MessageGenerator(llm)
        logger.info(f"✅ MessageGenerator 초기화 완료 ({llm.model_name})")
    except Exception as e:
        message_generator = None
        logger.warning(f"⚠️ LLM 연결 실패 — 템플릿 메시지로 동작합니다: {e}")

    _pipeline = Pipeline(supabase, intervention_repo, rule_engine, message_generator)
    logger.info("✅ AI Worker 준비 완료 — HTTP 요청 대기 중")

    yield

    logger.info("👋 AI Worker 종료됨")


# ─── FastAPI 앱 ───────────────────────────────────────────────────────────────

app = FastAPI(title="AI Worker", lifespan=lifespan)


@app.get("/health")
def health():
    """ECS / ALB 헬스체크 엔드포인트 — 롤백 테스트용: 항상 500 반환"""
    return JSONResponse({"status": "unhealthy"}, status_code=500)


@app.post("/ai/process")
async def process_emotion(payload: Dict[str, Any], background_tasks: BackgroundTasks):
    """
    Next.js가 메모리 저장 후 직접 호출하는 엔드포인트.

    Input — memories 테이블 레코드:
    {
        "id": 123,
        "user_id": "uuid",
        "emotion_id": 2,
        "created_at": "2024-01-01T00:00:00Z"
    }

    Output:
    { "status": "accepted" }

    처리는 BackgroundTask로 비동기 실행되며,
    결과(intervention)는 Supabase INSERT를 통해 프론트엔드에 전달됩니다.
    """
    if _pipeline is None:
        return JSONResponse({"error": "worker not ready"}, status_code=503)

    background_tasks.add_task(_pipeline.process_emotion, {"record": payload})
    return {"status": "accepted"}


# ─── 진입점 ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
