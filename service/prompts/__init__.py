# prompts/__init__.py
"""
메시지 생성용 프롬프트 모듈
"""

from .message_prompts import (
    # 시스템 프롬프트
    SYSTEM_PROMPT,
    
    # 템플릿들
    NO_RECENT_RECORD_TEMPLATE,
    NEGATIVE_PATTERN_TEMPLATE,  # ✅ NEGATIVE_STREAK → NEGATIVE_PATTERN
    POSITIVE_REINFORCEMENT_TEMPLATE,  # ✅ 추가
    NEGATIVE_RATIO_TEMPLATE,  # ✅ 추가
    DEFAULT_TEMPLATE,  # ✅ 추가
    
    # 함수들
    get_prompt_template,
    
    # 헬퍼 함수들 (선택적)
    format_emotion_list,
    format_emotion_distribution,
    EMOTION_NAMES_KR,
)

__all__ = [
    # 시스템 프롬프트
    'SYSTEM_PROMPT',
    
    # 템플릿들
    'NO_RECENT_RECORD_TEMPLATE',
    'NEGATIVE_PATTERN_TEMPLATE',
    'POSITIVE_REINFORCEMENT_TEMPLATE',
    'NEGATIVE_RATIO_TEMPLATE',
    'DEFAULT_TEMPLATE',
    
    # 함수들
    'get_prompt_template',
    
    # 헬퍼 함수들
    'format_emotion_list',
    'format_emotion_distribution',
    'EMOTION_NAMES_KR',
]
