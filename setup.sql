-- tasks: 업무 목록
create table tasks (
  id text primary key,
  name text not null,
  difficulty integer not null default 2 check (difficulty between 1 and 5),
  created_at timestamptz default now()
);

-- assignments: 업무 배정 (task_id → employee_name)
create table assignments (
  task_id text primary key references tasks(id) on delete cascade,
  employee_name text not null,
  updated_at timestamptz default now()
);

-- evaluations: 직원 난이도 자기평가
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  task_id text not null references tasks(id) on delete cascade,
  difficulty_rating integer not null check (difficulty_rating between 1 and 5),
  submitted_at timestamptz default now(),
  unique (employee_name, task_id)
);

-- desired_tasks: 직원 희망업무
create table desired_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  task_id text not null references tasks(id) on delete cascade,
  unique (employee_name, task_id)
);

-- RLS 활성화
alter table tasks enable row level security;
alter table assignments enable row level security;
alter table evaluations enable row level security;
alter table desired_tasks enable row level security;

-- 전체 읽기/쓰기 허용 (anon key 사용)
create policy "public read tasks" on tasks for select using (true);
create policy "public write tasks" on tasks for all using (true) with check (true);

create policy "public read assignments" on assignments for select using (true);
create policy "public write assignments" on assignments for all using (true) with check (true);

create policy "public read evaluations" on evaluations for select using (true);
create policy "public write evaluations" on evaluations for all using (true) with check (true);

create policy "public read desired_tasks" on desired_tasks for select using (true);
create policy "public write desired_tasks" on desired_tasks for all using (true) with check (true);

-- 초기 업무 데이터
insert into tasks (id, name, difficulty) values
  ('t1', '사업계획 수립', 4),
  ('t2', '예산 관리', 3),
  ('t3', '보고서 작성', 2),
  ('t4', '데이터 분석', 3),
  ('t5', '고객 응대', 2),
  ('t6', '교육 운영', 3),
  ('t7', '시스템 관리', 3),
  ('t8', '문서 관리', 1),
  ('t9', '회의 진행', 2),
  ('t10', '성과 관리', 4);
