// تعريف سجل الدرجات الذي كان مفقوداً
export interface GradeRecord {
  id: string;
  studentId: string;
  category: string;
  subject: string;
  score: number;
  maxScore: number;
  date: string;
  semester?: '1' | '2';
}

// تعريف الطالب
export interface Student {
  id: string;
  civilId: string;
  name: string;
  gender: 'male' | 'female';
  classes: string[];
  attendance?: any[];
  grades?: GradeRecord[]; // قمنا بربط الدرجات هنا
  behavior?: any[];
}