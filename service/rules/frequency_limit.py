# agents/rules/frequency_limit.py
from typing import Dict, Any
from .base import Rule
from scoring import get_adjusted_max_per_day

class FrequencyLimitRule(Rule):
    """
    빈도 제한 규칙 (거부권)
    
    - 하루 2번 이상 개입 금지
    - 최소 4시간 간격 유지
    
    이 규칙이 True를 반환하면 개입하지 않습니다 (부정 규칙).
    """
    
    priority = 0  # 최우선
    name = "frequency_limit"
    
    def __init__(self, max_per_day: int = 2, min_hours_between: int = 4):
        self.max_per_day = max_per_day
        self.min_hours_between = min_hours_between
    
    async def check(self, context: Dict[str, Any]) -> bool:
        """
        빈도 제한 체크 (부정 로직)
        
        Returns:
            True: 제한 초과 (개입 금지)
            False: 제한 내 (다음 규칙으로)
        """
        # 피드백 트렌드 기반 동적 한도
        effective_max = get_adjusted_max_per_day(
            context.get('feedback_avg_score'), base=self.max_per_day
        )

        if context['today_count'] >= effective_max:
            return True
        
        # 마지막 개입 시간 체크
        hours_since = context.get('hours_since_last')
        if hours_since is not None and hours_since < self.min_hours_between:
            return True
        
        return False  # 통과
    
    def get_reason(self) -> str:
        return "frequency_limit"
    
    def is_negative_rule(self) -> bool:
        """이 규칙은 개입을 막는 부정 규칙입니다."""
        return True