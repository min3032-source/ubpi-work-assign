-- ============================================================
-- auth_migration.sql
-- Supabase Auth 연동 마이그레이션 (단독 실행 가능)
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 기본 테이블 생성 (없는 경우에만)
-- ──────────────────────────────────────────────────────────

create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  org_id     uuid references organizations(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  dept_id    uuid references departments(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  grade      text,
  type       text,
  team_id    uuid references teams(id),
  created_at timestamptz default now()
);

create table if not exists tasks (
  id         text primary key,
  name       text not null,
  difficulty integer default 2,
  project    text default '기타',
  team_id    uuid references teams(id),
  created_at timestamptz default now()
);

create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  task_id       text,
  employee_name text,
  team_id       uuid references teams(id),
  created_at    timestamptz default now()
);

create table if not exists secondary_assignments (
  id            uuid primary key default gen_random_uuid(),
  task_id       text,
  employee_name text,
  team_id       uuid references teams(id),
  created_at    timestamptz default now()
);

create table if not exists evaluations (
  id                uuid primary key default gen_random_uuid(),
  employee_name     text,
  task_id           text,
  difficulty_rating integer,
  notes             text,
  submitted_at      timestamptz,
  team_id           uuid references teams(id),
  created_at        timestamptz default now()
);

create table if not exists desired_tasks (
  id            uuid primary key default gen_random_uuid(),
  employee_name text,
  task_id       text,
  priority      integer,
  team_id       uuid references teams(id),
  created_at    timestamptz default now()
);

create table if not exists team_workflow_status (
  team_id       uuid primary key references teams(id) on delete cascade,
  current_stage text not null default 'survey',
  updated_at    timestamptz default now()
);

-- 2. employees 테이블에 Auth 컬럼 추가
-- ──────────────────────────────────────────────────────────
alter table employees
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists role         text not null default 'employee',
  add column if not exists email        text;

create unique index if not exists employees_auth_user_id_uq
  on employees(auth_user_id) where auth_user_id is not null;

alter table employees
  drop constraint if exists employees_role_check;
alter table employees
  add constraint employees_role_check
  check (role in ('admin', 'director', 'manager', 'employee'));

-- 3. RLS 재귀 방지용 security definer 함수
-- ──────────────────────────────────────────────────────────
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from employees where auth_user_id = auth.uid() limit 1;
$$;

-- 4. employees RLS 재설정
-- ──────────────────────────────────────────────────────────
alter table employees enable row level security;

drop policy if exists "employees_all"           on employees;
drop policy if exists "employees_auth_read"     on employees;
drop policy if exists "employees_admin_insert"  on employees;
drop policy if exists "employees_admin_update"  on employees;
drop policy if exists "employees_admin_delete"  on employees;

create policy "employees_auth_read"    on employees for select using (auth.uid() is not null);
create policy "employees_admin_insert" on employees for insert with check (get_my_role() = 'admin');
create policy "employees_admin_update" on employees for update using (get_my_role() = 'admin');
create policy "employees_admin_delete" on employees for delete using (get_my_role() = 'admin');

-- 5. 나머지 테이블: 인증된 사용자만 접근
-- ──────────────────────────────────────────────────────────

alter table tasks enable row level security;
drop policy if exists "tasks_all" on tasks;
drop policy if exists "tasks_authenticated" on tasks;
create policy "tasks_authenticated" on tasks
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table assignments enable row level security;
drop policy if exists "assignments_all" on assignments;
drop policy if exists "assignments_authenticated" on assignments;
create policy "assignments_authenticated" on assignments
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table secondary_assignments enable row level security;
drop policy if exists "secondary_assignments_all" on secondary_assignments;
drop policy if exists "secondary_assignments_authenticated" on secondary_assignments;
create policy "secondary_assignments_authenticated" on secondary_assignments
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table evaluations enable row level security;
drop policy if exists "evaluations_all" on evaluations;
drop policy if exists "evaluations_authenticated" on evaluations;
create policy "evaluations_authenticated" on evaluations
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table desired_tasks enable row level security;
drop policy if exists "desired_tasks_all" on desired_tasks;
drop policy if exists "desired_tasks_authenticated" on desired_tasks;
create policy "desired_tasks_authenticated" on desired_tasks
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table team_workflow_status enable row level security;
drop policy if exists "team_workflow_all" on team_workflow_status;
drop policy if exists "team_workflow_authenticated" on team_workflow_status;
create policy "team_workflow_authenticated" on team_workflow_status
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- 6. organizations / departments / teams: 읽기=인증, 쓰기=admin
-- ──────────────────────────────────────────────────────────

alter table organizations enable row level security;
drop policy if exists "organizations_all"  on organizations;
drop policy if exists "org_read"           on organizations;
drop policy if exists "org_admin_write"    on organizations;
create policy "org_read"        on organizations for select using (auth.uid() is not null);
create policy "org_admin_write" on organizations for all
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

alter table departments enable row level security;
drop policy if exists "departments_all"  on departments;
drop policy if exists "dept_read"        on departments;
drop policy if exists "dept_admin_write" on departments;
create policy "dept_read"        on departments for select using (auth.uid() is not null);
create policy "dept_admin_write" on departments for all
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

alter table teams enable row level security;
drop policy if exists "teams_all"        on teams;
drop policy if exists "team_read"        on teams;
drop policy if exists "team_admin_write" on teams;
create policy "team_read"        on teams for select using (auth.uid() is not null);
create policy "team_admin_write" on teams for all
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

-- 7. 관리자 계정 최초 설정 (계정 생성 후 실행)
-- ──────────────────────────────────────────────────────────
-- update employees
-- set role        = 'admin',
--     auth_user_id = '<Supabase Auth UUID>',
--     email        = '<이메일>'
-- where name = '관리자이름';
