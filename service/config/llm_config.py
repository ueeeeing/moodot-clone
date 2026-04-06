# config/llm_config.py
"""
LangChain 및 Ollama LLM 설정
"""
import os
import logging
from typing import Optional
from langchain_community.llms import Ollama
from langchain_community.chat_models import ChatOllama
import ollama as ollama_client

logger = logging.getLogger(__name__)


class LLMConfig:
    """Ollama LLM 설정 및 초기화"""
    
    # 모델 설정
    DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:latest")
    BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    TEMPERATURE = 0.5  # 창의성 (0=결정적, 1=창의적)
    NUM_PREDICT = 100  # 최대 토큰 (한 문장이면 충분)
    
    @staticmethod
    def check_ollama_server() -> bool:
        """Ollama 서버 연결 확인"""
        try:
            client = ollama_client.Client(host=LLMConfig.BASE_URL)
            client.list()
            return True
        except Exception as e:
            logger.error(f"❌ Ollama 서버 연결 실패: {e}")
            return False
    
    @staticmethod
    def check_model_exists(model: str) -> bool:
        """모델 존재 확인"""
        try:
            client = ollama_client.Client(host=LLMConfig.BASE_URL)
            models = client.list()
            model_names = [m['name'] for m in models.get('models', [])]
            return model in model_names
        except Exception as e:
            logger.error(f"❌ 모델 확인 실패: {e}")
            return False
    
    @staticmethod
    def create_llm(
        model: str = DEFAULT_MODEL,
        temperature: float = TEMPERATURE,
        num_predict: int = NUM_PREDICT
    ) -> ChatOllama:
        """
        Ollama LLM 인스턴스 생성
        
        Args:
            model: 모델 이름
            temperature: 온도 (0-1)
            num_predict: 최대 생성 토큰
            
        Returns:
            ChatOllama 인스턴스
        """
        # 서버 확인
        if not LLMConfig.check_ollama_server():
            raise ConnectionError(
                "Ollama 서버에 연결할 수 없습니다.\n"
                "다음 명령어로 시작하세요: ollama serve"
            )
        
        # 모델 확인
        if not LLMConfig.check_model_exists(model):
            raise ValueError(
                f"모델 '{model}'를 찾을 수 없습니다.\n"
                f"다음 명령어로 다운로드하세요: ollama pull {model}"
            )
        
        llm = ChatOllama(
            model=model,
            base_url=LLMConfig.BASE_URL,
            temperature=temperature,
            num_predict=num_predict,
        )
        
        logger.info(f"✅ Ollama LLM 초기화: model={model}, temp={temperature}")
        return llm
    
    @staticmethod
    def get_model_info():
        """사용 가능한 모델 정보"""
        return {
            "llama3.2:1b": {
                "size": "1.3GB",
                "speed": "매우 빠름",
                "quality": "보통",
                "cost": "무료 (로컬)",
                "best_for": "빠른 테스트"
            },
            "llama3.2:3b": {
                "size": "2GB",
                "speed": "빠름",
                "quality": "좋음",
                "cost": "무료 (로컬)",
                "best_for": "프로덕션 (추천)"
            },
            "mistral": {
                "size": "4.1GB",
                "speed": "보통",
                "quality": "매우 좋음",
                "cost": "무료 (로컬)",
                "best_for": "고품질 필요 시"
            },
            "llama3:8b": {
                "size": "4.7GB",
                "speed": "보통",
                "quality": "최고",
                "cost": "무료 (로컬)",
                "best_for": "최고 품질"
            }
        }
    
    @staticmethod
    def list_available_models():
        """로컬에 다운로드된 모델 목록"""
        try:
            client = ollama_client.Client(host=LLMConfig.BASE_URL)
            models = client.list()
            return [m['name'] for m in models.get('models', [])]
        except Exception as e:
            logger.error(f"❌ 모델 목록 조회 실패: {e}")
            return []


def call_llm_with_tracking(llm: ChatOllama, prompt: str) -> tuple[str, dict]:
    """
    LLM 호출 with 메타데이터 추적
    
    Args:
        llm: ChatOllama 인스턴스
        prompt: 프롬프트 텍스트
    
    Returns:
        (응답 텍스트, 사용량 정보)
    """
    import time
    
    start_time = time.time()
    
    try:
        # Ollama는 invoke 대신 chat 메서드 사용 가능
        from langchain.schema import HumanMessage
        
        response = llm.invoke([HumanMessage(content=prompt)])
        
        elapsed_time = time.time() - start_time
        
        # Ollama는 토큰 수를 직접 제공하지 않으므로 대략 추정
        # (한글 기준: 글자 수 * 1.5, 영문: 단어 수 * 1.3)
        prompt_tokens = len(prompt.split())
        completion_tokens = len(response.content.split())
        
        usage = {
            "elapsed_time": elapsed_time,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "total_cost": 0.0  # 로컬이라 비용 없음
        }
        
        logger.info(
            f"💬 Ollama 호출 완료: {elapsed_time:.2f}초, "
            f"~{usage['total_tokens']} 토큰"
        )
        
        return response.content, usage
        
    except Exception as e:
        logger.error(f"❌ Ollama 호출 실패: {e}")
        raise
