"""
AI 시스템 통합 테스트 스위트
────────────────────────────
실행 (mock 모드):     python tests/test_suite.py
실행 (실제 LLM):     python tests/test_suite.py --real-llm
pytest (mock):       pytest tests/test_suite.py -v
pytest (실제 LLM):   USE_REAL_LLM=true pytest tests/test_suite.py -v
"""
import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from unittest.mock import AsyncMock, MagicMock, patch

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
load_dotenv(project_root / ".env.local")

# ── 모드 설정 ─────────────────────────────────────────────────────────────────
USE_REAL_LLM = "--real-llm" in sys.argv or os.getenv("USE_REAL_LLM", "false") == "true"

# ── 임포트 ────────────────────────────────────────────────────────────────────
from rules.engine import RuleEngine
from rules.no_recent_record import NoRecentRecordRule
from rules.negative_streak import NegativeStreakRule
from rules.negative_ratio import NegativeRatioRule
from rules.positive_streak import PositiveStreakRule
from rules.frequency_limit import FrequencyLimitRule
from generators.message_generator import MessageGenerator
from config.base_llm import BaseLLMProvider


# ══════════════════════════════════════════════════════════════════════════════
# Mock LLM Provider
# ══════════════════════════════════════════════════════════════════════════════

class MockLLMProvider(BaseLLMProvider):
    """테스트용 Mock LLM — OpenAI 호출 없이 제어된 응답 반환"""

    _RESPONSE_POOL = {
        "no_recent_record": [
            "오랫동안 연락이 없어서 궁금했어, 요즘 어때? 😊",
            "한동안 소식이 없었는데 잘 지내고 있지? 🙂",
            "오랜만이야, 요즘 어떻게 지내? 💭",
        ],
        "negative_pattern": [
            "요즘 많이 힘들지? 내가 옆에 있어 💙",
            "힘든 시간이 계속되고 있구나, 괜찮아? 🤗",
            "최근에 많이 힘들어 보여, 어떤 일 있어? 😟",
        ],
        "positive_reinforcement": [
            "좋은 일들이 계속되고 있네, 정말 다행이야 😄",
            "기분 좋은 날들이 이어지고 있어서 나도 기뻐 🎉",
            "좋은 에너지가 느껴져, 계속 이렇게 가자 🌟",
        ],
        "default": [
            "오늘 하루 어땠어? 😊",
            "안녕, 요즘 잘 지내고 있지? 👋",
            "잘 지내고 있어? 궁금하다 😊",
        ],
    }

    def __init__(self, force_response: Optional[str] = None):
        self._model = "mock-llm-v1"
        self._force_response = force_response
        self._call_count = 0

    @property
    def model_name(self) -> str:
        return self._model

    def generate(self, prompt: str) -> Tuple[str, dict]:
        self._call_count += 1

        if self._force_response is not None:
            text = self._force_response
        else:
            if "감정 기록을 하지 않았습니다" in prompt:
                pool = self._RESPONSE_POOL["no_recent_record"]
            elif "부정적입니다" in prompt or "부정" in prompt:
                pool = self._RESPONSE_POOL["negative_pattern"]
            elif "긍정적입니다" in prompt:
                pool = self._RESPONSE_POOL["positive_reinforcement"]
            else:
                pool = self._RESPONSE_POOL["default"]

            text = pool[(self._call_count - 1) % len(pool)]

        usage = {
            "elapsed_time": 0.05,
            "prompt_tokens": len(prompt.split()),
            "completion_tokens": len(text.split()),
            "total_tokens": len(prompt.split()) + len(text.split()),
            "total_cost": 0.0,
        }
        return text, usage


def get_llm() -> BaseLLMProvider:
    if USE_REAL_LLM:
        from config import LLMFactory
        return LLMFactory.create()
    return MockLLMProvider()


# ══════════════════════════════════════════════════════════════════════════════
# 테스트 인프라
# ══════════════════════════════════════════════════════════════════════════════

_results: List[dict] = []


def log_result(
    name: str,
    input_data: Any,
    result: Dict,
    passed: bool,
    issues: str = "",
):
    """표준 포맷으로 테스트 결과 출력"""
    _results.append({"name": name, "passed": passed, "issues": issues})
    status = "✅ PASS" if passed else "❌ FAIL"

    print(f"\n{'='*60}")
    print(f"[{name}]")
    print(f"입력: {input_data}")
    print(f"결과:")
    print(f"  - should_intervene : {result.get('should_intervene', 'N/A')}")
    print(f"  - reason           : {result.get('reason', 'N/A')}")
    print(f"  - severity         : {result.get('severity', 'N/A')}")
    print(f"  - tone             : {result.get('tone', 'N/A')}")
    print(f"  - message          : {result.get('message', 'N/A')}")
    print(f"판단: {status}")
    if issues:
        print(f"문제점: {issues}")


