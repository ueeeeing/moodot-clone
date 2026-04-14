# test_message_generation.py
"""
메시지 생성 통합 테스트
"""
import os
from dotenv import load_dotenv

from config import LLMConfig  # ✅ 유지
from generators import MessageGenerator  # ✅ 유지
from prompts import EMOTION_NAMES_KR

load_dotenv('.env.local')


def test_no_recent_record():
    """장기간 미기록 메시지 생성 테스트"""
    print("=" * 60)
    print("🧪 장기간 미기록 메시지 생성 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()  # ✅ 유지
    generator = MessageGenerator(llm)
    
    # ✅ 현재 구조에 맞춘 컨텍스트
    context = {
        "days_since_last_record": 3,
        "last_emotion": "good"  # good, bad, sad, calm
    }
    
    print(f"\n📊 컨텍스트:")
    print(f"   - 미기록 일수: {context['days_since_last_record']}일")
    print(f"   - 마지막 감정: {context['last_emotion']} ({EMOTION_NAMES_KR[context['last_emotion']]})")
    
    message, metadata = generator.generate("no_recent_record", context)
    
    print(f"\n💬 생성된 메시지: {message}")
    print(f"📊 메타데이터:")
    print(f"   - 생성 방법: {metadata['generation_method']}")
    print(f"   - 모델: {metadata['model']}")
    print(f"   - 토큰 사용: {metadata['llm_tokens_used']}")
    print(f"   - 비용: ${metadata['generation_cost']:.6f}")
    print("\n✅ 테스트 성공!")


def test_negative_pattern_consecutive():
    """연속 부정 감정 메시지 생성 테스트"""
    print("\n" + "=" * 60)
    print("🧪 연속 부정 감정 메시지 생성 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()
    generator = MessageGenerator(llm)
    
    # ✅ 연속 부정 감정 (bad, sad)
    context = {
        "consecutive_negative": 3,
        "recent_emotions": ["bad", "sad", "bad"]  # 감정 리스트
    }
    
    print(f"\n📊 컨텍스트:")
    print(f"   - 연속 부정 감정: {context['consecutive_negative']}개")
    print(f"   - 최근 감정: {context['recent_emotions']}")
    
    message, metadata = generator.generate("negative_pattern", context)
    
    print(f"\n💬 생성된 메시지: {message}")
    print(f"📊 메타데이터:")
    print(f"   - 생성 방법: {metadata['generation_method']}")
    print(f"   - 토큰 사용: {metadata['llm_tokens_used']}")
    print("\n✅ 테스트 성공!")


def test_negative_pattern_ratio():
    """부정 감정 비율 높음 메시지 생성 테스트"""
    print("\n" + "=" * 60)
    print("🧪 부정 감정 비율 메시지 생성 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()
    generator = MessageGenerator(llm)
    
    # ✅ 부정 감정 비율 높음
    context = {
        "negative_ratio": 0.75,  # 75%
        "total_count": 8,
        "negative_count": 6,
        "emotion_distribution": {
            "bad": 4,
            "sad": 2,
            "good": 2
        }
    }
    
    print(f"\n📊 컨텍스트:")
    print(f"   - 부정 감정 비율: {context['negative_ratio']:.0%}")
    print(f"   - 총 감정: {context['total_count']}개")
    print(f"   - 감정 분포: {context['emotion_distribution']}")
    
    message, metadata = generator.generate("negative_pattern", context)
    
    print(f"\n💬 생성된 메시지: {message}")
    print(f"📊 메타데이터:")
    print(f"   - 생성 방법: {metadata['generation_method']}")
    print(f"   - 토큰 사용: {metadata['llm_tokens_used']}")
    print("\n✅ 테스트 성공!")


def test_positive_reinforcement():
    """긍정 강화 메시지 생성 테스트"""
    print("\n" + "=" * 60)
    print("🧪 긍정 강화 메시지 생성 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()
    generator = MessageGenerator(llm)
    
    # ✅ 연속 긍정 감정 (good)
    context = {
        "consecutive_positive": 4,
        "recent_emotions": ["good", "good", "calm", "good"]
    }
    
    print(f"\n📊 컨텍스트:")
    print(f"   - 연속 긍정 감정: {context['consecutive_positive']}개")
    print(f"   - 최근 감정: {context['recent_emotions']}")
    
    message, metadata = generator.generate("positive_reinforcement", context)
    
    print(f"\n💬 생성된 메시지: {message}")
    print(f"📊 메타데이터:")
    print(f"   - 생성 방법: {metadata['generation_method']}")
    print(f"   - 토큰 사용: {metadata['llm_tokens_used']}")
    print("\n✅ 테스트 성공!")


def test_validation():
    """메시지 검증 기능 테스트"""
    print("\n" + "=" * 60)
    print("🧪 메시지 검증 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()
    generator = MessageGenerator(llm)
    
    context = {
        "days_since_last_record": 5,
        "last_emotion": "sad"
    }
    
    print(f"\n📊 컨텍스트:")
    print(f"   - 미기록 일수: {context['days_since_last_record']}일")
    print(f"   - 마지막 감정: {context['last_emotion']} ({EMOTION_NAMES_KR[context['last_emotion']]})")
    print(f"\n🔍 검증 옵션:")
    print(f"   - 최대 길이: 50자")
    
    message, metadata = generator.generate_with_validation(
        "no_recent_record",
        context,
        max_length=50
    )
    
    print(f"\n💬 검증된 메시지: {message}")
    print(f"📏 메시지 길이: {len(message)}")
    
    if metadata.get('length_truncated'):
        print("✂️ 길이 초과로 잘림")
    
    if metadata.get('sentence_truncated'):
        print("✂️ 여러 문장이 하나로 줄여짐")
    
    if metadata.get('validation_failed'):
        print(f"⚠️ 검증 실패 - Fallback 사용 (이유: {metadata.get('forbidden_word')})")
    
    print("\n✅ 테스트 성공!")


def test_forbidden_words():
    """금지어 검증 테스트"""
    print("\n" + "=" * 60)
    print("🧪 금지어 검증 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()
    generator = MessageGenerator(llm)
    
    # 금지어가 포함될 가능성이 있는 컨텍스트
    context = {
        "consecutive_negative": 5,
        "recent_emotions": ["sad", "sad", "bad", "sad", "bad"]
    }
    
    print(f"\n📊 컨텍스트:")
    print(f"   - 연속 부정 감정: {context['consecutive_negative']}개")
    
    print(f"\n🚫 금지어 목록:")
    forbidden_words = [
        '우울증', '조울증', '정신병', '정신질환',
        '약', '치료', '정신과', '상담', '병원',
        '자살', '자해', '죽음', '포기',
        '진단', '증상', '장애'
    ]
    print(f"   {', '.join(forbidden_words[:6])}...")
    
    message, metadata = generator.generate_with_validation(
        "negative_pattern",
        context,
        max_length=100
    )
    
    print(f"\n💬 검증된 메시지: {message}")
    
    if metadata.get('validation_failed'):
        print(f"⚠️ 금지어 발견: '{metadata.get('forbidden_word')}' → Fallback 사용")
    else:
        print("✅ 금지어 없음")
    
    print("\n✅ 테스트 성공!")


def test_fallback():
    """Fallback 메시지 테스트"""
    print("\n" + "=" * 60)
    print("🧪 Fallback 메시지 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()
    generator = MessageGenerator(llm)
    
    # ✅ 각 이유별 fallback 테스트
    test_cases = [
        ("no_recent_record", {"days_since_last_record": 3}),
        ("negative_pattern", {"consecutive_negative": 3}),
        ("positive_reinforcement", {"consecutive_positive": 3}),
    ]
    
    for reason, context in test_cases:
        print(f"\n📝 {reason}:")
        fallback = generator._get_fallback_message(reason, context)
        print(f"   {fallback}")
    
    print("\n✅ 테스트 성공!")


def test_temperature_settings():
    """온도 설정 테스트"""
    print("\n" + "=" * 60)
    print("🧪 LLM 온도 설정 테스트")
    print("=" * 60)
    
    llm = LLMConfig.create_llm()
    generator = MessageGenerator(llm)
    
    context = {
        "days_since_last_record": 3,
        "last_emotion": "good"
    }
    
    temperatures = [0.3, 0.7, 1.0]
    
    for temp in temperatures:
        print(f"\n🌡️ Temperature: {temp}")
        generator.set_temperature(temp)
        
        message, metadata = generator.generate("no_recent_record", context)
        print(f"   💬 메시지: {message}")
    
    print("\n✅ 테스트 성공!")


def main():
    """메인 테스트 실행"""
    print("\n🚀 메시지 생성 통합 테스트 시작")
    print(f"📡 LLM 설정: config.LLMConfig 사용\n")
    
    try:
        # 1. 기본 메시지 생성 테스트
        test_no_recent_record()
        test_negative_pattern_consecutive()
        test_negative_pattern_ratio()
        test_positive_reinforcement()
        
        # 2. 검증 기능 테스트
        test_validation()
        test_forbidden_words()
        
        # 3. Fallback 테스트
        test_fallback()
        
        # 4. 추가 기능 테스트
        # test_temperature_settings()  # 필요 시 주석 해제
        
        print("\n" + "=" * 60)
        print("🎉 모든 테스트 완료!")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n💥 오류: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
