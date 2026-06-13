import React, { useMemo, useState, useEffect } from 'react';
import { StudentAvatar } from './StudentAvatar';
import {
  Star,
  TrendingUp,
  CalendarCheck,
  Zap,
  Target,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Plus,
  Camera
} from 'lucide-react';

// --- 💉 حقن التعريفات مباشرة ---
export interface GradeRecord {
  id: string;
  studentId: string;
  category: string;
  subject: string;
  score: number;
  date: string;
  semester?: '1' | '2';
}

export interface BehaviorRecord {
  id: string;
  type: 'positive' | 'negative';
  category: string;
  points?: number;
  date: string;
  semester?: '1' | '2';
}

export interface Student {
  id: string;
  civilId: string;
  name: string;
  gender: 'male' | 'female';
  classes: string[];
  attendance?: any[];
  grades?: GradeRecord[];
  behavior?: BehaviorRecord[];
  totalKnightsPoints?: number;
}

// --- وظيفة ترجمة واتجاه داخلية مؤقتة ---
const useApp = () => ({
  t: (key: string) => undefined as any,
  dir: 'rtl' as const
});
// --------------------------------------------------

interface StudentDashboardProps {
  student: Student;
  currentSemester: '1' | '2';
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  currentSemester
}) => {
  const { t, dir } = useApp();

  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (student?.civilId) {
      const savedImage = localStorage.getItem(
        `rased_student_avatar_${student.civilId}`
      );

      if (savedImage) {
        setCustomAvatar(savedImage);
      }
    }
  }, [student]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomAvatar(base64String);
        localStorage.setItem(
          `rased_student_avatar_${student.civilId}`,
          base64String
        );
      };

      reader.readAsDataURL(file);
    }
  };

  const attendanceStats = useMemo(() => {
    const semAttendance = student.attendance || [];

    if (semAttendance.length === 0) {
      return {
        present: 0,
        total: 0,
        percentage: 100
      };
    }

    const present = semAttendance.filter(a => a.status === 'present').length;
    const percentage = Math.round((present / semAttendance.length) * 100);

    return {
      present,
      total: semAttendance.length,
      percentage
    };
  }, [student]);

  const academicStats = useMemo(() => {
    const semGrades = (student.grades || []).filter(
      g => (g.semester || '1') === currentSemester
    );

    const totalAssessments = semGrades.length;
    const uniqueSubjects = new Set(semGrades.map(g => g.subject)).size;

    const recent = [...semGrades]
      .sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      .slice(0, 3);

    return {
      totalAssessments,
      uniqueSubjects,
      recent
    };
  }, [student, currentSemester]);

  const knightsPoints = student.totalKnightsPoints || 0;
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div
      className="flex flex-col h-full bg-bgMain text-textPrimary overflow-hidden relative"
      dir={dir}
    >
      {/* الهيدر الفاتح */}
      <header className="sticky top-0 z-50 bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <div className="flex items-center gap-4">
          {/* الصورة الشخصية */}
          <div className="shrink-0 relative group">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="avatar-upload"
              onChange={handleImageUpload}
            />

            <label htmlFor="avatar-upload" className="cursor-pointer block relative">
              {customAvatar ? (
                <img
                  src={customAvatar}
                  alt="Student"
                  className="w-12 h-12 rounded-2xl object-cover border border-borderColor shadow-sm"
                />
              ) : (
                <StudentAvatar
                  gender={student.gender}
                  className="w-12 h-12 border border-borderColor shadow-sm"
                />
              )}

              <div className="absolute -bottom-1.5 -right-1.5 bg-info rounded-full p-1 border-2 border-bgCard shadow-md group-hover:scale-110 transition-transform">
                <Camera className="w-2.5 h-2.5 text-white" />
              </div>
            </label>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-textSecondary text-[10px] font-bold mb-0.5 flex items-center gap-1">
              <Zap className="w-3 h-3 text-warning" />
              {t('studentWelcomePrefix') || 'مرحباً بالبطل،'}
            </h2>

            <h1 className="text-base font-black text-textPrimary leading-tight truncate">
              {student.name}
            </h1>
          </div>

          <div className="shrink-0 pl-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-bgSoft border border-borderColor rounded-xl text-[10px] font-bold text-textSecondary shadow-sm">
              <Target className="w-3 h-3 text-success" />
              {student.classes[0]}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar pb-[100px] px-5 pt-5 space-y-5">
        {/* لوحة النقاط والتقييمات */}
        <div className="bg-amber-50 border border-amber-200 rounded-[1.5rem] p-4 shadow-sm flex items-center justify-between relative overflow-hidden transition-all hover:shadow-card">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-40 blur-3xl rounded-full bg-amber-200 pointer-events-none" />

          <div className="relative z-10 flex flex-col">
            <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">
              {t('totalAssessments') || 'التقييمات المنجزة'}
            </span>

            <span className="text-xl font-black text-textPrimary flex items-baseline gap-1.5">
              <Target className="w-4 h-4 text-warning self-center" />
              {academicStats.totalAssessments}
              <span className="text-[10px] text-textSecondary font-bold">
                تقييم
              </span>
            </span>
          </div>

          <div className="w-[1px] h-10 bg-amber-200 relative z-10" />

          <div className="text-right relative z-10 flex flex-col items-end">
            <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider mb-1">
              {t('knightsPoints') || 'نقاط الفرسان 🏆'}
            </span>

            <span className="text-2xl font-black text-warning flex items-center gap-1">
              <Plus className="w-5 h-5 text-warning" />
              {knightsPoints}
            </span>
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 gap-3 relative z-20 shrink-0">
          <div className="bg-bgCard border border-borderColor rounded-[1.25rem] p-3.5 flex flex-col justify-between shadow-sm transition-all hover:shadow-card hover:border-success/20">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center border border-success/20">
                <CalendarCheck className="w-5 h-5 text-success" />
              </div>

              <span className="text-xl font-black text-textPrimary">
                {attendanceStats.percentage}%
              </span>
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-textSecondary">
                {t('attendanceRate') || 'معدل الحضور'}
              </h3>

              <p className="text-[10px] font-black text-success mt-0.5">
                {attendanceStats.present} {t('daysAttended') || 'يوم حضور'}
              </p>
            </div>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-[1.25rem] p-3.5 flex flex-col justify-between shadow-sm transition-all hover:shadow-card hover:border-info/20">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center border border-info/20">
                <BookOpen className="w-5 h-5 text-info" />
              </div>

              <span className="text-xl font-black text-textPrimary">
                {academicStats.uniqueSubjects}
              </span>
            </div>

            <div>
              <h3 className="text-[10px] font-bold text-textSecondary">
                {t('activeSubjects') || 'المواد النشطة'}
              </h3>

              <p className="text-[10px] font-black text-info mt-0.5">
                {t('subjectsEvaluated') || 'مواد تقييم'}
              </p>
            </div>
          </div>
        </div>

        {/* أحدث الإنجازات */}
        <div className="pb-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-sm font-black text-textPrimary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t('recentActivity') || 'أحدث الدرجات المكتسبة'}
            </h3>

            <button className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-full hover:bg-primary/15 transition-colors flex items-center gap-1">
              {t('viewAll') || 'عرض الكل'}
              <ArrowIcon className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {academicStats.recent.length > 0 ? (
              academicStats.recent.map(grade => (
                <div
                  key={grade.id}
                  className="bg-bgCard border border-borderColor rounded-2xl p-3 flex items-center justify-between group hover:border-primary/20 hover:shadow-card transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm bg-primary/10 text-primary border-primary/20 shrink-0">
                      <Star className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 pr-1">
                      <h4 className="text-xs font-black text-textPrimary tracking-wide truncate">
                        {grade.category}
                      </h4>

                      <p className="text-[9px] font-bold text-textSecondary mt-0.5 truncate">
                        {grade.subject} •{' '}
                        {new Date(grade.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-center bg-success/10 px-3 py-1.5 rounded-xl border border-success/20 shadow-sm flex items-center shrink-0 ml-2">
                    <span className="block text-base font-black text-success leading-none">
                      {grade.score}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 bg-bgCard border border-borderColor rounded-2xl border-dashed shadow-sm">
                <Target className="w-8 h-8 text-textMuted mx-auto mb-3" />

                <p className="text-[10px] font-bold text-textSecondary">
                  {t('noRecentGrades') ||
                    'لا توجد درجات مرصودة حتى الآن. استعد للانطلاق!'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
