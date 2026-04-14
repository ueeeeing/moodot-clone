from typing import Dict, Any
from .base import Rule, InterventionTone
from models import InterventionReason


class PositiveStreakRule(Rule):
    """
    연속 긍정 감정 탐지

    - 연속 3개 이상 긍정 감정(good, calm) 발견 시 긍정 강화 개입
    - 개수에 따라 톤 조절 (3개: 격려, 4개: 밝은, 5개+: 축하)
    """

    priority = 4  # 부정 규칙보다 낮은 우선순위
    name = "positive_streak"

    def __init__(self, threshold: int = 3):
        self.threshold = threshold

    async def check(self, context: Dict[str, Any]) -> bool:
        self.last_context = context
        consecutive = context.get('consecutive_positive', 0)
        return consecutive >= self.threshold

    def get_reason(self) -> str:
        return InterventionReason.POSITIVE_REINFORCEMENT.value

    def get_severity(self, context: Dict[str, Any]) -> int:
        """연속 개수로 심각도 판단"""
        consecutive = context.get('consecutive_positive', 0)

        if consecutive >= 5:
            return 3  # 장기 긍정 → 축하
        elif consecutive >= 4:
            return 2  # 연속 긍정 → 밝은
        return 1      # 보통 → 격려

    def get_tone(self) -> InterventionTone:
        if not self.last_context:
            return InterventionTone.ENCOURAGING

        severity = self.get_severity(self.last_context)
        return InterventionTone.from_context('positive_reinforcement', severity)

    def get_context_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'consecutive_positive': context.get('consecutive_positive', 0),
            'severity': self.get_severity(context),
            'recent_emotions': [
                e['emotion_name']
                for e in context.get('recent_emotions', [])[:5]
            ]
        }
