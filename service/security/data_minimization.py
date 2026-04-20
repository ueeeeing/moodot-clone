"""
LLM 전달 전 개인정보 마스킹 (정규식 기반)
이름은 한국어 NER 없이 정확히 잡을 수 없어 제외.
"""
import re

_PATTERNS = [
    (re.compile(r"01[016789]-?\d{3,4}-?\d{4}"), "[전화번호]"),
    (re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"), "[이메일]"),
    (re.compile(r"\d{6}-[1-4]\d{6}"), "[주민번호]"),
    (re.compile(r"\d{3,4}-\d{4}-\d{4}-\d{4}"), "[계좌번호]"),
]


def sanitize(text: str) -> str:
    """PII 패턴을 마스킹한 텍스트 반환"""
    for pattern, placeholder in _PATTERNS:
        text = pattern.sub(placeholder, text)
    return text


def contains_pii(text: str) -> bool:
    """텍스트에 PII 패턴이 포함되어 있으면 True"""
    return any(pattern.search(text) for pattern, _ in _PATTERNS)
