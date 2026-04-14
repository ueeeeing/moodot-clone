# agents/rules/negative_streak.py
from typing import Dict, Any
from .base import Rule, InterventionTone
from models import InterventionReason

class NegativeStreakRule(Rule):
    """
    연속 부정 감정 탐지
    
    - 연속 3개 이상 부정 감정(bad, sad) 발견 시 개입
    - 개수에 따라 톤 조절 (3개: 공감, 4개: 지지, 5개+: 걱정)
    """
    
    priority = 1  # 높은 우선순위 (긴급)
    name = "negative_streak"
    
    def __init__(self, threshold: int = 3):
        self.threshold = threshold
    
    async def check(self, context: Dict[str, Any]) -> bool:
        self.last_context = context  # 컨텍스트 저장
        consecutive = context.get('consecutive_negative', 0)
        return consecutive >= self.threshold
    
    def get_reason(self) -> str:
        return InterventionReason.NEGATIVE_PATTERN.value

    def get_severity(self, context: Dict[str, Any]) -> int:
        """연속 개수로 심각도 판단"""
        consecutive = context.get('consecutive_negative', 0)

        if consecutive >= 5:
            return 3  # 심각
        elif consecutive >= 4:
            return 2  # 중간
        return 1      # 보통

    def get_tone(self) -> InterventionTone:
        """컨텍스트 기반 동적 톤 선택"""
        if not self.last_context:
            return InterventionTone.EMPATHETIC

        severity = self.get_severity(self.last_context)
        return InterventionTone.from_context('negative_pattern', severity)
    
    def get_context_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            'consecutive_negative': context.get('consecutive_negative', 0),
            'severity': self.get_severity(context),
            'recent_emotions': [
                e['emotion_name'] 
                for e in context.get('recent_emotions', [])[:5]
            ]
        }