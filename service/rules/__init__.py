# agents/rules/__init__.py
"""
Rule Engine 패키지

개입 판단 규칙을 관리합니다.

Example:
    >>> from agents.rules import RuleEngine
    >>> engine = RuleEngine(supabase)
    >>> result = await engine.evaluate(user_id)
"""

from .base import Rule, InterventionTone
from .engine import RuleEngine
from .frequency_limit import FrequencyLimitRule
from .no_recent_record import NoRecentRecordRule
from .negative_streak import NegativeStreakRule
from .negative_ratio import NegativeRatioRule
from .positive_streak import PositiveStreakRule

__all__ = [
    'Rule',
    'InterventionTone',
    'RuleEngine',
    'FrequencyLimitRule',
    'NoRecentRecordRule',
    'NegativeStreakRule',
    'NegativeRatioRule',
    'PositiveStreakRule',
]