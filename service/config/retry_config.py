"""
재시도 설정

실제 재시도 로직 적용은 Phase 3 (LangGraph) 전환 시 함께 구현.
현재는 설정값만 정의.
"""


class RetryConfig:
    """재시도 관련 설정값"""

    # 재시도 횟수
    MAX_ATTEMPTS = 3

    # Exponential Backoff 대기 시간 (초)
    WAIT_MIN = 2
    WAIT_MAX = 10

    # 적용 대상 (Phase 3에서 LangGraph 노드 단위로 적용 예정)
    # - InterventionRepository.create()
    # - MessageGenerator.generate()
    # - mark_as_processed()
