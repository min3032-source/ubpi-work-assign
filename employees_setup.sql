-- employees 테이블 생성
create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text not null,
  type text not null,
  created_at timestamptz default now()
);

alter table employees enable row level security;
create policy "public read employees" on employees for select using (true);
create policy "public write employees" on employees for all using (true) with check (true);

-- 초기 직원 데이터
insert into employees (name, grade, type) values
  ('이희원', '책임', '정규직'),
  ('이예림', '선임', '육아휴직대체'),
  ('이유정', '선임', '정규직'),
  ('이선경', '선임', '계약직'),
  ('강나원', '선임', '정규직'),
  ('김규하', '선임', '정규직'),
  ('김규선', '선임', '계약직');

-- tasks 테이블에 project 컬럼 추가
alter table tasks add column project text not null default '기타';

-- 기존 데이터 삭제 후 사업별 업무로 교체
delete from assignments;
delete from tasks;

insert into tasks (id, name, difficulty, project) values
  -- U-시리즈
  ('u1', '교육 프로그램 운영', 2, 'U-시리즈'),
  ('u2', '기술·제품 실증 및 개발지원', 3, 'U-시리즈'),
  ('u3', '맞춤형 창업공간 지원', 2, 'U-시리즈'),
  ('u4', '맞춤형 멘토링 운영', 3, 'U-시리즈'),
  ('u5', '기술보호·경영 전문서비스', 3, 'U-시리즈'),
  ('u6', '마케팅 지원', 2, 'U-시리즈'),
  ('u7', 'AI 솔루션 융합 창업육성', 4, 'U-시리즈'),
  ('u8', '사업예산 관리·성과보고', 3, 'U-시리즈'),
  -- 청년아카데미
  ('y1', '발굴육성 14개사 관리', 3, '청년아카데미'),
  ('y2', '성장지원 8개사 관리', 3, '청년아카데미'),
  ('y3', '창업활동비 검토 및 지급', 2, '청년아카데미'),
  ('y4', '현장점검·중간평가', 3, '청년아카데미'),
  ('y5', '창업교육·멘토링 운영', 2, '청년아카데미'),
  ('y6', '창업페스티벌·플리마켓', 2, '청년아카데미'),
  ('y7', '사업 회계 집행 관리', 3, '청년아카데미'),
  -- 로컬창업
  ('l1', '사업 총괄·기관협력', 4, '로컬창업'),
  ('l2', '체험점포 운영·관리', 2, '로컬창업'),
  ('l3', '기업관리·멘토링', 3, '로컬창업'),
  ('l4', '교육 프로그램 운영', 2, '로컬창업'),
  ('l5', '예산 집행·성과 정리', 3, '로컬창업'),
  ('l6', '홍보·모집·평가 지원', 2, '로컬창업'),
  -- 소상공인
  ('s1', '사업홍보·신청서류 검토', 2, '소상공인'),
  ('s2', '현장점검·지원금 지급', 3, '소상공인'),
  ('s3', '부정수급 모니터링·환수', 3, '소상공인'),
  ('s4', '사업결과·성과 관리', 3, '소상공인'),
  -- 마을기업
  ('m1', '아카데미 운영·공동체 사업화 상담', 3, '마을기업'),
  ('m2', '마을기업 관리·판로지원', 3, '마을기업'),
  ('m3', '사업 예산 집행 및 정산', 3, '마을기업'),
  ('m4', '관계기관 협력업무', 2, '마을기업'),
  ('m5', '문서관리·팀 자산관리', 1, '마을기업');
