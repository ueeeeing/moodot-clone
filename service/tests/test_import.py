# test_import.py (임시 파일)
print("=== 임포트 테스트 ===")

# 방법 1
try:
    from supabase import AsyncClient
    print("✅ from supabase import AsyncClient - 성공")
except ImportError as e:
    print(f"❌ from supabase import AsyncClient - 실패: {e}")

# 방법 2
try:
    from supabase.client import AsyncClient
    print("✅ from supabase.client import AsyncClient - 성공")
except ImportError as e:
    print(f"❌ from supabase.client import AsyncClient - 실패: {e}")

# 방법 3
try:
    import supabase
    print(f"✅ supabase 패키지: {dir(supabase)}")
except Exception as e:
    print(f"❌ {e}")
