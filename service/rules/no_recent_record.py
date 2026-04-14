# agents/rules/no_recent_record.py
from typing import Dict, Any
from .base import Rule, InterventionTone
from models import InterventionReason

class NoRecentRecordRule(Rule):
    """
    장기간 미기록 탐지
    
    - 3일 이상 감정 기록이 없으면 개입
    - 일수에 따라 톤 조절 (3일: 궁금, 5일: 친근, 7일+: 걱정)
    """
    
    priority = 2  # 중간 우선순위
    name = "no_recent_record"
    
    def __init__(self, threshold_days: int = 3, severity_2_at: int = 5, severity_3_at: int = 7):
        self.threshold_days = threshold_days
        self.severity_2_at = severity_2_at
        self.severity_3_at = severity_3_at
    
    async def check(self, context: Dict[str, Any]) -> bool:
        self.last_context = context
        days_since = context.get('days_since_last_record')
        
        if days_since is None:
            return False
        
        return days_since >= self.threshold_days
    
    def get_reason(self) -> str:
        return InterventionReason.NO_RECENT_RECORD.value
    
    def get_severity(self, context: Dict[str, Any]) -> int:
        """일수로 심각도 판단"""
        days_since = context.get('days_since_last_record', 0)
        
        if days_since >= self.severity_3_at:
            return 3  # 심각 (일주일 이상)
        elif days_since >= self.severity_2_at:
            return 2  # 중간
        return 1      # 보통
    
    def get_tone(self) -> InterventionTone:
        """컨텍스트 기반 동적 톤 선택"""
        if not self.last_context:
            return InterventionTone.CURIOUS
        
        severity = self.get_severity(self.last_context)
        return InterventionTone.from_context('no_recent_record', severity)
    
    def get_context_data(self, context: Dict[str, Any]) -> Dict[str, Any]:
        days = context.get('days_since_last_record', 0)
        return {
            'days_since_last_record': days,
            'severity': self.get_severity(context)
        }