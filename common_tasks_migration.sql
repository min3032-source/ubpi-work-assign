-- Supabase SQL Editor에서 실행해주세요
-- 공통업무(common_0~6) 난이도 의견 및 희망업무 저장을 위해
-- evaluations, desired_tasks의 task_id FK 제약 조건을 제거합니다.

alter table evaluations drop constraint if exists evaluations_task_id_fkey;
alter table desired_tasks drop constraint if exists desired_tasks_task_id_fkey;
