# test_llm.py
"""
LLM 프로바이더 테스트
"""
import os
from dotenv import load_dotenv
from config import LLMFactory, OllamaProvider

load_dotenv()


def test_provider_setup():
    """LLM 프로바이더 설정 확인"""
    provider = os.getenv("LLM_PROVIDER", "ollama")
    print("=" * 60)
    print(f"🔧 LLM 프로바이더 설정 확인: {provider}")
    print("=" * 60)

    if provider == "ollama":
        print("\n1️⃣ Ollama 서버 연결 확인...")
        if OllamaProvider.check_server():
            print("   ✅ 서버 연결 성공!")
        else:
            print("   ❌ 서버 연결 실패!")
            print("   💡 'ollama serve' 명령어로 시작하세요.")
            return False

        print("\n2️⃣ 다운로드된 모델 확인...")
        models = OllamaProvider.list_models()
        if models:
            print(f"   ✅ 사용 가능한 모델: {', '.join(models)}")
        else:
            print("   ❌ 다운로드된 모델 없음!")
            print("   💡 'ollama pull llama3.2:3b' 명령어로 다운로드하세요.")
            return False

        print(f"\n3️⃣ 설정된 모델: {OllamaProvider.DEFAULT_MODEL}")
        if OllamaProvider.check_model(OllamaProvider.DEFAULT_MODEL):
            print("   ✅ 모델 사용 가능!")
        else:
            print(f"   ❌ 모델 '{OllamaProvider.DEFAULT_MODEL}' 없음!")
            print(f"   💡 'ollama pull {OllamaProvider.DEFAULT_MODEL}' 실행하세요.")
            return False

    return True


def test_basic_call():
    """기본 LLM 호출 테스트"""
    print("\n" + "=" * 60)
    print("🧪 기본 LLM 호출 테스트")
    print("=" * 60)

    try:
        llm = LLMFactory.create()
        prompt = "한 문장으로 인사해주세요."

        print(f"\n📝 프롬프트: {prompt}")
        print(f"   프로바이더: {llm.model_name}")
        print("\n⏳ LLM 호출 중...\n")

        response, usage = llm.generate(prompt)

        print(f"💬 응답: {response}")
        print(f"\n📊 사용량:")
        print(f"   - 소요 시간: {usage['elapsed_time']:.2f}초")
        print(f"   - 추정 토큰: ~{usage['total_tokens']}")
        print(f"   - 비용: ${usage['total_cost']:.6f}")

        print("\n✅ 테스트 성공!")
        return True

    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_emotion_message():
    """감정 메시지 생성 테스트"""
    print("\n" + "=" * 60)
    print("🧪 감정 메시지 생성 테스트")
    print("=" * 60)

    try:
        llm = LLMFactory.create()

        prompt = """당신은 사용자의 감정을 이해하는 친구입니다.

사용자 상황:
- 이유: 3일 동안 감정 기록을 하지 않았습니다
- 마지막 감정: 행복
- 최근 패턴: 주말에 기록을 잘 안 합니다

제약사항:
- 반드시 한 문장으로만 말하세요
- 친근하고 자연스러운 톤으로
- 강요하지 마세요

한 문장으로 말 걸어주세요:"""

        print("\n⏳ LLM 호출 중...\n")
        response, usage = llm.generate(prompt)

        print(f"💬 생성된 메시지: {response}")
        print(f"\n📊 소요 시간: {usage['elapsed_time']:.2f}초")
        print("\n✅ 테스트 성공!")
        return True

    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        return False


def test_multiple_calls():
    """여러 번 호출 테스트 (다양성 확인)"""
    print("\n" + "=" * 60)
    print("🧪 다양성 테스트 (5번 호출)")
    print("=" * 60)

    try:
        llm = LLMFactory.create()
        prompt = "요즘 어떻게 지내는지 물어보는 짧은 인사를 해주세요."

        total_time = 0
        for i in range(5):
            print(f"\n{i + 1}번째 호출:")
            response, usage = llm.generate(prompt)
            print(f"   응답: {response}")
            total_time += usage["elapsed_time"]

        print(f"\n⏱️ 평균 소요 시간: {total_time / 5:.2f}초")
        print("\n✅ 테스트 성공! (매번 다른 응답 확인)")
        return True

    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        return False


def test_korean_support():
    """한국어 지원 테스트"""
    print("\n" + "=" * 60)
    print("🧪 한국어 지원 테스트")
    print("=" * 60)

    try:
        llm = LLMFactory.create()

        prompts = [
            "안녕하세요! 한국어로 답해주세요.",
            "오늘 기분이 어때? 라고 한국어로 물어봐줘.",
            "격려의 말 한 문장 해줘.",
        ]

        for prompt in prompts:
            print(f"\n📝 {prompt}")
            response, _ = llm.generate(prompt)
            print(f"💬 {response}")

        print("\n✅ 한국어 지원 확인!")
        return True

    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        return False


def main():
    """메인 테스트 실행"""
    print(f"\n🚀 LLM 테스트 시작 (프로바이더: {os.getenv('LLM_PROVIDER', 'ollama')})\n")

    if not test_provider_setup():
        print("\n❌ LLM 설정 문제가 있습니다. 위 안내를 따라주세요.")
        return

    tests = [
        ("기본 호출", test_basic_call),
        ("감정 메시지", test_emotion_message),
        ("다양성", test_multiple_calls),
        ("한국어", test_korean_support),
    ]

    results = []
    for name, test_func in tests:
        try:
            results.append((name, test_func()))
        except Exception as e:
            print(f"\n💥 {name} 테스트 오류: {e}")
            results.append((name, False))

    print("\n" + "=" * 60)
    print("📊 테스트 결과 요약")
    print("=" * 60)

    for name, success in results:
        print(f"{'✅' if success else '❌'} {name}")

    if all(s for _, s in results):
        print("\n🎉 모든 테스트 완료!")
    else:
        print("\n⚠️ 일부 테스트 실패")

    print("=" * 60)


if __name__ == "__main__":
    main()
