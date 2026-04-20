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
from scoring import get_action_directive
from security import sanitize, validate_output

logger = logging.getLogger(__name__)


class MessageGenerator:
    """LLM 기반 메시지 생성 (프로바이더 독립적)"""

    def __init__(self, llm: BaseLLMProvider):
        """
        Args:
            llm: BaseLLMProvider 구현체 (OllamaProvider, OpenAIProvider 등)
        """
        self.llm = llm

    _RETRY_HINTS = {
        "pii": "이전 응답에 개인정보(전화번호, 이메일 등)가 포함되었습니다. 개인정보 없이 다시 작성해주세요.",
        "forbidden_word": "이전 응답에 의료·자해 관련 표현이 포함되었습니다. 해당 표현 없이 다시 작성해주세요.",
        "too_long": "이전 응답이 너무 깁니다. 더 짧게 한 문장으로 작성해주세요.",
        "too_many_sentences": "이전 응답이 두 문장 이상입니다. 반드시 한 문장으로만 작성해주세요.",
    }

    def generate(
        self,
        reason: str,
        context: Dict[str, Any],
        retry_reason: str | None = None,
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

            directive = get_action_directive(context.get("action", ""))
            if directive:
                prompt += f"\n행동 지침: {directive}"

            if retry_reason:
                hint_key = retry_reason.split(":")[0]
                hint = self._RETRY_HINTS.get(hint_key, "")
                if hint:
                    prompt += f"\n재작성 요청: {hint}"

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

    def _extract_recent_memories(self, recent_emotions: list, limit: int = 3) -> str:
        texts = [
            sanitize(e.get("text", "").strip())
            for e in recent_emotions[:limit]
            if e.get("text", "").strip()
        ]
        if not texts:
            return "(기록 내용 없음)"
        return "\n".join(f"- {t}" for t in texts)

    def _format_context(self, reason: str, context: Dict[str, Any]) -> tuple[Dict[str, Any], str]:
        recent_memories = self._extract_recent_memories(context.get("recent_emotions", []))

        if reason == "no_recent_record":
            formatted = {
                "days_since": context.get("days_since_last_record", 3),
                "last_emotion": EMOTION_NAMES_KR.get(
                    context.get("last_emotion", "good"),
                    "알 수 없음"
                ),
                "recent_memories": recent_memories,
            }
            return formatted, "no_recent_record"

        elif reason == "negative_pattern":
            consecutive = context.get("consecutive_negative", 0)

            if consecutive >= 3:
                formatted = {
                    "consecutive_count": consecutive,
                    "recent_emotions": format_emotion_list(
                        [e.get("emotion_name", "") for e in context.get("recent_emotions", [])]
                    ),
                    "recent_memories": recent_memories,
                }
                return formatted, "negative_pattern"
            else:
                formatted = {
                    "negative_ratio": int(context.get("negative_ratio", 0) * 100),
                    "total_count": context.get("total_count", 0),
                    "emotion_distribution": format_emotion_distribution(
                        context.get("emotion_distribution", {})
                    ),
                    "recent_memories": recent_memories,
                }
                return formatted, "negative_ratio"

        elif reason == "positive_reinforcement":
            formatted = {
                "consecutive_count": context.get("consecutive_positive", 0),
                "recent_emotions": format_emotion_list(
                    [e.get("emotion_name", "") for e in context.get("recent_emotions", [])]
                ),
                "recent_memories": recent_memories,
            }
            return formatted, "positive_reinforcement"

        else:
            return {"context": str(context)}, reason

    def _get_fallback_message(self, reason: str, context: Dict[str, Any] = None) -> str:
        context = context or {}

        if reason == "no_recent_record":
            days = context.get("days_since_last_record", 3)
            return f"요즘 어때? {days}일 동안 소식이 없었네."
        elif reason == "negative_pattern":
            consecutive = context.get("consecutive_negative", 0)
            if consecutive >= 3:
                return "요즘 힘든 일이 계속되는 것 같아. 괜찮아?"
            return "최근에 많이 힘들어 보여. 무슨 일 있어?"
        elif reason == "positive_reinforcement":
            return "좋은 일들이 계속되고 있네. 잘 되고 있어."

        return "안녕? 오늘 하루 어때?"

    _FORBIDDEN_WORDS = [
        "우울증", "조울증", "정신병", "정신질환",
        "약", "치료", "정신과", "상담", "병원",
        "자살", "자해", "죽음", "포기",
        "진단", "증상", "장애"
    ]
    _SENTENCE_ENDINGS = ["다.", "요.", "까.", "네.", "어.", "야.", "?", "!"]

    def _check_validation(self, message: str, max_length: int) -> str | None:
        """검증 실패 사유 반환. 통과 시 None."""
        if not validate_output(message):
            return "pii"
        for word in self._FORBIDDEN_WORDS:
            if word in message:
                return f"forbidden_word:{word}"
        if len(message) > max_length:
            return "too_long"
        sentence_count = sum(message.count(e) for e in self._SENTENCE_ENDINGS)
        if sentence_count > 1:
            return "too_many_sentences"
        return None

    def generate_with_validation(
        self,
        reason: str,
        context: Dict[str, Any],
        max_length: int = 100,
        max_retries: int = 2,
    ) -> tuple[str, Dict[str, Any]]:
        message, metadata = self.generate(reason, context)

        for attempt in range(max_retries):
            failure = self._check_validation(message, max_length)
            if failure is None:
                return message, metadata
            logger.warning(f"검증 실패({failure}), 재생성 시도 {attempt + 1}/{max_retries}")
            message, metadata = self.generate(reason, context, retry_reason=failure)

        failure = self._check_validation(message, max_length)
        if failure is not None:
            logger.warning(f"재생성 모두 실패({failure}), fallback 사용")
            message = self._get_fallback_message(reason, context)
            metadata["validation_fallback"] = True
            metadata["validation_failure"] = failure

        return message, metadata

    def set_temperature(self, temperature: float):
        """온도 설정 (프로바이더가 지원하는 경우)"""
        if hasattr(self.llm, "_llm") and hasattr(self.llm._llm, "temperature"):
            self.llm._llm.temperature = temperature
            logger.info(f"LLM temperature 설정: {temperature}")
        else:
            logger.warning("현재 프로바이더는 temperature 설정을 지원하지 않음")
