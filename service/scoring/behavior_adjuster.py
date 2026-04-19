"""
누적 피드백 점수 기반 에이전트 행동 조정
"""
import logging
from typing import Optional
from supabase import Client

logger = logging.getLogger(__name__)


async def get_feedback_trend(
    supabase: Client,
    user_id: str,
    limit: int = 5
) -> Optional[float]:
    """
    최근 scored intervention들의 평균 feedback_score 반환.
    scored 기록이 없으면 None.
    """
    try:
        result = await supabase.table("interventions") \
            .select("feedback_score") \
            .eq("user_id", user_id) \
            .not_.is_("feedback_score", "null") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()

        rows = result.data if hasattr(result, "data") and result.data else []
        if not rows:
            return None

        scores = [r["feedback_score"] for r in rows if r.get("feedback_score") is not None]
        avg = sum(scores) / len(scores) if scores else None
        logger.debug(f"피드백 트렌드: user={user_id}, avg={avg:.2f} ({len(scores)}개)")
        return avg

    except Exception as e:
        logger.error(f"❌ 피드백 트렌드 조회 실패: {e}")
        return None


def get_adjusted_max_per_day(avg_score: Optional[float], base: int = 2) -> int:
    """
    평균 피드백 점수에 따라 하루 최대 개입 횟수 조정.
        avg ≥ 2  → +1 (반응 좋음)
        avg < 0  → -1 (반응 나쁨), 최소 1
        그 외    → base 유지
    """
    if avg_score is None:
        return base
    if avg_score >= 2:
        return base + 1
    if avg_score < 0:
        return max(1, base - 1)
    return base


def get_behavior_note(avg_score: Optional[float]) -> str:
    """
    평균 점수에 따른 LLM 행동 힌트 문장.
    프롬프트 끝에 덧붙여 사용.
    """
    if avg_score is None:
        return ""
    if avg_score >= 2:
        return "최근 사용자 반응이 긍정적입니다. 더 따뜻하게 공감해도 됩니다."
    if avg_score < 0:
        return "최근 사용자 반응이 좋지 않았습니다. 더 짧고 조심스럽게 접근하세요."
    return ""
