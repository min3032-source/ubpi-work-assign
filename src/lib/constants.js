export const EMPLOYEES = [
  { name: '이희원', grade: '책임', type: '정규직' },
  { name: '이예림', grade: '선임', type: '육아휴직대체' },
  { name: '이유정', grade: '선임', type: '정규직' },
  { name: '이선경', grade: '선임', type: '계약직' },
  { name: '강나원', grade: '선임', type: '정규직' },
  { name: '김규하', grade: '선임', type: '정규직' },
  { name: '김규선', grade: '선임', type: '계약직' },
]

export const GRADE_OPTIONS = ['책임', '선임', '주임']
export const TYPE_OPTIONS = ['정규직', '계약직', '육아휴직대체']
export const PROJECTS = ['U-시리즈', '청년아카데미', '로컬창업', '소상공인', '마을기업']

export const COMMON_TASKS = [
  { id: 'common_0', name: '팀 회의자료 작성', project: '공통업무' },
  { id: 'common_1', name: '홈페이지 공고 담당', project: '공통업무' },
  { id: 'common_2', name: '문서관리', project: '공통업무' },
  { id: 'common_3', name: '도서·자산관리', project: '공통업무' },
  { id: 'common_4', name: '부서 요청자료 취합', project: '공통업무' },
  { id: 'common_5', name: '직원 교육훈련 담당', project: '공통업무' },
  { id: 'common_6', name: '주간·월간 보고자료', project: '공통업무' },
]

export const PROJECT_TASKS = {
  'U-시리즈': [
    '교육 프로그램 운영', '기술·제품 실증 및 개발지원', '맞춤형 창업공간 지원',
    '맞춤형 멘토링 운영', '기술보호·경영 전문서비스', '마케팅 지원',
    'AI 솔루션 융합 창업육성', '사업예산 관리·성과보고',
  ],
  '청년아카데미': [
    '발굴육성 14개사 관리', '성장지원 8개사 관리', '창업활동비 검토 및 지급',
    '현장점검·중간평가', '창업교육·멘토링 운영', '창업페스티벌·플리마켓', '사업 회계 집행 관리',
  ],
  '로컬창업': [
    '사업 총괄·기관협력', '체험점포 운영·관리', '기업관리·멘토링',
    '교육 프로그램 운영', '예산 집행·성과 정리', '홍보·모집·평가 지원',
  ],
  '소상공인': [
    '사업홍보·신청서류 검토', '현장점검·지원금 지급',
    '부정수급 모니터링·환수', '사업결과·성과 관리',
  ],
  '마을기업': [
    '아카데미 운영·공동체 사업화 상담', '마을기업 관리·판로지원',
    '사업 예산 집행 및 정산', '관계기관 협력업무', '문서관리·팀 자산관리',
  ],
}

export const INITIAL_TASKS = Object.entries(PROJECT_TASKS).flatMap(([project, names]) =>
  names.map((name, i) => ({
    id: `${project}_${i}`,
    name,
    difficulty: 2,
    project,
  }))
)
