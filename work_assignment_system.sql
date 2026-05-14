-- =============================================
-- 울산경제일자리진흥원 창업지원부 업무분장 시스템
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 사업 테이블
CREATE TABLE IF NOT EXISTS projects (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  type         text NOT NULL CHECK (type IN ('창업지원','기업지원','일자리지원','교육사업','마케팅지원','기타')),
  description  text,
  start_date   date,
  end_date     date,
  team_id      uuid REFERENCES teams(id),
  status       text DEFAULT '진행중' CHECK (status IN ('준비중','진행중','완료','취소')),
  created_by   uuid REFERENCES employees(id),
  created_at   timestamptz DEFAULT now()
);

-- 2. 업무 항목 테이블
CREATE TABLE IF NOT EXISTS work_items (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       uuid REFERENCES projects(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  category         text,
  difficulty       int CHECK (difficulty BETWEEN 1 AND 5),
  is_auto_generated boolean DEFAULT false,
  status           text DEFAULT '미배정' CHECK (status IN ('미배정','배정완료','진행중','완료')),
  created_by       uuid REFERENCES employees(id),
  created_at       timestamptz DEFAULT now()
);

-- 3. 업무 배정 테이블
CREATE TABLE IF NOT EXISTS work_assignments (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id      uuid REFERENCES work_items(id) ON DELETE CASCADE,
  employee_id       uuid REFERENCES employees(id),
  difficulty_opinion int CHECK (difficulty_opinion BETWEEN 1 AND 5),
  is_primary        boolean DEFAULT true,
  status            text DEFAULT '진행중' CHECK (status IN ('진행중','완료','보류')),
  assigned_by       uuid REFERENCES employees(id),
  approved_by       uuid REFERENCES employees(id),
  assigned_at       timestamptz DEFAULT now()
);

-- 4. 의견/댓글 테이블
CREATE TABLE IF NOT EXISTS work_comments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id uuid REFERENCES work_items(id) ON DELETE CASCADE,
  employee_id  uuid REFERENCES employees(id),
  comment      text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- 5. 직급별 난이도 기준 테이블
CREATE TABLE IF NOT EXISTS grade_difficulty_standards (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  grade       text NOT NULL,
  max_score   int NOT NULL,
  description text
);

-- 기본 직급 기준 데이터 삽입
INSERT INTO grade_difficulty_standards (grade, max_score, description) VALUES
  ('주임',   15, '팀원 주임급'),
  ('선임',   18, '팀원 선임급'),
  ('책임',   20, '팀원 책임급'),
  ('팀장',   25, '팀장급 (관리업무 포함)'),
  ('부장',   30, '부장급 (결재업무 포함)'),
  ('관리자', 30, '관리자');

-- =============================================
-- RLS (Row Level Security) 설정
-- =============================================

ALTER TABLE projects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_difficulty_standards ENABLE ROW LEVEL SECURITY;

-- 전체 읽기 허용 (로그인 사용자)
CREATE POLICY "projects_read"       ON projects                 FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_items_read"     ON work_items               FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_assignments_read" ON work_assignments       FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_comments_read"  ON work_comments            FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "grade_standards_read" ON grade_difficulty_standards FOR SELECT USING (auth.uid() IS NOT NULL);

-- 쓰기 허용 (로그인 사용자 전체)
CREATE POLICY "projects_write"      ON projects                 FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_items_write"    ON work_items               FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_assignments_write" ON work_assignments      FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "work_comments_write" ON work_comments            FOR ALL USING (auth.uid() IS NOT NULL);
