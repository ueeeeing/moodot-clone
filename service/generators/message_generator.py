# generators/message_generator.py
"""
LLM 기반 메시지 생성기
"""
import logging
from typing import Dict, Any
from config.base_llm import BaseLLMProvider

from prompts import (
    SYSTEM_PROMPT,
    get_prompt_template,
    format_emotion_list,
    format_emotion_distribution,
    EMOTION_NAMES_KR
)

logger = logging.getLogger(__name__)


class MessageGenerator:
    """LLM 기반 메시지 생성 (프로바이더 독립적)"""

    def __init__(self, llm: BaseLLMProvider):
        """
        Args:
            llm: BaseLLMProvider 구현체 (OllamaProvider, OpenAIProvider 등)
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
        """
        try:
            formatted_context, template_key = self._format_context(reason, context)

            template = get_prompt_template(template_key)
            prompt = template.format(system_prompt=SYSTEM_PROMPT, **formatted_context)

            logger.debug(f"생성할 프롬프트:\n{prompt}")

            message, usage = self.llm.generate(prompt)

            metadata = {
                "generation_method": "llm_generated",
                "model": self.llm.model_name,
                "llm_tokens_used": usage.get("total_tokens", 0),
                "generation_cost": usage.get("total_cost", 0),
            }

            logger.info(f"✅ 메시지 생성 완료: {message}")
            return message, metadata

        except Exception as e:
            logger.error(f"❌ 메시지 생성 실패: {e}", exc_info=True)

            fallback = self._get_fallback_message(reason, context)
            metadata = {
                "generation_method": "template_fallback",
                "model": self.llm.model_name,
                "error": str(e),
            }
            return fallback, metadata

    def _format_context(self, reason: str, context: Dict[str, Any]) -> tuple[Dict[str, Any], str]:
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

            if consecutive >= 3:
                formatted = {
                    "consecutive_count": consecutive,
                    "recent_emotions": format_emotion_list(context.get("recent_emotions", []))
                }
                return formatted, "negative_pattern"
            else:
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
                "recent_emotions": format_emotion_list(context.get("recent_emotions", []))
            }
            return formatted, "positive_reinforcement"

        else:
            return {"context": str(context)}, reason

    def _get_fallback_message(self, reason: str, context: Dict[str, Any] = None) -> str:
        context = context or {}

        if reason == "no_recent_record":
            days = context.get("days_since_last_record", 3)
            return f"요즘 어때? {days}일 동안 소식이 없었네! 궁금해 😊"
        elif reason == "negative_pattern":
            consecutive = context.get("consecutive_negative", 0)
            if consecutive >= 3:
                return "요즘 힘든 일이 계속되는 것 같아. 괜찮아? 💙"
            return "최근에 많이 힘들어 보여. 무슨 일 있어? 🤗"
        elif reason == "positive_reinforcement":
            return "좋은 일들이 계속되고 있네! 축하해 🎉"

        return "안녕? 오늘 하루 어때? 😊"

    def generate_with_validation(
        self,
        reason: str,
        context: Dict[str, Any],
        max_length: int = 100
    ) -> tuple[str, Dict[str, Any]]:
        message, metadata = self.generate(reason, context)

        if len(message) > max_length:
            logger.warning(f"메시지 너무 길음: {len(message)} > {max_length}")
            message = message[:max_length] + "..."
            metadata["length_truncated"] = True

        forbidden_words = [
            "우울증", "조울증", "정신병", "정신질환",
            "약", "치료", "정신과", "상담", "병원",
            "자살", "자해", "죽음", "포기",
            "진단", "증상", "장애"
        ]

        for word in forbidden_words:
            if word in message:
                logger.warning(f"금지어 발견: {word}")
                message = self._get_fallback_message(reason, context)
                metadata["validation_failed"] = True
                metadata["forbidden_word"] = word
                break

        sentence_endings = ["다.", "요.", "까.", "네.", "어.", "야.", "?", "!"]
        sentence_count = sum(message.count(e) for e in sentence_endings)

        if sentence_count > 1:
            logger.warning(f"문장이 너무 많음: {sentence_count}개")
            for ending in sentence_endings:
                if ending in message:
                    message = message[: message.index(ending) + len(ending)]
                    metadata["sentence_truncated"] = True
                    break

        return message, metadata

    def set_temperature(self, temperature: float):
        """온도 설정 (프로바이더가 지원하는 경우)"""
        if hasattr(self.llm, "_llm") and hasattr(self.llm._llm, "temperature"):
            self.llm._llm.temperature = temperature
            logger.info(f"LLM temperature 설정: {temperature}")
        else:
            logger.warning("현재 프로바이더는 temperature 설정을 지원하지 않음")
