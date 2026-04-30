-- ============================================================
-- full_migration.sql
-- 진흥원 전체 부서/팀 구조 전면 개편
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 새 테이블 생성
-- ──────────────────────────────────────────────────────────

create table if not exists organizations (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists departments (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  org_id uuid references organizations(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists teams (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  dept_id uuid references departments(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists team_workflow_status (
  team_id       uuid primary key references teams(id) on delete cascade,
  current_stage text not null default 'survey',
  updated_at    timestamptz default now()
);

-- 2. 기존 테이블에 team_id 컬럼 추가
-- ──────────────────────────────────────────────────────────

alter table employees          add column if not exists team_id uuid references teams(id);
alter table tasks               add column if not exists team_id uuid references teams(id);
alter table assignments         add column if not exists team_id uuid references teams(id);
alter table secondary_assignments add column if not exists team_id uuid references teams(id);
alter table evaluations         add column if not exists team_id uuid references teams(id);
alter table desired_tasks       add column if not exists team_id uuid references teams(id);

-- 3. RLS 정책
-- ──────────────────────────────────────────────────────────

alter table organizations         enable row level security;
alter table departments           enable row level security;
alter table teams                 enable row level security;
alter table team_workflow_status  enable row level security;

drop policy if exists "organizations_all"   on organizations;
drop policy if exists "departments_all"     on departments;
drop policy if exists "teams_all"           on teams;
drop policy if exists "team_workflow_all"   on team_workflow_status;

create policy "organizations_all"  on organizations        for all using (true) with check (true);
create policy "departments_all"    on departments          for all using (true) with check (true);
create policy "teams_all"          on teams                for all using (true) with check (true);
create policy "team_workflow_all"  on team_workflow_status for all using (true) with check (true);

-- 4. 초기 데이터: 진흥원 > 창업지원부 > 창업육성팀
-- ──────────────────────────────────────────────────────────

insert into organizations (id, name)
values ('10000000-0000-0000-0000-000000000001'::uuid, '진흥원')
on conflict (id) do nothing;

insert into departments (id, name, org_id)
values ('20000000-0000-0000-0000-000000000001'::uuid, '창업지원부',
        '10000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

insert into teams (id, name, dept_id)
values ('30000000-0000-0000-0000-000000000001'::uuid, '창업육성팀',
        '20000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

insert into team_workflow_status (team_id, current_stage)
values ('30000000-0000-0000-0000-000000000001'::uuid, 'survey')
on conflict (team_id) do nothing;

-- 5. 기존 데이터를 창업육성팀에 배정
-- ──────────────────────────────────────────────────────────

update employees           set team_id = '30000000-0000-0000-0000-000000000001'::uuid where team_id is null;
update tasks               set team_id = '30000000-0000-0000-0000-000000000001'::uuid where team_id is null;
update assignments         set team_id = '30000000-0000-0000-0000-000000000001'::uuid where team_id is null;
update secondary_assignments set team_id = '30000000-0000-0000-0000-000000000001'::uuid where team_id is null;
update evaluations         set team_id = '30000000-0000-0000-0000-000000000001'::uuid where team_id is null;
update desired_tasks       set team_id = '30000000-0000-0000-0000-000000000001'::uuid where team_id is null;

-- 6. 초기 직원 7명 (없는 경우만 삽입)
-- ──────────────────────────────────────────────────────────

insert into employees (name, grade, type, team_id)
select v.name, v.grade, v.type, '30000000-0000-0000-0000-000000000001'::uuid
from (values
  ('이희원', '책임', '정규직'),
  ('이예림', '선임', '육아휴직대체'),
  ('이유정', '선임', '정규직'),
  ('이선경', '선임', '계약직'),
  ('강나원', '선임', '정규직'),
  ('김규하', '선임', '정규직'),
  ('김규선', '선임', '계약직')
) as v(name, grade, type)
where not exists (
  select 1 from employees e where e.name = v.name
);

-- 7. 업무 초기 데이터 (없는 경우만 삽입)
-- ──────────────────────────────────────────────────────────

insert into tasks (id, name, difficulty, project, team_id)
select v.id, v.name, v.difficulty::integer, v.project,
       '30000000-0000-0000-0000-000000000001'::uuid
from (values
  -- U-시리즈 (8개)
  ('U-시리즈_0', '교육 프로그램 운영',             '2', 'U-시리즈'),
  ('U-시리즈_1', '기술·제품 실증 및 개발지원',      '2', 'U-시리즈'),
  ('U-시리즈_2', '맞춤형 창업공간 지원',            '2', 'U-시리즈'),
  ('U-시리즈_3', '맞춤형 멘토링 운영',              '2', 'U-시리즈'),
  ('U-시리즈_4', '기술보호·경영 전문서비스',        '2', 'U-시리즈'),
  ('U-시리즈_5', '마케팅 지원',                     '2', 'U-시리즈'),
  ('U-시리즈_6', 'AI 솔루션 융합 창업육성',         '2', 'U-시리즈'),
  ('U-시리즈_7', '사업예산 관리·성과보고',          '2', 'U-시리즈'),
  -- 청년아카데미 (7개)
  ('청년아카데미_0', '발굴육성 14개사 관리',         '2', '청년아카데미'),
  ('청년아카데미_1', '성장지원 8개사 관리',          '2', '청년아카데미'),
  ('청년아카데미_2', '창업활동비 검토 및 지급',      '2', '청년아카데미'),
  ('청년아카데미_3', '현장점검·중간평가',            '2', '청년아카데미'),
  ('청년아카데미_4', '창업교육·멘토링 운영',         '2', '청년아카데미'),
  ('청년아카데미_5', '창업페스티벌·플리마켓',        '2', '청년아카데미'),
  ('청년아카데미_6', '사업 회계 집행 관리',          '2', '청년아카데미'),
  -- 로컬창업 (6개)
  ('로컬창업_0', '사업 총괄·기관협력',              '2', '로컬창업'),
  ('로컬창업_1', '체험점포 운영·관리',              '2', '로컬창업'),
  ('로컬창업_2', '기업관리·멘토링',                 '2', '로컬창업'),
  ('로컬창업_3', '교육 프로그램 운영',              '2', '로컬창업'),
  ('로컬창업_4', '예산 집행·성과 정리',             '2', '로컬창업'),
  ('로컬창업_5', '홍보·모집·평가 지원',             '2', '로컬창업'),
  -- 소상공인 (4개)
  ('소상공인_0', '사업홍보·신청서류 검토',           '2', '소상공인'),
  ('소상공인_1', '현장점검·지원금 지급',             '2', '소상공인'),
  ('소상공인_2', '부정수급 모니터링·환수',           '2', '소상공인'),
  ('소상공인_3', '사업결과·성과 관리',              '2', '소상공인'),
  -- 마을기업 (5개)
  ('마을기업_0', '아카데미 운영·공동체 사업화 상담', '2', '마을기업'),
  ('마을기업_1', '마을기업 관리·판로지원',           '2', '마을기업'),
  ('마을기업_2', '사업 예산 집행 및 정산',           '2', '마을기업'),
  ('마을기업_3', '관계기관 협력업무',                '2', '마을기업'),
  ('마을기업_4', '문서관리·팀 자산관리',             '2', '마을기업'),
  -- 공통업무 (7개)
  ('common_0', '팀 회의자료 작성',                   '2', '공통업무'),
  ('common_1', '홈페이지 공고 담당',                 '2', '공통업무'),
  ('common_2', '문서관리',                            '2', '공통업무'),
  ('common_3', '도서·자산관리',                      '2', '공통업무'),
  ('common_4', '부서 요청자료 취합',                 '2', '공통업무'),
  ('common_5', '직원 교육훈련 담당',                 '2', '공통업무'),
  ('common_6', '주간·월간 보고자료',                 '2', '공통업무')
) as v(id, name, difficulty, project)
where not exists (select 1 from tasks t where t.id = v.id);
