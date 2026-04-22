-- 부담당 배정 테이블 추가 마이그레이션
-- Supabase SQL Editor에서 실행해주세요

create table if not exists secondary_assignments (
  task_id text primary key references tasks(id) on delete cascade,
  employee_name text not null,
  updated_at timestamptz default now()
);

alter table secondary_assignments enable row level security;

create policy "public read secondary_assignments" on secondary_assignments for select using (true);
create policy "public write secondary_assignments" on secondary_assignments for all using (true) with check (true);