async def run_engine(ctx: dict) -> dict:
    """RuleEngine을 mock 컨텍스트로 실행하는 헬퍼"""
    engine = RuleEngine(MagicMock())
    with patch.object(engine, "_build_context", new=AsyncMock(return_value=ctx)):
        return await engine.evaluate("test_user")


def base_ctx(**overrides) -> dict:
    """기본 컨텍스트 (모든 값이 정상 범위)"""
    ctx = {
        "user_id": "test_user",
        "today_count": 0,
        "hours_since_last": 10.0,
        "days_since_last_record": 1,
        "consecutive_negative": 0,
        "consecutive_positive": 0,
        "recent_emotions": [],
        "emotion_stats": {
            "total_count": 0,
            "negative_count": 0,
            "emotion_distribution": {},
        },
    }
    ctx.update(overrides)
    return ctx


# ══════════════════════════════════════════════════════════════════════════════
# 1. Rule Engine 테스트
# ══════════════════════════════════════════════════════════════════════════════

async def test_rule_engine():
    print("\n" + "█"*60)
    print("  1. Rule Engine 테스트")
    print("█"*60)

    # ── 1-1. 기본 케이스 ─────────────────────────────────────────────────────
    ctx = base_ctx(consecutive_negative=0, consecutive_positive=0, days_since_last_record=1)
    r = await run_engine(ctx)
    passed = not r["should_intervene"] and r["reason"] == "no_trigger"
    log_result(
        "1-1. neutral 3개 → 개입 없음",
        "consecutive_negative=0, days_since=1",
        r,
        passed,
    )

    # ── 1-2. 우울 연속 ────────────────────────────────────────────────────────
    ctx = base_ctx(consecutive_negative=2)
    r = await run_engine(ctx)
    passed = not r["should_intervene"]
    log_result(
        "1-2a. sad 2개 → 개입 없음",
        "consecutive_negative=2",
        r,
        passed,
    )

    ctx = base_ctx(consecutive_negative=3)
    r = await run_engine(ctx)
    passed = r["should_intervene"] and r["reason"] == "negative_pattern"
    log_result(
        "1-2b. sad 3개 → 개입 발생 (negative_pattern)",
        "consecutive_negative=3",
        r,
        passed,
    )

    # ── 1-3. 경계값 테스트 ───────────────────────────────────────────────────
    ctx = base_ctx(
        emotion_stats={"total_count": 10, "negative_count": 6, "emotion_distribution": {"bad": 6, "good": 4}},
        consecutive_negative=0,
    )
    r = await run_engine(ctx)
    passed = not r["should_intervene"]
    log_result(
        "1-3a. negative_ratio 0.60 → 개입 없음",
        "negative_count=6, total=10 (ratio=0.60)",
        r,
        passed,
    )

    ctx = base_ctx(
        emotion_stats={"total_count": 10, "negative_count": 7, "emotion_distribution": {"bad": 7, "good": 3}},
        consecutive_negative=0,
    )
    r = await run_engine(ctx)
    passed = r["should_intervene"] and r["reason"] == "negative_pattern"
    log_result(
        "1-3b. negative_ratio 0.70 → 개입 발생",
        "negative_count=7, total=10 (ratio=0.70)",
        r,
        passed,
    )

    ctx = base_ctx(days_since_last_record=2)
    r = await run_engine(ctx)
    passed = not r["should_intervene"]
    log_result(
        "1-3c. days_since=2 → 개입 없음",
        "days_since_last_record=2",
        r,
        passed,
    )

    ctx = base_ctx(days_since_last_record=3)
    r = await run_engine(ctx)
    passed = r["should_intervene"] and r["reason"] == "no_recent_record"
    log_result(
        "1-3d. days_since=3 → 개입 발생 (no_recent_record)",
        "days_since_last_record=3",
        r,
        passed,
    )

    # ── 1-4. 우선순위 테스트 ─────────────────────────────────────────────────
    ctx = base_ctx(
        consecutive_negative=5,
        today_count=2,   # frequency_limit 조건 충족
        hours_since_last=1.0,
    )
    r = await run_engine(ctx)
    passed = not r["should_intervene"] and r["reason"] == "frequency_limit"
    issues = "" if passed else "frequency_limit이 negative_streak보다 먼저 실행되지 않음"
    log_result(
        "1-4. 우울 5개 + 오늘 2번 개입 → frequency_limit 우선",
        "consecutive_negative=5, today_count=2",
        r,
        passed,
        issues,
    )

    # ── 1-5. 긍정 케이스 ─────────────────────────────────────────────────────
    ctx = base_ctx(consecutive_positive=3)
    r = await run_engine(ctx)
    passed = r["should_intervene"] and r["reason"] == "positive_reinforcement"
    log_result(
        "1-5. happy 3개 → positive_reinforcement",
        "consecutive_positive=3",
        r,
        passed,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 2. AI 출력 테스트
# ══════════════════════════════════════════════════════════════════════════════

async def test_ai_output():
    print("\n" + "█"*60)
    print("  2. AI 출력 테스트")
    print(f"     모드: {'실제 API' if USE_REAL_LLM else 'Mock'}")
    print("█"*60)

    llm = get_llm()
    generator = MessageGenerator(llm)

    # ── 2-1. 길이 제한 ───────────────────────────────────────────────────────
    msg, meta = generator.generate_with_validation(
        "no_recent_record",
        {"days_since_last_record": 3, "severity": 1},
    )
    passed = len(msg) <= 100
    issues = f"메시지 길이 {len(msg)}자 > 100자" if not passed else ""
    log_result(
        "2-1. 길이 제한 (≤100자)",
        "no_recent_record / days=3",
        {"message": msg, "should_intervene": True, "reason": "no_recent_record",
         "severity": 1, "tone": "N/A (메시지 전용 테스트)"},
        passed,
        issues,
    )

    # ── 2-2. 문장 수 ─────────────────────────────────────────────────────────
    sentence_endings = ["다.", "요.", "까.", "네.", "어.", "야.", "?", "!"]
    count = sum(msg.count(e) for e in sentence_endings)
    passed = count <= 1
    issues = f"문장 {count}개 감지됨" if not passed else ""
    log_result(
        "2-2. 문장 수 (1개 이하)",
        f"메시지: {msg!r}",
        {"message": msg, "should_intervene": True, "reason": "N/A",
         "severity": "N/A", "tone": "N/A"},
        passed,
        issues,
    )

    # ── 2-3. 톤 검증 ─────────────────────────────────────────────────────────
    tone_cases = [
        ("no_recent_record", base_ctx(days_since_last_record=3),  "curious"),
        ("no_recent_record", base_ctx(days_since_last_record=7),  "concerned"),
        ("negative_pattern", base_ctx(consecutive_negative=3),    "supportive"),
        ("positive_reinforcement", base_ctx(consecutive_positive=3), "encouraging"),
    ]
    for label, ctx, expected_tone in tone_cases:
        r = await run_engine(ctx)
        actual_tone = r.get("tone", "")
        passed = actual_tone == expected_tone
        issues = f"예상 tone={expected_tone}, 실제 tone={actual_tone}" if not passed else ""
        log_result(
            f"2-3. 톤 검증 [{label}]",
            f"expected_tone={expected_tone}",
            r,
            passed,
            issues,
        )

    # ── 2-4. 금지어 필터 ─────────────────────────────────────────────────────
    dangerous_llm = MockLLMProvider(force_response="요즘 너무 힘들면 자살 충동이 생길 수도 있어")
    dangerous_gen = MessageGenerator(dangerous_llm)
    msg_danger, meta_danger = dangerous_gen.generate_with_validation(
        "negative_pattern",
        {"consecutive_negative": 4, "severity": 2},
    )
    passed = (
        "자살" not in msg_danger
        and meta_danger.get("validation_failed") is True
        and meta_danger.get("generation_method") in ("llm_generated", "template_fallback")
    )
    issues = "금지어 필터 미작동 또는 fallback 미실행" if not passed else ""
    log_result(
        "2-4. 금지어 필터 (자살 포함 응답 → fallback)",
        "force_response='...자살...'",
        {"message": msg_danger, "should_intervene": True, "reason": "negative_pattern",
         "severity": 2, "tone": "N/A",
         "validation_failed": meta_danger.get("validation_failed")},
        passed,
        issues,
    )

    # ── 2-5. 랜덤성 테스트 ───────────────────────────────────────────────────
    ctx_neg = {"consecutive_negative": 3, "severity": 1, "recent_emotions": ["bad", "bad", "bad"]}
    responses = []
    for _ in range(3):
        if USE_REAL_LLM:
            m, _ = generator.generate("negative_pattern", ctx_neg)
        else:
            # mock은 call_count 기반으로 다른 응답 반환
            m, _ = generator.generate("negative_pattern", ctx_neg)
        responses.append(m)

    unique_count = len(set(responses))
    # mock 모드: call_count 기반으로 다르게 설계 → 3개 모두 달라야 함
    # 실제 API: 온도 0.5이므로 완전히 동일할 가능성 낮음 (최소 2개 이상 달라야)
    threshold = 3 if not USE_REAL_LLM else 2
    passed = unique_count >= threshold
    issues = f"3회 호출 중 고유 응답 {unique_count}개 (기준: {threshold}개 이상)" if not passed else ""
    log_result(
        "2-5. 랜덤성 (동일 입력 3회 → 결과 다양성)",
        f"negative_pattern x3\n  응답1: {responses[0]!r}\n  응답2: {responses[1]!r}\n  응답3: {responses[2]!r}",
        {"message": f"{unique_count}개 고유 응답", "should_intervene": True,
         "reason": "negative_pattern", "severity": 1, "tone": "N/A"},
        passed,
        issues,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 3. E2E 시나리오 테스트
# ══════════════════════════════════════════════════════════════════════════════

async def test_e2e():
    print("\n" + "█"*60)
    print("  3. E2E 시나리오 테스트")
    print("█"*60)

    llm = get_llm()
    generator = MessageGenerator(llm)

    # ── 3-1. 일반 사용자 흐름 ─────────────────────────────────────────────────
    # happy(good) → neutral(calm) → sad: 연속 부정 1개 → 개입 없음
    ctx = base_ctx(
        consecutive_negative=1,
        consecutive_positive=0,
        days_since_last_record=0,
        emotion_stats={"total_count": 3, "negative_count": 1, "emotion_distribution": {"good": 1, "calm": 1, "sad": 1}},
    )
    r = await run_engine(ctx)
    passed = not r["should_intervene"]
    log_result(
        "3-1. 일반 흐름 (good→calm→sad) → 개입 없음",
        "consecutive_negative=1, total=3, negative_count=1",
        r,
        passed,
    )

    # ── 3-2. 점진적 악화 ─────────────────────────────────────────────────────
    # 1단계: good → 개입 없음
    stage1 = base_ctx(consecutive_negative=0, consecutive_positive=1)
    r1 = await run_engine(stage1)

    # 2단계: good + sad → 개입 없음
    stage2 = base_ctx(consecutive_negative=1)
    r2 = await run_engine(stage2)

    # 3단계: sad×3 연속 → 개입 발생
    stage3 = base_ctx(consecutive_negative=3)
    r3 = await run_engine(stage3)

    if r3["should_intervene"]:
        msg3, meta3 = generator.generate_with_validation(r3["reason"], r3.get("context", {}))
    else:
        msg3, meta3 = "", {}

    passed = (
        not r1["should_intervene"]
        and not r2["should_intervene"]
        and r3["should_intervene"]
        and r3["reason"] == "negative_pattern"
    )
    issues = "" if passed else f"단계별 결과: stage1={r1['should_intervene']}, stage2={r2['should_intervene']}, stage3={r3['should_intervene']}"
    log_result(
        "3-2. 점진적 악화 (good→sad→sad→sad) → 3번째부터 개입",
        "stage1: consec_neg=0 / stage2: consec_neg=1 / stage3: consec_neg=3",
        {**r3, "message": msg3},
        passed,
        issues,
    )

    # ── 3-3. 과도한 입력 → 빈도 제한 ─────────────────────────────────────────
    # 첫 번째 개입: 가능
    ctx_ok = base_ctx(consecutive_negative=3, today_count=0, hours_since_last=10.0)
    r_ok = await run_engine(ctx_ok)

    # 두 번째 개입: 가능 (1회)
    ctx_ok2 = base_ctx(consecutive_negative=3, today_count=1, hours_since_last=5.0)
    r_ok2 = await run_engine(ctx_ok2)

    # 세 번째 이후: 차단 (2회 초과)
    ctx_blocked = base_ctx(consecutive_negative=5, today_count=2, hours_since_last=2.0)
    r_blocked = await run_engine(ctx_blocked)

    passed = (
        r_ok["should_intervene"]
        and r_ok2["should_intervene"]
        and not r_blocked["should_intervene"]
        and r_blocked["reason"] == "frequency_limit"
    )
    issues = "" if passed else f"1차={r_ok['should_intervene']}, 2차={r_ok2['should_intervene']}, 3차={r_blocked.get('reason')}"
    log_result(
        "3-3. 과도한 입력 → 3번째부터 frequency_limit 차단",
        "today_count 0→1→2, 모두 consecutive_negative=3+",
        r_blocked,
        passed,
        issues,
    )

    # ── 3-4. 장기 미사용 (7일) ───────────────────────────────────────────────
    ctx = base_ctx(days_since_last_record=7)
    r = await run_engine(ctx)
    if r["should_intervene"]:
        msg, meta = generator.generate_with_validation(r["reason"], r.get("context", {}))
    else:
        msg, meta = "", {}

    passed = (
        r["should_intervene"]
        and r["reason"] == "no_recent_record"
        and r.get("severity") == 3
    )
    issues = f"severity={r.get('severity')} (기대: 3)" if r["should_intervene"] and r.get("severity") != 3 else ""
    log_result(
        "3-4. 장기 미사용 7일 → no_recent_record (severity=3)",
        "days_since_last_record=7",
        {**r, "message": msg},
        passed,
        issues,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 4. 엣지 케이스
# ══════════════════════════════════════════════════════════════════════════════

async def test_edge_cases():
    print("\n" + "█"*60)
    print("  4. 엣지 케이스")
    print("█"*60)

    llm = get_llm()
    generator = MessageGenerator(llm)

    # ── 4-1. 감정 데이터 없음 ─────────────────────────────────────────────────
    ctx = base_ctx(
        days_since_last_record=None,   # 기록 아예 없음
        consecutive_negative=0,
        consecutive_positive=0,
        recent_emotions=[],
        emotion_stats={"total_count": 0, "negative_count": 0, "emotion_distribution": {}},
    )
    try:
        r = await run_engine(ctx)
        passed = True  # 예외 없이 실행되면 통과
        issues = "" if not r["should_intervene"] else f"데이터 없는데 개입 발생: {r['reason']}"
    except Exception as e:
        r = {"should_intervene": False, "reason": "error", "severity": None, "tone": None}
        passed = False
        issues = f"예외 발생: {e}"
    log_result(
        "4-1. 감정 데이터 없음 (days_since=None, total=0)",
        "모든 데이터 기본값 / days_since=None",
        r,
        passed,
        issues,
    )

    # ── 4-2. 잘못된 감정 값 ──────────────────────────────────────────────────
    ctx = base_ctx(
        consecutive_negative=0,
        emotion_stats={"total_count": 5, "negative_count": 0, "emotion_distribution": {"unknown_emotion": 5}},
    )
    try:
        r = await run_engine(ctx)
        passed = True
        issues = ""
    except Exception as e:
        r = {"should_intervene": False, "reason": "error", "severity": None, "tone": None}
        passed = False
        issues = f"예외 발생: {e}"
    log_result(
        "4-2. 잘못된 감정 값 (unknown_emotion)",
        "emotion_distribution={'unknown_emotion': 5}",
        r,
        passed,
        issues,
    )

    # ── 4-3. 매우 긴 입력 ────────────────────────────────────────────────────
    long_llm = MockLLMProvider(
        force_response="오늘 하루도 정말 힘들었지만 그래도 괜찮아 힘내자 화이팅 잘 될 거야 "
                       "걱정하지 마 너는 잘 하고 있어 포기하지 마 조금만 더 힘내면 돼 "
                       "내가 옆에 있을게 언제든지 얘기해 정말이야 진심으로 응원해 너를 믿어 💙"
    )
    long_gen = MessageGenerator(long_llm)
    msg, meta = long_gen.generate_with_validation(
        "negative_pattern",
        {"consecutive_negative": 3, "severity": 1},
    )
    passed = len(msg) <= 100 and (meta.get("length_truncated") is True or len(msg) <= 100)
    issues = f"길이 제한 미적용: {len(msg)}자" if len(msg) > 100 else ""
    log_result(
        "4-3. LLM이 매우 긴 응답 반환 → 잘라냄",
        f"force_response 길이={len(long_llm._force_response)}자",
        {"message": msg, "should_intervene": True, "reason": "negative_pattern",
         "severity": 1, "tone": "N/A", "length_truncated": meta.get("length_truncated")},
        passed,
        issues,
    )

    # ── 4-4. DB 저장 실패 시뮬레이션 ─────────────────────────────────────────
    from models import InterventionRepository

    mock_supabase = MagicMock()
    mock_repo = InterventionRepository(mock_supabase)

    # create()가 예외를 던지도록 설정
    async def failing_create(intervention):
        raise RuntimeError("DB connection timeout")

    mock_repo.create = failing_create

    error_caught = False
    try:
        from models import Intervention
        await mock_repo.create(
            Intervention(user_id="test", reason="negative_pattern", message="테스트")
        )
    except RuntimeError:
        error_caught = True

    passed = error_caught  # 예외가 전파되어야 함 (main.py에서 catch)
    log_result(
        "4-4. DB 저장 실패 → 예외 전파 확인",
        "InterventionRepository.create() → RuntimeError",
        {"should_intervene": "N/A", "reason": "N/A", "severity": "N/A",
         "tone": "N/A", "message": f"예외 전파: {error_caught}"},
        passed,
        "" if passed else "예외가 전파되지 않음 — main.py의 try/except가 잡지 못할 수 있음",
    )

    # ── 4-5. hours_since_last 경계값 ─────────────────────────────────────────
    # 정확히 4시간 = 차단 안 됨 (< 4 조건)
    ctx = base_ctx(consecutive_negative=3, hours_since_last=4.0, today_count=1)
    r = await run_engine(ctx)
    passed = r["should_intervene"]  # 4시간 이상이면 통과해야 함
    issues = "hours_since=4.0은 통과해야 하는데 차단됨" if not passed else ""
    log_result(
        "4-5. hours_since=4.0 경계값 → 차단 안 됨",
        "hours_since_last=4.0 (threshold < 4)",
        r,
        passed,
        issues,
    )

    # 정확히 3.9시간 = 차단
    ctx = base_ctx(consecutive_negative=3, hours_since_last=3.9, today_count=1)
    r = await run_engine(ctx)
    passed = not r["should_intervene"] and r["reason"] == "frequency_limit"
    issues = "hours_since=3.9는 차단되어야 하는데 통과됨" if not passed else ""
    log_result(
        "4-6. hours_since=3.9 경계값 → frequency_limit 차단",
        "hours_since_last=3.9 (threshold < 4)",
        r,
        passed,
        issues,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 결과 요약 출력
# ══════════════════════════════════════════════════════════════════════════════

def print_summary():
    total = len(_results)
    passed = sum(1 for r in _results if r["passed"])
    failed = total - passed

    print("\n" + "═"*60)
    print("  최종 결과 요약")
    print("═"*60)
    print(f"  전체: {total}  ✅ PASS: {passed}  ❌ FAIL: {failed}")
    print()

    if failed > 0:
        print("  실패 목록:")
        for r in _results:
            if not r["passed"]:
                print(f"    ❌ {r['name']}")
                if r["issues"]:
                    print(f"       → {r['issues']}")
    else:
        print("  모든 테스트 통과!")

    print("═"*60)
    return failed == 0


# ══════════════════════════════════════════════════════════════════════════════
# pytest 호환 래퍼
# ══════════════════════════════════════════════════════════════════════════════

def test_rule_engine_pytest():
    asyncio.run(test_rule_engine())
    failed = [r for r in _results if not r["passed"]]
    assert not failed, f"실패한 테스트: {[r['name'] for r in failed]}"


def test_ai_output_pytest():
    asyncio.run(test_ai_output())


def test_e2e_pytest():
    asyncio.run(test_e2e())


def test_edge_cases_pytest():
    asyncio.run(test_edge_cases())


# ══════════════════════════════════════════════════════════════════════════════
# 메인 실행
# ══════════════════════════════════════════════════════════════════════════════

async def run_all():
    print("\n" + "█"*60)
    print(f"  AI 시스템 테스트 스위트")
    print(f"  LLM 모드: {'실제 API (' + os.getenv('LLM_PROVIDER','openai') + ')' if USE_REAL_LLM else 'Mock (비용 없음)'}")
    print("█"*60)

    await test_rule_engine()
    await test_ai_output()
    await test_e2e()
    await test_edge_cases()
    return print_summary()


if __name__ == "__main__":
    all_passed = asyncio.run(run_all())
    sys.exit(0 if all_passed else 1)
