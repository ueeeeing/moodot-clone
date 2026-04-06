# generators/message_generator.py
"""
LLM 기반 메시지 생성기 (Ollama)
"""
import logging
from typing import Dict, Any, Optional
from langchain_community.chat_models import ChatOllama

from config import call_llm_with_tracking
from prompts import (
    SYSTEM_PROMPT,
    get_prompt_template,
    format_emotion_list,
    format_emotion_distribution,
    EMOTION_NAMES_KR
)

logger = logging.getLogger(__name__)


class MessageGenerator:
    """LLM 기반 메시지 생성 (Ollama)"""
    
    def __init__(self, llm: ChatOllama):
        """
        Args:
            llm: ChatOllama 인스턴스
        """
        self.llm = llm
    
    def generate(
        self,
        reason: str,
        context: Dict[str, Any]
    ) -> tuple[str, Dict[str, Any]]:
        """
        상황에 맞는 메시지 생성

        Args:
            reason: 개입 이유 (InterventionReason enum 값)
                - "no_recent_record": 장기간 미기록
                - "negative_pattern": 부정 감정 패턴
                - "positive_reinforcement": 긍정 강화
            context: 컨텍스트 정보

        Returns:
            (생성된 메시지, 메타데이터)

        Example:
            >>> generator = MessageGenerator(llm)
            >>> message, metadata = generator.generate(
            ...     "no_recent_record",
            ...     {"days_since_last_record": 3, "last_emotion": "good"}
            ... )
        """
        try:
            # ✅ 컨텍스트 포맷팅
            formatted_context, template_key = self._format_context(reason, context)

            # 프롬프트 템플릿 가져오기
            template = get_prompt_template(template_key)
            
            # 프롬프트 생성
            prompt_input = {
                "system_prompt": SYSTEM_PROMPT,
                **formatted_context
            }
            
            prompt = template.format(**prompt_input)
            
            logger.debug(f"생성할 프롬프트:\n{prompt}")
            
            # LLM 호출
            message, usage = call_llm_with_tracking(self.llm, prompt)
            
            # 메타데이터 (Ollama는 비용 없음)
            metadata = {
                "generation_method": "ollama_generated",
                "model": self.llm.model,
                "llm_tokens_used": usage.get('total_tokens', 0),
                "generation_cost": 0  # Ollama는 로컬이므로 비용 없음
            }
            
            logger.info(f"✅ 메시지 생성 완료: {message}")
            
            return message, metadata
            
        except Exception as e:
            logger.error(f"❌ 메시지 생성 실패: {e}", exc_info=True)
            
            # Fallback: 템플릿 사용
            fallback = self._get_fallback_message(reason, context)
            metadata = {
                "generation_method": "template_fallback",
                "model": getattr(self.llm, 'model', 'unknown'),
                "error": str(e)
            }
            
            return fallback, metadata
    
    def _format_context(self, reason: str, context: Dict[str, Any]) -> tuple[Dict[str, Any], str]:
        """
        컨텍스트를 프롬프트에 맞게 포맷팅

        Args:
            reason: 개입 이유
            context: 원본 컨텍스트

        Returns:
            (포맷팅된 컨텍스트, 템플릿 키)
        """
        if reason == "no_recent_record":
            formatted = {
                "days_since": context.get("days_since_last_record", 3),
                "last_emotion": EMOTION_NAMES_KR.get(
                    context.get("last_emotion", "good"),
                    "알 수 없음"
                )
            }
            return formatted, "no_recent_record"

        elif reason == "negative_pattern":
            consecutive = context.get("consecutive_negative", 0)
            recent_emotions = context.get("recent_emotions", [])

            if consecutive >= 3:
                # 연속 부정 감정
                formatted = {
                    "consecutive_count": consecutive,
                    "recent_emotions": format_emotion_list(recent_emotions)
                }
                return formatted, "negative_pattern"
            else:
                # 부정 감정 비율 (다른 템플릿 사용)
                formatted = {
                    "negative_ratio": int(context.get("negative_ratio", 0) * 100),
                    "total_count": context.get("total_count", 0),
                    "emotion_distribution": format_emotion_distribution(
                        context.get("emotion_distribution", {})
                    )
                }
                return formatted, "negative_ratio"

        elif reason == "positive_reinforcement":
            formatted = {
                "consecutive_count": context.get("consecutive_positive", 0),
                "recent_emotions": format_emotion_list(
                    context.get("recent_emotions", [])
                )
            }
            return formatted, "positive_reinforcement"

        else:
            return {"context": str(context)}, reason
    
    def _get_fallback_message(self, reason: str, context: Dict[str, Any] = None) -> str:
        """
        Fallback 템플릿 메시지
        
        Args:
            reason: 개입 이유
            context: 컨텍스트 (동적 메시지용)
            
        Returns:
            Fallback 메시지
        """
        context = context or {}
        
        # ✅ InterventionReason에 맞춘 메시지
        if reason == "no_recent_record":
            days = context.get("days_since_last_record", 3)
            return f"요즘 어때? {days}일 동안 소식이 없었네! 궁금해 😊"
        
        elif reason == "negative_pattern":
            consecutive = context.get("consecutive_negative", 0)
            if consecutive >= 3:
                return f"요즘 힘든 일이 계속되는 것 같아. 괜찮아? 💙"
            else:
                return "최근에 많이 힘들어 보여. 무슨 일 있어? 🤗"
        
        elif reason == "positive_reinforcement":
            return "좋은 일들이 계속되고 있네! 축하해 🎉"
        
        # 기본 메시지
        return "안녕? 오늘 하루 어때? 😊"
    
    def generate_with_validation(
        self,
        reason: str,
        context: Dict[str, Any],
        max_length: int = 100
    ) -> tuple[str, Dict[str, Any]]:
        """
        검증이 포함된 메시지 생성
        
        Args:
            reason: 개입 이유
            context: 컨텍스트
            max_length: 최대 길이
            
        Returns:
            (검증된 메시지, 메타데이터)
        """
        message, metadata = self.generate(reason, context)
        
        # 길이 검증
        if len(message) > max_length:
            logger.warning(f"메시지 너무 길음: {len(message)} > {max_length}")
            message = message[:max_length] + "..."
            metadata['length_truncated'] = True
        
        # ✅ 금지어 검증 (더 포괄적으로)
        forbidden_words = [
            # 의학적 용어
            '우울증', '조울증', '정신병', '정신질환',
            '약', '치료', '정신과', '상담', '병원',
            # 위험 관련
            '자살', '자해', '죽음', '포기',
            # 진단 관련
            '진단', '증상', '장애'
        ]
        
        for word in forbidden_words:
            if word in message:
                logger.warning(f"금지어 발견: {word}")
                message = self._get_fallback_message(reason, context)
                metadata['validation_failed'] = True
                metadata['forbidden_word'] = word
                break
        
        # ✅ 문장 수 검증 (한 문장만)
        sentence_endings = ['다.', '요.', '까.', '네.', '어.', '야.', '?', '!']
        sentence_count = sum(message.count(ending) for ending in sentence_endings)
        
        if sentence_count > 1:
            logger.warning(f"문장이 너무 많음: {sentence_count}개")
            # 첫 문장만 추출
            for ending in sentence_endings:
                if ending in message:
                    first_sentence_end = message.index(ending) + len(ending)
                    message = message[:first_sentence_end]
                    metadata['sentence_truncated'] = True
                    break
        
        return message, metadata
    
    def set_temperature(self, temperature: float):
        """
        LLM 온도 설정 (생성 다양성 조절)
        
        Args:
            temperature: 0.0 (일관성) ~ 1.0 (창의성)
        """
        if hasattr(self.llm, 'temperature'):
            self.llm.temperature = temperature
            logger.info(f"LLM temperature 설정: {temperature}")
        else:
            logger.warning("LLM이 temperature 설정을 지원하지 않음")
    
    def set_max_tokens(self, max_tokens: int):
        """
        최대 토큰 수 설정
        
        Args:
            max_tokens: 최대 토큰 수 (짧은 메시지용: 50-100)
        """
        if hasattr(self.llm, 'max_tokens'):
            self.llm.max_tokens = max_tokens
            logger.info(f"LLM max_tokens 설정: {max_tokens}")
        else:
            logger.warning("LLM이 max_tokens 설정을 지원하지 않음")
