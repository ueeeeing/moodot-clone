# test_tools.py
"""
Tools 테스트 스크립트
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# ✅ tools/__init__.py에서 import
from tools.emotion_tools import (
    DEFAULT_USER_ID,
    get_recent_emotions,
    get_days_since_last_record,
    get_consecutive_emotions,
    get_emotion_statistics,
    get_emotion_by_id
)

from tools.intervention_tools import (
    check_intervention_history,
    count_today_interventions,
    get_last_intervention_time,
    get_intervention_acceptance_rate,
    should_intervene_based_on_frequency
)

# 환경 변수 로드
load_dotenv('.env.local')

# ✅ 동기 Supabase 클라이언트
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)


def test_emotion_tools():
    """Emotion Tools 테스트"""
    print("=" * 60)
    print("🧪 Emotion Tools 테스트")
    print("=" * 60)
    
    # ✅ MVP: user_id 기본값 사용
    print(f"\n👤 테스트 사용자: {DEFAULT_USER_ID}")
    
    # 1. 최근 감정 조회
    print("\n1️⃣ get_recent_emotions(days=7)")
    print("-" * 40)
    emotions = get_recent_emotions(supabase, days=7)  # ✅ user_id 생략 가능
    print(f"   📊 결과: {len(emotions)}개 감정 조회")
    
    if emotions:
        recent = emotions[0]
        print(f"   📝 최근 감정:")
        print(f"      - 이름: {recent['emotion_name']}")
        print(f"      - 내용: {recent.get('text', 'N/A')}")
        print(f"      - 시간: {recent['created_at']}")
    else:
        print("   ⚠️ 감정 기록 없음")
    
    # 2. 마지막 기록 이후 일수
    print("\n2️⃣ get_days_since_last_record()")
    print("-" * 40)
    days = get_days_since_last_record(supabase)
    if days is not None:
        print(f"   ⏰ 마지막 기록: {days}일 전")
    else:
        print("   ⚠️ 기록 없음")
    
    # 3. 연속 부정 감정
    print("\n3️⃣ get_consecutive_emotions(negative)")
    print("-" * 40)
    negative_count = get_consecutive_emotions(supabase, emotion_type="negative")
    print(f"   😔 연속 부정 감정: {negative_count}개")
    
    # 4. 연속 긍정 감정 (추가)
    print("\n4️⃣ get_consecutive_emotions(positive)")
    print("-" * 40)
    positive_count = get_consecutive_emotions(supabase, emotion_type="positive")
    print(f"   😊 연속 긍정 감정: {positive_count}개")
    
    # 5. 감정 통계
    print("\n5️⃣ get_emotion_statistics(days=7)")
    print("-" * 40)
    stats = get_emotion_statistics(supabase, days=7)
    print(f"   📊 통계 (최근 7일):")
    print(f"      - 총 감정: {stats['total_count']}개")
    print(f"      - 긍정 (good): {stats['positive_count']}개")
    print(f"      - 부정 (bad, sad): {stats['negative_count']}개")
    print(f"      - 중립 (calm): {stats['neutral_count']}개")
    print(f"      - 가장 빈번: {stats['most_frequent_emotion']}")
    
    if stats['emotion_distribution']:
        print(f"      - 분포:")
        for emotion, count in stats['emotion_distribution'].items():
            print(f"         · {emotion}: {count}회")
    
    # 6. emotion_id로 감정 정보 조회 (추가)
    if emotions:
        print("\n6️⃣ get_emotion_by_id()")
        print("-" * 40)
        emotion_id = emotions[0]['emotion_id']
        emotion_info = get_emotion_by_id(supabase, emotion_id)
        if emotion_info:
            print(f"   🔍 감정 ID {emotion_id}:")
            print(f"      - 이름: {emotion_info.get('emotion')}")


def test_intervention_tools():
    """Intervention Tools 테스트"""
    print("\n" + "=" * 60)
    print("🧪 Intervention Tools 테스트")
    print("=" * 60)
    
    print(f"\n👤 테스트 사용자: {DEFAULT_USER_ID}")
    
    # 1. 개입 이력 확인
    print("\n1️⃣ check_intervention_history(hours=24)")
    print("-" * 40)
    history = check_intervention_history(supabase, hours=24)
    print(f"   📊 24시간 내 개입: {history['count']}회")
    
    if history['hours_since_last']:
        print(f"   ⏰ 마지막 개입: {history['hours_since_last']:.1f}시간 전")
        print(f"   📅 시간: {history['last_intervention']}")
    else:
        print("   ⚠️ 최근 개입 없음")
    
    # 2. 오늘 개입 횟수
    print("\n2️⃣ count_today_interventions()")
    print("-" * 40)
    count = count_today_interventions(supabase)
    print(f"   📊 오늘 개입: {count}회")
    
    # 3. 마지막 개입 시간
    print("\n3️⃣ get_last_intervention_time()")
    print("-" * 40)
    last_time = get_last_intervention_time(supabase)
    if last_time:
        print(f"   ⏰ 마지막 개입: {last_time.strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print("   ⚠️ 개입 이력 없음")
    
    # 4. 수용률 분석 (추가)
    print("\n4️⃣ get_intervention_acceptance_rate(days=30)")
    print("-" * 40)
    rate = get_intervention_acceptance_rate(supabase, days=30)
    print(f"   📊 수용률 (최근 30일):")
    print(f"      - 총 개입: {rate['total']}회")
    print(f"      - 응답: {rate['responded']}회")
    print(f"      - 무시: {rate['dismissed']}회")
    print(f"      - 수용률: {rate['acceptance_rate'] * 100:.1f}%")
    
    # 5. 빈도 기반 개입 가능 여부 (추가)
    print("\n5️⃣ should_intervene_based_on_frequency()")
    print("-" * 40)
    freq_check = should_intervene_based_on_frequency(
        supabase,
        max_per_day=2,
        min_hours_between=4
    )
    
    if freq_check['should_intervene']:
        print(f"   ✅ 개입 가능")
    else:
        print(f"   ⏭️ 개입 불가: {freq_check['reason']}")
    
    print(f"      - 오늘 개입: {freq_check['today_count']}회")
    if freq_check['hours_since_last']:
        print(f"      - 마지막 개입: {freq_check['hours_since_last']:.1f}시간 전")


def test_integration():
    """통합 시나리오 테스트"""
    print("\n" + "=" * 60)
    print("🧪 통합 시나리오 테스트")
    print("=" * 60)
    
    print("\n시나리오: 개입 필요 여부 판단")
    print("-" * 40)
    
    # 1. 감정 패턴 분석
    consecutive_negative = get_consecutive_emotions(supabase, emotion_type="negative")
    print(f"1. 연속 부정 감정: {consecutive_negative}개")
    
    # 2. 최근 활동
    days_since = get_days_since_last_record(supabase)
    if days_since:
        print(f"2. 마지막 기록: {days_since}일 전")
    else:
        print(f"2. 마지막 기록: 오늘")
    
    # 3. 통계
    stats = get_emotion_statistics(supabase, days=7)
    print(f"3. 최근 7일 통계:")
    print(f"   - 긍정/부정 비율: {stats['positive_count']}/{stats['negative_count']}")
    
    # 4. 개입 빈도 체크
    freq_check = should_intervene_based_on_frequency(supabase)
    print(f"4. 빈도 체크: {'가능' if freq_check['should_intervene'] else '불가'}")
    
    # 5. 종합 판단
    print(f"\n📊 종합 판단:")
    
    reasons = []
    
    if consecutive_negative >= 3:
        reasons.append(f"연속 부정 감정 {consecutive_negative}개")
    
    if days_since and days_since > 3:
        reasons.append(f"장기간 기록 없음 ({days_since}일)")
    
    if stats['total_count'] > 0:
        negative_ratio = stats['negative_count'] / stats['total_count']
        if negative_ratio > 0.6:
            reasons.append(f"부정 감정 비율 높음 ({negative_ratio:.0%})")
    
    if not freq_check['should_intervene']:
        reasons.append(f"빈도 제한 ({freq_check['reason']})")
    
    if reasons:
        print(f"   ⚠️ 개입 필요:")
        for i, reason in enumerate(reasons, 1):
            print(f"      {i}. {reason}")
    else:
        print(f"   ✅ 정상 범위")


def main():
    """메인 테스트 실행"""
    print("\n" + "🚀 Tools 테스트 시작")
    print(f"📡 Supabase: {os.getenv('SUPABASE_URL')}")
    print(f"👤 기본 사용자: {DEFAULT_USER_ID}\n")
    
    try:
        # 1. Emotion Tools
        test_emotion_tools()
        
        # 2. Intervention Tools
        test_intervention_tools()
        
        # 3. 통합 시나리오
        test_integration()
        
        print("\n" + "=" * 60)
        print("✅ 모든 테스트 완료!")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()