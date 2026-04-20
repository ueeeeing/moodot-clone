from .data_minimization import contains_pii


def validate_output(text: str) -> bool:
    """LLM 출력에 PII가 없으면 True"""
    return not contains_pii(text)
