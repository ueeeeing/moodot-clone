# agents/rules/negative_ratio.py
from typing import Dict, Any
from .base import Rule, InterventionTone
from models import InterventionReason

class NegativeRatioRule(Rule):
    """
    부정 감정 비율 탐지
    
    - 최근 7일 중 70% 이상이 부정 감정이면 개입
    - 비율에 따라 톤 조절 (70%: 지지, 80%: 위로, 90%+: 걱정)
    """
    
    priority = 3  # 낮은 우선순위
    name = "negative_ratio"
    
    def __init__(self, threshold_ratio: float = 0.7, min_count: int = 5,
                 severity_2_at: float = 0.8, severity_3_at: float = 0.9):
        self.threshold_ratio = threshold_ratio
        self.min_count = min_count
        self.severity_2_at = severity_2_at
        self.severity_3_at = severity_3_at
    
    async def check(self, context: Dict[str, Any]) -> bool:
        self.last_context = context
        stats = context.get('emotion_stats', {})
        
        total_count = stats.get('total_count', 0)
        negative_count = stats.get('negative_count', 0)
        
        # 최소 기록 수 체크
        if total_count < self.min_count:
            return False
        
        # 부정 비율 계산
        negative_ratio = negative_count / total_count
        
        return negative_ratio >= self.threshold_ratio
    
    def get_reason(self) -> str:
        return InterventionReason.NEGATIVE_PATTERN.value
    
    def get_severity(self, context: Dict[str, Any]) -> int:
        """부정 비율로 심각도 판단"""
        stats = context.get('emotion_stats', {})
        total = stats.get('total_count', 1)
        negative = stats.get('negative_count', 0)
        ratio = negative / total if total > 0 else 0
        
        if ratio >= self.severity_3_at:
            return 3  # 심각
        elif ratio >= self.severity_2_at:
            return 2  # 중간
        return 1      # 보통
    
    def get_tone(self) -> InterventionTone:
        """컨텍스트 기반 동적 톤 선택"""
        if not self.last_context:
            return InterventionTone.SUPPORTIVE
        
        severity = self.get_severity(self.last_context)
        return InterventionTone.from_context('negative_pattern', severity)
    
    def get_context_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        stats = context.get('emotion_stats', {})
        total = stats.get('total_count', 1)
        negative = stats.get('negative_count', 0)
        
        return {
            'negative_ratio': round(negative / total, 2) if total > 0 else 0,
            'total_count': total,
            'negative_count': negative,
            'severity': self.get_severity(context),
            'emotion_distribution': stats.get('emotion_distribution', {})
        }