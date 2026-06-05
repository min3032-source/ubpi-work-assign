ALTER TABLE work_items ADD COLUMN IF NOT EXISTS work_type text DEFAULT '사업업무' CHECK (work_type IN ('사업업무','정기업무','행정업무','돌발업무'));
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS recurring_cycle text CHECK (recurring_cycle IN ('매주','매월','매년'));

CREATE TABLE IF NOT EXISTS work_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id uuid REFERENCES work_items(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id),
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE work_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_preferences_all" ON work_preferences FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
