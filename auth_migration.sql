-- ============================================================
-- auth_migration.sql
-- Supabase Auth 연동 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. employees 테이블에 Auth 컬럼 추가
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

-- 2. RLS 재귀 방지용 security definer 함수
-- ──────────────────────────────────────────────────────────
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from employees where auth_user_id = auth.uid() limit 1;
$$;

-- 3. employees RLS 재설정
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

-- 4. 나머지 테이블: 인증된 사용자만 접근
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

drop policy if exists "team_workflow_all" on team_workflow_status;
drop policy if exists "team_workflow_authenticated" on team_workflow_status;
create policy "team_workflow_authenticated" on team_workflow_status
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- 5. organizations / departments / teams: 읽기=인증, 쓰기=admin
-- ──────────────────────────────────────────────────────────

drop policy if exists "organizations_all"  on organizations;
drop policy if exists "org_read"           on organizations;
drop policy if exists "org_admin_write"    on organizations;
create policy "org_read"        on organizations for select using (auth.uid() is not null);
create policy "org_admin_write" on organizations for all
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

drop policy if exists "departments_all" on departments;
drop policy if exists "dept_read"       on departments;
drop policy if exists "dept_admin_write" on departments;
create policy "dept_read"        on departments for select using (auth.uid() is not null);
create policy "dept_admin_write" on departments for all
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

drop policy if exists "teams_all"       on teams;
drop policy if exists "team_read"       on teams;
drop policy if exists "team_admin_write" on teams;
create policy "team_read"        on teams for select using (auth.uid() is not null);
create policy "team_admin_write" on teams for all
  using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

-- 6. 관리자 계정 최초 설정 (계정 생성 후 실행)
-- ──────────────────────────────────────────────────────────
-- update employees
-- set role        = 'admin',
--     auth_user_id = '<Supabase Auth UUID>',
--     email        = '<이메일>'
-- where name = '관리자이름';
