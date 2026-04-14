# config/base_llm.py
"""
LLM 프로바이더 추상 인터페이스
새로운 LLM을 추가하려면 BaseLLMProvider를 상속하고 generate()와 model_name을 구현하세요.
"""
from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    """LLM 프로바이더 공통 인터페이스"""

    @abstractmethod
    def generate(self, prompt: str) -> tuple[str, dict]:
        """
        LLM 호출

        Args:
            prompt: 입력 프롬프트

        Returns:
            (response_text, usage_metadata)
            usage_metadata 필수 키:
                - elapsed_time (float): 소요 시간 (초)
                - total_tokens (int): 총 토큰 수 (추정 포함)
                - total_cost (float): 비용 (USD)
        """
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """현재 사용 중인 모델 이름"""
        pass
