# config/llm_factory.py
"""
LLM 프로바이더 팩토리
환경변수 LLM_PROVIDER로 프로바이더를 선택합니다.

지원 프로바이더:
  - ollama  (기본값, 로컬)

추가 예정:
  - openai  → OpenAIProvider
  - claude  → ClaudeProvider
"""
import os
import logging

from .base_llm import BaseLLMProvider

logger = logging.getLogger(__name__)

_SUPPORTED = ["ollama", "openai"]


class LLMFactory:
    @staticmethod
    def create(provider: str = None, **kwargs) -> BaseLLMProvider:
        """
        LLM 프로바이더 인스턴스 생성

        Args:
            provider: 프로바이더 이름. None이면 LLM_PROVIDER 환경변수 사용 (기본: "ollama")
            **kwargs: 각 프로바이더 생성자에 전달되는 옵션

        Returns:
            BaseLLMProvider 구현체

        Raises:
            ValueError: 지원하지 않는 프로바이더
        """
        provider = provider or os.getenv("LLM_PROVIDER", "ollama")

        if provider == "ollama":
            from .ollama_provider import OllamaProvider
            return OllamaProvider(**kwargs)

        elif provider == "openai":
            from .openai_provider import OpenAIProvider
            return OpenAIProvider(**kwargs)

        # 새 프로바이더 추가 시 여기에 elif 블록을 추가하세요.
        # elif provider == "claude":
        #     from .claude_provider import ClaudeProvider
        #     return ClaudeProvider(**kwargs)

        raise ValueError(
            f"지원하지 않는 LLM 프로바이더: '{provider}'\n"
            f"지원 목록: {_SUPPORTED}"
        )
