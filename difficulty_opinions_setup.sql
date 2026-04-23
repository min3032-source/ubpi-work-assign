-- Supabase SQL Editor에서 실행해주세요

-- 1. evaluations: 난이도 의견 메모 컬럼 추가
alter table evaluations add column if not exists notes text;

-- 2. desired_tasks: 희망업무 우선순위 컬럼 추가 (1~3순위)
alter table desired_tasks add column if not exists priority integer check (priority between 1 and 3);

-- 3. workflow_status: 진행 단계 관리 테이블
create table if not exists workflow_status (
  id integer primary key default 1,
  current_stage text not null default 'survey'
    check (current_stage in ('survey', 'director_review', 'confirmed')),
  updated_at timestamptz default now()
);
insert into workflow_status (id, current_stage) values (1, 'survey')
  on conflict (id) do nothing;

alter table workflow_status enable row level security;
create policy "public read workflow_status" on workflow_status for select using (true);
create policy "public write workflow_status" on workflow_status for all using (true) with check (true);
