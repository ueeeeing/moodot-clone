-- ============================================================
-- Moodot: Thread (Collection) 기능 DB 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. threads 테이블
create table if not exists public.threads (
  id            bigserial primary key,
  title         text        not null,
  location_name text,
  start_date    date,
  end_date      date,
  note          text,
  cover_image_url text,
  cover_memory_id bigint references public.memories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. thread_memories 조인 테이블
--    memory 하나는 최대 하나의 thread에만 속할 수 있음 (unique memory_id)
create table if not exists public.thread_memories (
  id          bigserial primary key,
  thread_id   bigint   not null references public.threads(id) on delete cascade,
  memory_id   bigint   not null references public.memories(id) on delete cascade,
  order_index integer  not null default 0,
  unique (memory_id)
);

-- 3. updated_at 자동 갱신 트리거 (선택 사항)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger threads_updated_at
  before update on public.threads
  for each row execute function public.set_updated_at();

-- 4. RLS (Row Level Security) — 필요 시 활성화
-- alter table public.threads enable row level security;
-- alter table public.thread_memories enable row level security;
