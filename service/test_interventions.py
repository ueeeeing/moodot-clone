# test_interventions.py
"""
Interventions 테이블 및 모델 테스트
"""
import os
import asyncio
from dotenv import load_dotenv
from supabase import acreate_client

from models import (
    Intervention,
    InterventionStatus,
    InterventionReason,
    InterventionRepository
)

load_dotenv('.env.local')


async def create_supabase_client():
    """비동기 Supabase 클라이언트 생성"""
    return await acreate_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )


async def test_create(repo: InterventionRepository):
    """개입 생성 테스트"""
    print("=" * 60)
    print("🧪 Intervention 생성 테스트")
    print("=" * 60)
    
    intervention = Intervention(
        reason=InterventionReason.NO_RECENT_RECORD.value,
        message="테스트 메시지입니다!"
    )
    
    print(f"\n생성할 개입:")
    print(f"  - 이유: {intervention.reason}")
    print(f"  - 메시지: {intervention.message}")
    print(f"  - 상태: {intervention.status}")
    
    intervention_id = await repo.create(intervention)
    
    if intervention_id:
        print(f"✅ 생성 성공: {intervention_id}")
    else:
        print("❌ 생성 실패")
    
    return intervention_id


async def test_get_pending(repo: InterventionRepository):
    """Pending 조회 테스트"""
    print("\n" + "=" * 60)
    print("🧪 Pending 개입 조회 테스트")
    print("=" * 60)
    
    interventions = await repo.get_pending(limit=5)
    
    print(f"\nPending 개입: {len(interventions)}개")
    
    for i, intervention in enumerate(interventions, 1):
        print(f"\n{i}. {intervention.message}")
        print(f"   이유: {intervention.reason}")
        print(f"   상태: {intervention.status}")
        print(f"   생성: {intervention.created_at}")


async def test_update_status(repo: InterventionRepository, intervention_id: str):
    """상태 업데이트 테스트"""
    print("\n" + "=" * 60)
    print("🧪 상태 업데이트 테스트")
    print("=" * 60)
    
    print(f"\n개입 ID: {intervention_id}")
    print(f"변경: pending → shown")
    
    success = await repo.update_status(
        intervention_id,
        InterventionStatus.SHOWN
    )
    
    if success:
        print("✅ 상태 업데이트 성공")
    else:
        print("❌ 상태 업데이트 실패")


async def test_count_today(repo: InterventionRepository):
    """오늘 개입 횟수 테스트"""
    print("\n" + "=" * 60)
    print("🧪 오늘 개입 횟수 테스트")
    print("=" * 60)
    
    count = await repo.count_today()
    
    print(f"\n오늘 개입: {count}회")


async def test_get_recent(repo: InterventionRepository):
    """최근 개입 조회 테스트"""
    print("\n" + "=" * 60)
    print("🧪 최근 개입 조회 테스트")
    print("=" * 60)
    
    interventions = await repo.get_recent(hours=24, limit=10)
    
    print(f"\n24시간 내 개입: {len(interventions)}개")
    
    for intervention in interventions:
        print(f"- {intervention.message} ({intervention.status})")


async def test_multiple_create(repo: InterventionRepository):
    """여러 개입 생성 테스트 (추가)"""
    print("\n" + "=" * 60)
    print("🧪 여러 개입 생성 테스트")
    print("=" * 60)
    
    test_interventions = [
        Intervention(
            reason=InterventionReason.NO_RECENT_RECORD.value,
            message="오랜만이네요! 요즘 어떻게 지내세요?"
        ),
        Intervention(
            reason=InterventionReason.NEGATIVE_STREAK.value,
            message="힘든 시간을 보내고 있는 것 같아요. 괜찮으신가요?"
        ),
        Intervention(
            reason=InterventionReason.POSITIVE_STREAK.value,
            message="좋은 일들이 계속되고 있네요! 축하드려요 🎉"
        ),
    ]
    
    created_ids = []
    
    for i, intervention in enumerate(test_interventions, 1):
        print(f"\n{i}. 생성 중: {intervention.message[:30]}...")
        intervention_id = await repo.create(intervention)
        
        if intervention_id:
            print(f"   ✅ 성공: {intervention_id}")
            created_ids.append(intervention_id)
        else:
            print(f"   ❌ 실패")
    
    print(f"\n총 {len(created_ids)}개 생성 완료")
    return created_ids


async def test_update_multiple_status(repo: InterventionRepository, intervention_ids: list):
    """여러 상태 업데이트 테스트 (추가)"""
    print("\n" + "=" * 60)
    print("🧪 여러 상태 업데이트 테스트")
    print("=" * 60)
    
    statuses = [
        InterventionStatus.SHOWN,
        InterventionStatus.DISMISSED,
        InterventionStatus.INTERACTED
    ]
    
    for intervention_id, status in zip(intervention_ids, statuses):
        print(f"\n{intervention_id} → {status}")
        success = await repo.update_status(intervention_id, status)
        
        if success:
            print(f"  ✅ 업데이트 성공")
        else:
            print(f"  ❌ 업데이트 실패")


async def main():
    """전체 테스트 실행"""
    print("\n🚀 Interventions 테스트 시작 (user_id 제거 버전)\n")
    
    try:
        # Supabase 클라이언트 생성
        supabase = await create_supabase_client()
        repo = InterventionRepository(supabase)
        
        # 1. 단일 생성 테스트
        intervention_id = await test_create(repo)
        
        # 2. Pending 조회 테스트
        await test_get_pending(repo)
        
        # 3. 상태 업데이트 테스트
        if intervention_id:
            await test_update_status(repo, intervention_id)
        
        # 4. 통계 테스트
        await test_count_today(repo)
        await test_get_recent(repo)
        
        # 5. 여러 개입 생성 테스트 (추가)
        created_ids = await test_multiple_create(repo)
        
        # 6. 여러 상태 업데이트 테스트 (추가)
        if created_ids:
            await test_update_multiple_status(repo, created_ids[:3])
        
        # 7. 최종 통계
        print("\n" + "=" * 60)
        print("📊 최종 통계")
        print("=" * 60)
        await test_count_today(repo)
        await test_get_pending(repo)
        
        print("\n" + "=" * 60)
        print("✅ 모든 테스트 완료!")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n💥 오류: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())